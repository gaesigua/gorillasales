import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { scopedSalespersonId } from '@/lib/tenant';
import { dateColumnToString, stringToDateColumn } from '@/lib/dates';
import { toNumber } from '@/lib/domain/money';
import { CUSTOMER_TYPE_LABELS, type VisitLog } from '@/lib/types';

export const visitInclude = {
  salesperson: { select: { name: true } },
  customer: { select: { name: true, area: true, category: true, customerType: true } },
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      lines: { select: { quantity: true, unitWeightKg: true, product: { select: { name: true } } } },
    },
  },
} satisfies Prisma.VisitLogInclude;

type VisitRow = Prisma.VisitLogGetPayload<{ include: typeof visitInclude }>;

export function toVisitDTO(v: VisitRow): VisitLog {
  // A cancelled order no longer counts as a sale made during the visit
  const order = v.order && v.order.status !== 'CANCELLED' ? v.order : null;
  const lines = order?.lines ?? [];
  return {
    id: v.id,
    timestamp: v.createdAt.toISOString(),
    salespersonId: v.salespersonId,
    salesperson: v.salesperson.name,
    dateOfVisit: dateColumnToString(v.dateOfVisit),
    customerId: v.customerId,
    customerName: v.customer.name,
    area: v.customer.area,
    customerCategory: v.customer.category,
    visitOutcome: v.visitOutcome,
    orderId: order?.id,
    orderNumber: order?.orderNumber,
    orderStatus: order?.status,
    productSummary: lines.map((l) => `${l.product.name} ×${toNumber(l.quantity)}`).join(', '),
    salesValue: order ? toNumber(order.total) : 0,
    weightKg: Math.round(lines.reduce((s, l) => s + toNumber(l.quantity) * l.unitWeightKg, 0) * 1000) / 1000,
    customerType: CUSTOMER_TYPE_LABELS[v.customer.customerType],
    nextFollowUpDate: dateColumnToString(v.nextFollowUpDate),
    remarks: v.remarks ?? '',
  };
}

export interface VisitFilter {
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
  salespersonId?: string;
  customerId?: string;
  limit?: number;
}

/** Visit logs visible to the session (sales officers only see their own). */
export async function listVisits(session: UserSession, filter: VisitFilter = {}): Promise<VisitLog[]> {
  const where: Prisma.VisitLogWhereInput = { organizationId: session.organizationId };
  const repId = scopedSalespersonId(session, filter.salespersonId);
  if (repId) where.salespersonId = repId;
  if (filter.customerId) where.customerId = filter.customerId;
  if (filter.from || filter.to) {
    where.dateOfVisit = {
      ...(filter.from ? { gte: stringToDateColumn(filter.from) } : {}),
      ...(filter.to ? { lte: stringToDateColumn(filter.to) } : {}),
    };
  }

  const rows = await prisma.visitLog.findMany({
    where,
    include: visitInclude,
    orderBy: [{ dateOfVisit: 'desc' }, { createdAt: 'desc' }],
    take: filter.limit,
  });
  return rows.map(toVisitDTO);
}
