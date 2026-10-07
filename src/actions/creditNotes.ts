'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { MANAGER_ROLES, invoiceScope, requireRole, requireSession } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { dateColumnToString, stringToDateColumn, todayKigali } from '@/lib/dates';
import { computeOrderTotals, toNumber } from '@/lib/domain/money';
import { refundDue } from '@/lib/domain/receivables';
import { nextDocumentNumber } from '@/lib/documentNumbers';
import { dateString } from '@/lib/orderService';
import { creditableQuantity, invoiceAmountsTx, lockInvoice, restockReturnedGoods } from '@/lib/creditService';
import { getInvoice, listCreditNotes } from '@/lib/data/receivables';
import type { ActionResult, CreditNoteDTO, Invoice } from '@/lib/types';

const requestSchema = z.object({
  invoiceId: z.string().min(1),
  reason: z.string().trim().min(3, 'Give a reason for the credit').max(500),
  lines: z
    .array(
      z.object({
        orderLineId: z.string().min(1),
        quantity: z.coerce.number().positive('Quantity must be more than 0'),
        disposition: z.enum(['RESTOCK', 'WRITE_OFF', 'NOT_RETURNED']),
      })
    )
    .min(1, 'Choose at least one line to credit')
    .max(50),
});

export type CreditNoteRequest = z.input<typeof requestSchema>;

async function reload(session: Awaited<ReturnType<typeof requireSession>>, invoiceId: string): Promise<Invoice> {
  revalidatePath('/', 'layout');
  return (await getInvoice(session, invoiceId, todayKigali()))!;
}

/**
 * Request a credit note against an invoice (customer return or correction). It has no effect
 * on balances or stock until a manager approves it.
 */
export async function requestCreditNote(input: CreditNoteRequest): Promise<ActionResult<Invoice>> {
  return runAction('requestCreditNote', async () => {
    const session = await requireSession();
    const data = requestSchema.parse(input);
    if (new Set(data.lines.map((l) => l.orderLineId)).size !== data.lines.length) {
      throw new UserFacingError('List each invoice line once.');
    }

    const note = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: data.invoiceId, ...invoiceScope(session) },
        include: { order: { include: { lines: { include: { product: { select: { name: true } } } } } } },
      });
      if (!invoice) throw new UserFacingError('Invoice not found.');
      if (invoice.voidedAt) throw new UserFacingError('This invoice has been voided.');
      await lockInvoice(tx, invoice.id);

      const lines = [];
      for (const l of data.lines) {
        const orderLine = invoice.order.lines.find((ol) => ol.id === l.orderLineId);
        if (!orderLine) throw new UserFacingError('That line is not on this invoice.');
        const available = await creditableQuantity(tx, orderLine.id);
        if (l.quantity > available) {
          throw new UserFacingError(`Only ${available} of ${orderLine.product.name} can still be credited.`);
        }
        lines.push({ ...l, unitPrice: toNumber(orderLine.unitPrice) });
      }
      const org = await tx.organization.findUniqueOrThrow({ where: { id: session.organizationId } });
      const totals = computeOrderTotals(lines, toNumber(invoice.vatRate), org.pricesIncludeVat);

      return tx.creditNote.create({
        data: {
          organizationId: session.organizationId,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          reason: data.reason,
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          total: totals.total,
          createdById: session.userId,
          lines: {
            create: lines.map((l, i) => ({
              orderLineId: l.orderLineId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: totals.lineTotals[i],
              disposition: l.disposition,
            })),
          },
        },
      });
    });

    await audit(session, 'REQUEST_CREDIT_NOTE', 'CreditNote', note.id, {
      invoiceId: data.invoiceId,
      total: toNumber(note.total),
      reason: data.reason,
    });
    return reload(session, data.invoiceId);
  });
}

/**
 * Approve (issue) a credit note: numbers it, reduces the invoice balance, and puts resellable
 * returned goods back into the batches they were delivered from.
 */
