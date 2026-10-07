import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { invoiceScope } from '@/lib/tenant';
import { dateColumnToString, daysBetween, stringToDateColumn } from '@/lib/dates';
import { toNumber } from '@/lib/domain/money';
import { invoiceBalance, invoiceStatus, summarizeAging } from '@/lib/domain/receivables';
import type { AgingTotals, Invoice, PaymentRecord } from '@/lib/types';

export const invoiceInclude = {
  customer: { select: { name: true, tin: true } },
  order: { select: { orderNumber: true, salespersonId: true, salesperson: { select: { name: true } } } },
  payments: { include: { receivedBy: { select: { name: true } } }, orderBy: { paidOn: 'asc' } },
} satisfies Prisma.InvoiceInclude;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export function toInvoiceDTO(inv: InvoiceRow, today: string): Invoice {
  const total = toNumber(inv.total);
  const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
  const dueDate = dateColumnToString(inv.dueDate);
  const amounts = { total, paid, dueDate, voided: !!inv.voidedAt };
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
    paid: Math.round(paid * 100) / 100,
    balance: invoiceBalance(amounts),
    status,
    daysOverdue: status === 'OVERDUE' ? daysBetween(dueDate, today) : 0,
    ebmReceiptNumber: inv.ebmReceiptNumber ?? '',
    payments: inv.payments.map((p) => toPaymentDTO(p, inv.invoiceNumber, inv.customer.name)),
  };
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
  openOnly?: boolean; // only invoices with a balance
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
  const invoices = rows.map((r) => toInvoiceDTO(r, today));
  return filter.openOnly ? invoices.filter((i) => i.balance > 0) : invoices;
}

/** Aging of everything the session can see. */
export function agingOf(invoices: Invoice[], today: string): AgingTotals {
  return summarizeAging(
    invoices.map((i) => ({ total: i.total, paid: i.paid, dueDate: i.dueDate, voided: i.status === 'VOID' })),
    today
  );
}
