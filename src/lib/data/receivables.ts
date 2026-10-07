import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { invoiceScope } from '@/lib/tenant';
import { dateColumnToString, daysBetween, stringToDateColumn } from '@/lib/dates';
import { round3 } from '@/lib/domain/inventory';
import { toNumber } from '@/lib/domain/money';
import { invoiceBalance, invoiceStatus, refundDue, summarizeAging } from '@/lib/domain/receivables';
import type { AgingTotals, CreditNoteDTO, CreditNoteStatusValue, Invoice, PaymentRecord, RefundRecord } from '@/lib/types';

const userName = { select: { name: true } } as const;

export const creditNoteInclude = {
  invoice: {
    select: {
      invoiceNumber: true,
      customer: { select: { name: true } },
      order: { select: { salespersonId: true, salesperson: userName } },
    },
  },
  lines: { include: { orderLine: { select: { product: { select: { name: true } } } } } },
  refunds: { select: { amount: true } },
} satisfies Prisma.CreditNoteInclude;

type CreditNoteRow = Prisma.CreditNoteGetPayload<{ include: typeof creditNoteInclude }>;

export function toCreditNoteDTO(cn: CreditNoteRow, requestedBy: string): CreditNoteDTO {
  return {
    id: cn.id,
    creditNoteNumber: cn.creditNoteNumber ?? '',
    status: cn.status,
    invoiceId: cn.invoiceId,
    invoiceNumber: cn.invoice.invoiceNumber,
    customerId: cn.customerId,
    customerName: cn.invoice.customer.name,
    salespersonId: cn.invoice.order.salespersonId,
    salesperson: cn.invoice.order.salesperson.name,
    reason: cn.reason,
    requestedOn: cn.createdAt.toISOString().slice(0, 10),
    issueDate: cn.issueDate ? dateColumnToString(cn.issueDate) : '',
    subtotal: toNumber(cn.subtotal),
    vatAmount: toNumber(cn.vatAmount),
    total: toNumber(cn.total),
    requestedBy,
    rejectedReason: cn.rejectedReason ?? '',
    refunded: cn.refunds.reduce((s, r) => s + toNumber(r.amount), 0),
    lines: cn.lines.map((l) => ({
      productName: l.orderLine.product.name,
      quantity: toNumber(l.quantity),
      unitPrice: toNumber(l.unitPrice),
      lineTotal: toNumber(l.lineTotal),
      disposition: l.disposition,
    })),
  };
}

export const invoiceInclude = {
  customer: { select: { name: true, tin: true } },
  order: {
    select: {
      orderNumber: true,
      salespersonId: true,
      salesperson: userName,
      lines: {
        include: {
          product: { select: { name: true } },
          creditLines: { where: { creditNote: { status: { not: 'REJECTED' } } }, select: { quantity: true } },
        },
        orderBy: { id: 'asc' },
      },
    },
  },
  payments: { include: { receivedBy: userName }, orderBy: { paidOn: 'asc' } },
  creditNotes: {
    include: { ...creditNoteInclude, refunds: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.InvoiceInclude;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

/** Names of the users referenced by credit notes and refunds (not modelled as relations). */
async function userNames(ids: string[]): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name]));
}

export function toInvoiceDTO(inv: InvoiceRow, today: string, names: Map<string, string> = new Map()): Invoice {
  const total = toNumber(inv.total);
  const received = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
  const refunds: RefundRecord[] = inv.creditNotes.flatMap((cn) =>
    cn.refunds.map((r) => ({
      id: r.id,
      refundNumber: r.refundNumber,
      creditNoteNumber: cn.creditNoteNumber ?? '',
      amount: toNumber(r.amount),
      method: r.method,
      reference: r.reference ?? '',
      paidOn: dateColumnToString(r.paidOn),
      paidBy: names.get(r.paidById) ?? '',
    }))
  );
  const refunded = refunds.reduce((s, r) => s + r.amount, 0);
  const credited = inv.creditNotes.filter((cn) => cn.status === 'APPROVED').reduce((s, cn) => s + toNumber(cn.total), 0);
  const paid = Math.round((received - refunded) * 100) / 100;
  const dueDate = dateColumnToString(inv.dueDate);
  const amounts = { total, paid, credited, dueDate, voided: !!inv.voidedAt };
  const status = invoiceStatus(amounts, today);
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    orderId: inv.orderId,
    orderNumber: inv.order.orderNumber,
    customerId: inv.customerId,
    customerName: inv.customer.name,
    customerTin: inv.customer.tin ?? '',
    salespersonId: inv.order.salespersonId,
    salesperson: inv.order.salesperson.name,
    issueDate: dateColumnToString(inv.issueDate),
    dueDate,
    vatRate: toNumber(inv.vatRate),
    subtotal: toNumber(inv.subtotal),
    vatAmount: toNumber(inv.vatAmount),
    total,
    paid,
    credited: Math.round(credited * 100) / 100,
    balance: invoiceBalance(amounts),
    refundDue: refundDue(amounts),
    status,
    daysOverdue: status === 'OVERDUE' ? daysBetween(dueDate, today) : 0,
    ebmReceiptNumber: inv.ebmReceiptNumber ?? '',
    payments: inv.payments.map((p) => toPaymentDTO(p, inv.invoiceNumber, inv.customer.name)),
    refunds,
    creditNotes: inv.creditNotes.map((cn) => toCreditNoteDTO(cn, names.get(cn.createdById) ?? '')),
    lines: inv.order.lines.map((l) => ({
      orderLineId: l.id,
      productName: l.product.name,
      quantity: toNumber(l.quantity),
      unitPrice: toNumber(l.unitPrice),
      creditedQuantity: round3(l.creditLines.reduce((s, c) => s + toNumber(c.quantity), 0)),
    })),
  };
}

