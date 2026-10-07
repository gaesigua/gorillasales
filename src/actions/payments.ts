'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { MANAGER_ROLES, invoiceScope, requireRole, requireSession } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { dateColumnToString, stringToDateColumn, todayKigali } from '@/lib/dates';
import { toNumber } from '@/lib/domain/money';
import { invoiceBalance } from '@/lib/domain/receivables';
import { nextDocumentNumber } from '@/lib/documentNumbers';
import { dateString } from '@/lib/orderService';
import { invoiceInclude, toInvoiceDTO } from '@/lib/data/receivables';
import type { ActionResult, Invoice } from '@/lib/types';

const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive('Amount must be more than 0'),
  method: z.enum(['CASH', 'MTN_MOMO', 'AIRTEL_MONEY', 'BANK_TRANSFER', 'CHEQUE']),
  reference: z.string().trim().max(100).optional().or(z.literal('')),
  paidOn: dateString,
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export type RecordPaymentInput = z.input<typeof paymentSchema>;

/**
 * Record money received against an invoice. Anyone who can see the invoice may record a
 * payment (sales officers collect from their own customers). Overpayments are rejected.
 */
export async function recordPayment(input: RecordPaymentInput): Promise<ActionResult<Invoice>> {
  return runAction('recordPayment', async () => {
    const session = await requireSession();
    const data = paymentSchema.parse(input);
    const today = todayKigali();
    if (data.method !== 'CASH' && !data.reference) {
      throw new UserFacingError('Enter the transaction reference (MoMo ID, bank reference or cheque number).');
    }
    if (data.paidOn > today) throw new UserFacingError('Payment date cannot be in the future.');

    const payment = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: data.invoiceId, ...invoiceScope(session) },
      });
      if (!invoice) throw new UserFacingError('Invoice not found.');
      // Lock the invoice so concurrent payments cannot together exceed the balance
      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${invoice.id} FOR UPDATE`;
      const payments = await tx.payment.findMany({ where: { invoiceId: invoice.id }, select: { amount: true } });
      if (invoice.voidedAt) throw new UserFacingError('This invoice has been voided.');
      if (data.paidOn < dateColumnToString(invoice.issueDate)) {
        throw new UserFacingError('Payment date cannot be before the invoice date.');
      }
      const balance = invoiceBalance({
        total: toNumber(invoice.total),
        paid: payments.reduce((s, p) => s + toNumber(p.amount), 0),
        dueDate: dateColumnToString(invoice.dueDate),
      });
      if (data.amount > balance) {
        throw new UserFacingError(`Amount is more than the balance due (RWF ${balance.toLocaleString('en-US')}).`);
      }

      return tx.payment.create({
        data: {
          organizationId: session.organizationId,
          paymentNumber: await nextDocumentNumber(tx, session.organizationId, 'PAYMENT'),
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount: data.amount,
          method: data.method,
          reference: data.reference || null,
          paidOn: stringToDateColumn(data.paidOn),
          receivedById: session.userId,
          notes: data.notes || null,
        },
      });
    });

    await audit(session, 'RECORD_PAYMENT', 'Payment', payment.id, {
      invoiceId: payment.invoiceId,
      amount: data.amount,
      method: data.method,
      reference: data.reference,
    });
    revalidatePath('/', 'layout');
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId }, include: invoiceInclude });
    return toInvoiceDTO(invoice, today);
  });
}

/** Record the receipt number printed by the RRA Electronic Billing Machine for an invoice. */
export async function setEbmReceiptNumber(invoiceId: string, receiptNumber: string): Promise<ActionResult<Invoice>> {
  return runAction('setEbmReceiptNumber', async () => {
    const session = await requireRole([...MANAGER_ROLES, 'DELIVERY_SUPPORT']);
    const number = z.string().trim().max(60).parse(receiptNumber);
    const invoice = await prisma.invoice.findFirst({ where: { id: z.string().parse(invoiceId), ...invoiceScope(session) } });
    if (!invoice) throw new UserFacingError('Invoice not found.');

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { ebmReceiptNumber: number || null },
      include: invoiceInclude,
    });
    await audit(session, 'SET_EBM_RECEIPT', 'Invoice', invoice.id, { from: invoice.ebmReceiptNumber, to: number });
    revalidatePath('/', 'layout');
    return toInvoiceDTO(updated, todayKigali());
  });
}