export async function approveCreditNote(creditNoteId: string): Promise<ActionResult<Invoice>> {
  return runAction('approveCreditNote', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const today = todayKigali();

    const note = await prisma.$transaction(async (tx) => {
      const note = await tx.creditNote.findFirst({
        where: { id: z.string().parse(creditNoteId), organizationId: session.organizationId },
        include: { invoice: true, lines: { include: { orderLine: { include: { product: { select: { name: true } } } } } } },
      });
      if (!note) throw new UserFacingError('Credit note not found.');
      await lockInvoice(tx, note.invoiceId);
      // Re-read the status under the lock so two approvals cannot both run
      const current = await tx.creditNote.findUniqueOrThrow({ where: { id: note.id }, select: { status: true } });
      if (current.status !== 'PENDING_APPROVAL') throw new UserFacingError('This credit note has already been decided.');

      for (const line of note.lines) {
        const available = await creditableQuantity(tx, line.orderLineId, note.id);
        if (toNumber(line.quantity) > available) {
          throw new UserFacingError(`Only ${available} of ${line.orderLine.product.name} can still be credited.`);
        }
      }
      const creditNoteNumber = await nextDocumentNumber(tx, session.organizationId, 'CREDIT_NOTE');
      for (const line of note.lines.filter((l) => l.disposition === 'RESTOCK')) {
        await restockReturnedGoods(tx, session, {
          orderId: note.invoice.orderId,
          productId: line.orderLine.productId,
          productName: line.orderLine.product.name,
          quantity: toNumber(line.quantity),
          creditNoteId: note.id,
          reason: `Customer return ${creditNoteNumber}: ${note.reason}`,
        });
      }
      return tx.creditNote.update({
        where: { id: note.id },
        data: {
          status: 'APPROVED',
          creditNoteNumber,
          issueDate: stringToDateColumn(today),
          approvedById: session.userId,
          approvedAt: new Date(),
        },
      });
    });

    await audit(session, 'APPROVE_CREDIT_NOTE', 'CreditNote', note.id, {
      creditNoteNumber: note.creditNoteNumber,
      total: toNumber(note.total),
    });
    return reload(session, note.invoiceId);
  });
}

export async function rejectCreditNote(creditNoteId: string, reason: string): Promise<ActionResult<Invoice>> {
  return runAction('rejectCreditNote', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const why = z.string().trim().min(3, 'Give a reason for rejecting').max(300).parse(reason);
    const updated = await prisma.creditNote.updateMany({
      where: { id: z.string().parse(creditNoteId), organizationId: session.organizationId, status: 'PENDING_APPROVAL' },
      data: { status: 'REJECTED', rejectedReason: why, approvedById: session.userId, approvedAt: new Date() },
    });
    if (updated.count !== 1) throw new UserFacingError('Credit note not found or already decided.');
    const note = await prisma.creditNote.findUniqueOrThrow({ where: { id: creditNoteId } });
    await audit(session, 'REJECT_CREDIT_NOTE', 'CreditNote', note.id, { reason: why });
    return reload(session, note.invoiceId);
  });
}

const refundSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive('Amount must be more than 0'),
  method: z.enum(['CASH', 'MTN_MOMO', 'AIRTEL_MONEY', 'BANK_TRANSFER', 'CHEQUE']),
  reference: z.string().trim().max(100).optional().or(z.literal('')),
  paidOn: dateString,
});

/** Pay money back to a customer whose credited invoice was already paid (managers only). */
export async function recordRefund(input: z.input<typeof refundSchema>): Promise<ActionResult<Invoice>> {
  return runAction('recordRefund', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const data = refundSchema.parse(input);
    if (data.paidOn > todayKigali()) throw new UserFacingError('Refund date cannot be in the future.');
    if (data.method !== 'CASH' && !data.reference) throw new UserFacingError('Enter the transaction reference.');

    const refund = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: data.invoiceId, organizationId: session.organizationId } });
      if (!invoice) throw new UserFacingError('Invoice not found.');
      await lockInvoice(tx, invoice.id);
      const due = refundDue(await invoiceAmountsTx(tx, invoice));
      if (due <= 0) throw new UserFacingError('Nothing is owed back to the customer on this invoice.');
      if (data.amount > due) throw new UserFacingError(`Amount is more than the refund due (RWF ${due.toLocaleString('en-US')}).`);

      const creditNote = await tx.creditNote.findFirst({
        where: { invoiceId: invoice.id, status: 'APPROVED' },
        orderBy: { approvedAt: 'desc' },
      });
      if (!creditNote) throw new UserFacingError('No approved credit note on this invoice.');
      if (data.paidOn < dateColumnToString(creditNote.issueDate!)) {
        throw new UserFacingError('Refund date cannot be before the credit note date.');
      }
      return tx.refund.create({
        data: {
          organizationId: session.organizationId,
          refundNumber: await nextDocumentNumber(tx, session.organizationId, 'REFUND'),
          creditNoteId: creditNote.id,
          customerId: invoice.customerId,
          amount: data.amount,
          method: data.method,
          reference: data.reference || null,
          paidOn: stringToDateColumn(data.paidOn),
          paidById: session.userId,
        },
      });
    });

    await audit(session, 'RECORD_REFUND', 'Refund', refund.id, { invoiceId: data.invoiceId, amount: data.amount, method: data.method });
    return reload(session, data.invoiceId);
  });
}

/** Approved credit notes issued in a date range (inclusive), for on-demand reports. */
export async function getCreditNotesForPeriod(from: string, to: string): Promise<ActionResult<CreditNoteDTO[]>> {
  return runAction('getCreditNotesForPeriod', async () => {
    const session = await requireSession();
    dateString.parse(from);
    dateString.parse(to);
    return listCreditNotes(session, { status: ['APPROVED'], issuedFrom: from, issuedTo: to });
  });
}
