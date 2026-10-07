import 'server-only';

import type { Prisma } from '@prisma/client';
import type { UserSession } from './auth';
import { UserFacingError } from './actionUtils';
import { dateColumnToString } from './dates';
import { toNumber } from './domain/money';
import { round3 } from './domain/inventory';
import type { InvoiceAmounts } from './domain/receivables';
import { putStock } from './inventoryService';

type Tx = Prisma.TransactionClient;

/**
 * Current money position of an invoice, read inside the caller's transaction: payments net of
 * refunds, and approved credit notes. Lock the invoice row first when about to change money.
 */
export async function invoiceAmountsTx(tx: Tx, invoice: { id: string; total: Prisma.Decimal; dueDate: Date; voidedAt: Date | null }): Promise<InvoiceAmounts> {
  const [payments, credits, refunds] = await Promise.all([
    tx.payment.aggregate({ where: { invoiceId: invoice.id }, _sum: { amount: true } }),
    tx.creditNote.aggregate({ where: { invoiceId: invoice.id, status: 'APPROVED' }, _sum: { total: true } }),
    tx.refund.aggregate({ where: { creditNote: { invoiceId: invoice.id } }, _sum: { amount: true } }),
  ]);
  return {
    total: toNumber(invoice.total),
    paid: Math.round((toNumber(payments._sum.amount) - toNumber(refunds._sum.amount)) * 100) / 100,
    credited: toNumber(credits._sum.total),
    dueDate: dateColumnToString(invoice.dueDate),
    voided: !!invoice.voidedAt,
  };
}

export async function lockInvoice(tx: Tx, invoiceId: string) {
  await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE`;
}

/**
 * Quantity of an order line still available to credit: invoiced quantity minus quantity on
 * other approved or pending credit notes.
 */
export async function creditableQuantity(tx: Tx, orderLineId: string, excludeCreditNoteId?: string): Promise<number> {
  const [line, credited] = await Promise.all([
    tx.salesOrderLine.findUniqueOrThrow({ where: { id: orderLineId }, select: { quantity: true } }),
    tx.creditNoteLine.aggregate({
      where: {
        orderLineId,
        creditNote: { status: { not: 'REJECTED' }, ...(excludeCreditNoteId ? { id: { not: excludeCreditNoteId } } : {}) },
      },
      _sum: { quantity: true },
    }),
  ]);
  return round3(toNumber(line.quantity) - toNumber(credited._sum.quantity));
}

/**
 * Puts resellable returned goods back into the batches they were delivered from, most
 * recently delivered batch first, never more than was taken out for this order.
 */
export async function restockReturnedGoods(
  tx: Tx,
  session: UserSession,
  args: { orderId: string; productId: string; productName: string; quantity: number; creditNoteId: string; reason: string }
) {
  const outbound = await tx.stockMovement.findMany({
    where: { orderId: args.orderId, type: { in: ['DISPATCH', 'DELIVERY', 'RETURN', 'CUSTOMER_RETURN'] }, batch: { productId: args.productId } },
    orderBy: { createdAt: 'desc' },
  });
  // Net quantity of each batch that ended up with the customer
  const net = new Map<string, number>();
  for (const m of outbound) net.set(m.batchId, round3((net.get(m.batchId) ?? 0) - toNumber(m.quantity)));
  let remaining = round3(args.quantity);
  for (const [batchId, qty] of net) {
    if (remaining <= 0) break;
    if (qty <= 0) continue;
    const back = round3(Math.min(qty, remaining));
    await putStock(tx, session, {
      batchId,
      quantity: back,
      type: 'CUSTOMER_RETURN',
      orderId: args.orderId,
      reason: args.reason,
      creditNoteId: args.creditNoteId,
    });
    remaining = round3(remaining - back);
  }
  if (remaining > 0) {
    throw new UserFacingError(`Cannot restock ${args.productName}: no record of that much stock going to this customer.`);
  }
}
