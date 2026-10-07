import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { orderScope } from '@/lib/tenant';
import { dateColumnToString, stringToDateColumn } from '@/lib/dates';
import { toNumber } from '@/lib/domain/money';
import type { Order, OrderStatusValue } from '@/lib/types';

export const orderInclude = {
  customer: { select: { name: true, area: true, phone: true, contactPerson: true, sector: true, district: true } },
  salesperson: { select: { name: true } },
  lines: { include: { product: { select: { name: true } } }, orderBy: { id: 'asc' } },
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      payments: { select: { amount: true } },
      creditNotes: { where: { status: 'APPROVED' }, select: { total: true, refunds: { select: { amount: true } } } },
    },
  },
  deliveryRun: { select: { id: true, runNumber: true, status: true } },
} satisfies Prisma.SalesOrderInclude;

type OrderRow = Prisma.SalesOrderGetPayload<{ include: typeof orderInclude }>;

export function toOrderDTO(o: OrderRow): Order {
  const lines = o.lines.map((l) => ({
    id: l.id,
    productId: l.productId,
    productName: l.product.name,
    quantity: toNumber(l.quantity),
    unitPrice: toNumber(l.unitPrice),
    unitWeightKg: l.unitWeightKg,
    lineTotal: toNumber(l.lineTotal),
  }));
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    orderDate: dateColumnToString(o.orderDate),
    status: o.status,
    customerId: o.customerId,
    customerName: o.customer.name,
    area: o.customer.area,
    salespersonId: o.salespersonId,
    salesperson: o.salesperson.name,
    visitLogId: o.visitLogId ?? '',
    paymentTermsDays: o.paymentTermsDays,
    subtotal: toNumber(o.subtotal),
    vatAmount: toNumber(o.vatAmount),
    total: toNumber(o.total),
    weightKg: Math.round(lines.reduce((s, l) => s + l.quantity * l.unitWeightKg, 0) * 1000) / 1000,
    notes: o.notes ?? '',
    holdReason: o.holdReason ?? '',
    cancelReason: o.cancelReason ?? '',
    lines,
    invoiceId: o.invoice?.id ?? '',
    invoiceNumber: o.invoice?.invoiceNumber ?? '',
    // Net of refunds paid back to the customer
    amountPaid:
      (o.invoice?.payments ?? []).reduce((s, p) => s + toNumber(p.amount), 0) -
      (o.invoice?.creditNotes ?? []).reduce((s, cn) => s + cn.refunds.reduce((t, r) => t + toNumber(r.amount), 0), 0),
    creditedAmount: (o.invoice?.creditNotes ?? []).reduce((s, cn) => s + toNumber(cn.total), 0),
    deliveryRunId: o.deliveryRun?.id ?? '',
    deliveryRunNumber: o.deliveryRun?.runNumber ?? '',
    deliveryRunStatus: o.deliveryRun?.status ?? null,
    deliveryFailedReason: o.deliveryFailedReason ?? '',
    customerPhone: o.customer.phone ?? '',
    customerContact: o.customer.contactPerson ?? '',
    customerAddress: [o.customer.sector, o.customer.district].filter(Boolean).join(', '),
  };
}

export interface OrderFilter {
  from?: string;
  to?: string;
  status?: OrderStatusValue[];
  customerId?: string;
  excludeCancelled?: boolean;
  limit?: number;
}

/** Orders visible to the session (sales officers only see their own). */
export async function listOrders(session: UserSession, filter: OrderFilter = {}): Promise<Order[]> {
  const where: Prisma.SalesOrderWhereInput = { ...orderScope(session) };
  if (filter.customerId) where.customerId = filter.customerId;
  if (filter.status?.length) where.status = { in: filter.status };
  else if (filter.excludeCancelled) where.status = { not: 'CANCELLED' };
  if (filter.from || filter.to) {
    where.orderDate = {
      ...(filter.from ? { gte: stringToDateColumn(filter.from) } : {}),
      ...(filter.to ? { lte: stringToDateColumn(filter.to) } : {}),
    };
  }
  const rows = await prisma.salesOrder.findMany({
    where,
    include: orderInclude,
    orderBy: [{ orderDate: 'desc' }, { createdAt: 'desc' }],
    take: filter.limit,
  });
  return rows.map(toOrderDTO);
}