/** Loads one invoice the session can see, as a DTO. */
export async function getInvoice(session: UserSession, invoiceId: string, today: string): Promise<Invoice | null> {
  const inv = await prisma.invoice.findFirst({ where: { id: invoiceId, ...invoiceScope(session) }, include: invoiceInclude });
  if (!inv) return null;
  const names = await userNames(inv.creditNotes.flatMap((cn) => [cn.createdById, ...cn.refunds.map((r) => r.paidById)]));
  return toInvoiceDTO(inv, today, names);
}

export function toPaymentDTO(
  p: Prisma.PaymentGetPayload<{ include: { receivedBy: { select: { name: true } } } }>,
  invoiceNumber: string,
  customerName: string
): PaymentRecord {
  return {
    id: p.id,
    paymentNumber: p.paymentNumber,
    invoiceId: p.invoiceId,
    invoiceNumber,
    customerId: p.customerId,
    customerName,
    amount: toNumber(p.amount),
    method: p.method,
    reference: p.reference ?? '',
    paidOn: dateColumnToString(p.paidOn),
    receivedBy: p.receivedBy.name,
    notes: p.notes ?? '',
  };
}

export interface InvoiceFilter {
  openOnly?: boolean; // only invoices with a balance or a refund due
  customerId?: string;
  from?: string; // issue date
  to?: string;
  limit?: number;
}

/** Invoices visible to the session, newest first. */
export async function listInvoices(session: UserSession, today: string, filter: InvoiceFilter = {}): Promise<Invoice[]> {
  const where: Prisma.InvoiceWhereInput = { ...invoiceScope(session) };
  if (filter.customerId) where.customerId = filter.customerId;
  if (filter.openOnly) where.voidedAt = null;
  if (filter.from || filter.to) {
    where.issueDate = {
      ...(filter.from ? { gte: stringToDateColumn(filter.from) } : {}),
      ...(filter.to ? { lte: stringToDateColumn(filter.to) } : {}),
    };
  }
  const rows = await prisma.invoice.findMany({
    where,
    include: invoiceInclude,
    orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
    take: filter.limit,
  });
  const names = await userNames(rows.flatMap((i) => i.creditNotes.flatMap((cn) => [cn.createdById, ...cn.refunds.map((r) => r.paidById)])));
  const invoices = rows.map((r) => toInvoiceDTO(r, today, names));
  return filter.openOnly ? invoices.filter((i) => i.balance > 0 || i.refundDue > 0) : invoices;
}

/** Aging of everything the session can see. */
export function agingOf(invoices: Invoice[], today: string): AgingTotals {
  return summarizeAging(
    invoices.map((i) => ({ total: i.total, paid: i.paid, credited: i.credited, dueDate: i.dueDate, voided: i.status === 'VOID' })),
    today
  );
}

export interface CreditNoteFilter {
  status?: CreditNoteStatusValue[];
  issuedFrom?: string; // approval date range (approved notes)
  issuedTo?: string;
  limit?: number;
}

/** Credit notes on invoices the session can see. */
export async function listCreditNotes(session: UserSession, filter: CreditNoteFilter = {}): Promise<CreditNoteDTO[]> {
  const rows = await prisma.creditNote.findMany({
    where: {
      organizationId: session.organizationId,
      invoice: invoiceScope(session),
      ...(filter.status ? { status: { in: filter.status } } : {}),
      ...(filter.issuedFrom || filter.issuedTo
        ? {
            issueDate: {
              ...(filter.issuedFrom ? { gte: stringToDateColumn(filter.issuedFrom) } : {}),
              ...(filter.issuedTo ? { lte: stringToDateColumn(filter.issuedTo) } : {}),
            },
          }
        : {}),
    },
    include: creditNoteInclude,
    orderBy: { createdAt: 'desc' },
    take: filter.limit,
  });
  const names = await userNames(rows.map((r) => r.createdById));
  return rows.map((r) => toCreditNoteDTO(r, names.get(r.createdById) ?? ''));
}
