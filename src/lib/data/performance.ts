import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { orderScope, scopedSalespersonId } from '@/lib/tenant';
import { toNumber } from '@/lib/domain/money';
import {
  currentKigaliMonth,
  dateColumnToString,
  daysBetween,
  MONTH_SHORT,
  monthDateRange,
  monthInstantRange,
  todayKigali,
} from '@/lib/dates';
import type { DashboardData, OverdueFollowUp, RepPerformanceRow, TrendPoint } from '@/lib/types';
import { listDeals } from './deals';
import { agingOf, listInvoices } from './receivables';

/**
 * Customers whose most recent visit scheduled a follow-up that is due today or earlier.
 * A follow-up counts as done once a newer visit to the same customer is logged.
 */
export async function listOverdueFollowUps(session: UserSession): Promise<OverdueFollowUp[]> {
  const today = todayKigali();
  const repId = scopedSalespersonId(session);
  const latestVisits = await prisma.visitLog.findMany({
    where: { organizationId: session.organizationId, ...(repId ? { salespersonId: repId } : {}) },
    distinct: ['customerId'],
    orderBy: [{ customerId: 'asc' }, { dateOfVisit: 'desc' }, { createdAt: 'desc' }],
    include: {
      customer: { select: { name: true, area: true } },
      salesperson: { select: { name: true } },
    },
  });

  return latestVisits
    .filter((v) => v.nextFollowUpDate && dateColumnToString(v.nextFollowUpDate) <= today)
    .map((v) => {
      const dueDate = dateColumnToString(v.nextFollowUpDate);
      return {
        id: v.id,
        customerId: v.customerId,
        customer: v.customer.name,
        area: v.customer.area,
        salespersonId: v.salespersonId,
        salesperson: v.salesperson.name,
        dueDate,
        daysOverdue: daysBetween(dueDate, today),
        lastOutcome: v.visitOutcome,
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/**
 * Approved credit notes per rep (the original order's salesperson) issued in [gte, lt).
 * Sales figures are net of these: returns and corrections count in the month they are issued.
 */
async function creditsByRep(organizationId: string, range: { gte: Date; lt: Date }, repId?: string): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ salespersonId: string; total: Prisma.Decimal }[]>`
    SELECT o."salespersonId", SUM(cn."total") AS total
    FROM "credit_notes" cn
    JOIN "invoices" i ON i."id" = cn."invoiceId"
    JOIN "sales_orders" o ON o."id" = i."orderId"
    WHERE cn."organizationId" = ${organizationId} AND cn."status" = 'APPROVED'
      AND cn."issueDate" >= ${range.gte} AND cn."issueDate" < ${range.lt}
      ${repId ? Prisma.sql`AND o."salespersonId" = ${repId}` : Prisma.empty}
    GROUP BY o."salespersonId"`;
  return new Map(rows.map((r) => [r.salespersonId, toNumber(r.total)]));
}

/** Target vs actual per sales officer for one month (sales officers only get their own row). */
export async function getRepPerformance(
  session: UserSession,
  year: number,
  month: number,
  overdue?: OverdueFollowUp[]
): Promise<RepPerformanceRow[]> {
  const { organizationId } = session;
  const repId = scopedSalespersonId(session);
  const repWhere = repId ? { salespersonId: repId } : {};
  const dateOfVisit = monthDateRange(year, month);

  const orderDate = dateOfVisit;
  const activeOrders: Prisma.SalesOrderWhereInput = { organizationId, orderDate, status: { not: 'CANCELLED' }, ...repWhere };

  const [reps, targets, sales, visits, kgRows, newCustomers, overdueList, credits] = await Promise.all([
    prisma.user.findMany({
      where: {
        organizationId,
        ...(repId ? { id: repId } : {}),
        OR: [
          { role: 'SALES_OFFICER', isActive: true },
          { visitLogs: { some: { dateOfVisit } } },
          { salesOrders: { some: { orderDate } } },
          { targets: { some: { year, month } } },
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.monthlyTarget.findMany({ where: { organizationId, year, month, ...repWhere } }),
    prisma.salesOrder.groupBy({ by: ['salespersonId'], where: activeOrders, _sum: { total: true }, _count: { _all: true } }),
    prisma.visitLog.groupBy({ by: ['salespersonId'], where: { organizationId, dateOfVisit, ...repWhere }, _count: { _all: true } }),
    prisma.$queryRaw<{ salespersonId: string; kg: number | null }[]>`
      SELECT o."salespersonId", SUM(l."quantity" * l."unitWeightKg")::float AS kg
      FROM "sales_order_lines" l JOIN "sales_orders" o ON o."id" = l."orderId"
      WHERE o."organizationId" = ${organizationId} AND o."status" <> 'CANCELLED'
        AND o."orderDate" >= ${orderDate.gte} AND o."orderDate" < ${orderDate.lt}
        ${repId ? Prisma.sql`AND o."salespersonId" = ${repId}` : Prisma.empty}
      GROUP BY o."salespersonId"`,
    prisma.customer.groupBy({
      by: ['salespersonId'],
      where: { organizationId, createdAt: monthInstantRange(year, month), ...repWhere },
      _count: { _all: true },
    }),
    overdue ? Promise.resolve(overdue) : listOverdueFollowUps(session),
    creditsByRep(organizationId, dateOfVisit, repId),
  ]);

  return reps.map((rep) => {
    const target = targets.find((t) => t.salespersonId === rep.id);
    const sale = sales.find((s) => s.salespersonId === rep.id);
    const actualSales = Math.round((toNumber(sale?._sum.total) - (credits.get(rep.id) ?? 0)) * 100) / 100;
    const targetAmount = toNumber(target?.targetAmount);
    return {
      salespersonId: rep.id,
      salesperson: rep.name,
      target: targetAmount,
      targetWeightKg: target?.targetWeightKg ?? 0,
      actualSales,
      actualWeightKg: Math.round((kgRows.find((k) => k.salespersonId === rep.id)?.kg ?? 0) * 100) / 100,
      achievementPct: targetAmount > 0 ? Math.round((actualSales / targetAmount) * 1000) / 10 : 0,
      newCustomers: newCustomers.find((c) => c.salespersonId === rep.id)?._count._all ?? 0,
      customerVisits: visits.find((v) => v.salespersonId === rep.id)?._count._all ?? 0,
      orders: sale?._count._all ?? 0,
      outstandingFollowUps: overdueList.filter((f) => f.salespersonId === rep.id).length,
    };
  });
}

/** Monthly target vs actual for the 6 months ending with (year, month). */
async function getSalesTrend(session: UserSession, year: number, month: number): Promise<TrendPoint[]> {
  const { organizationId } = session;
  const repId = scopedSalespersonId(session);
  const repWhere = repId ? { salespersonId: repId } : {};
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 5 + i, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });

  return Promise.all(
    months.map(async (m) => {
      const [actual, target, credits] = await Promise.all([
        prisma.salesOrder.aggregate({
          where: { organizationId, orderDate: monthDateRange(m.year, m.month), status: { not: 'CANCELLED' }, ...repWhere },
          _sum: { total: true },
        }),
        prisma.monthlyTarget.aggregate({
          where: { organizationId, year: m.year, month: m.month, ...repWhere },
          _sum: { targetAmount: true },
        }),
        creditsByRep(organizationId, monthDateRange(m.year, m.month), repId),
      ]);
      return {
        month: `${MONTH_SHORT[m.month]} ${String(m.year).slice(2)}`,
        target: toNumber(target._sum.targetAmount),
        actual: toNumber(actual._sum.total) - [...credits.values()].reduce((t, c) => t + c, 0),
      };
    })
  );
}

export async function getDashboardData(session: UserSession): Promise<DashboardData> {
  const { month, year } = currentKigaliMonth();
  const overdue = await listOverdueFollowUps(session);
  const today = todayKigali();
  const [repRows, trend, deals, openInvoices, orderCounts] = await Promise.all([
    getRepPerformance(session, year, month, overdue),
    getSalesTrend(session, year, month),
    listDeals(session),
    listInvoices(session, today, { openOnly: true }),
    prisma.salesOrder.groupBy({
      by: ['status'],
      where: { ...orderScope(session), status: { in: ['PENDING_APPROVAL', 'CONFIRMED'] } },
      _count: { _all: true },
    }),
  ]);
  const countOf = (status: string) => orderCounts.find((c) => c.status === status)?._count._all ?? 0;
  return {
    today,
    month,
    year,
    receivables: agingOf(openInvoices, today),
    ordersOnHold: countOf('PENDING_APPROVAL'),
    ordersToDeliver: countOf('CONFIRMED'),
    repRows,
    trend,
    overdue,
    openDeals: deals.filter((d) => d.probability > 0 && d.probability < 100),
  };
}
