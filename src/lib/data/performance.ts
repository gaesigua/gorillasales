import 'server-only';

import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { scopedSalespersonId } from '@/lib/tenant';
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

  const [reps, targets, sales, orders, newCustomers, overdueList] = await Promise.all([
    prisma.user.findMany({
      where: {
        organizationId,
        ...(repId ? { id: repId } : {}),
        OR: [
          { role: 'SALES_OFFICER', isActive: true },
          { visitLogs: { some: { dateOfVisit } } },
          { targets: { some: { year, month } } },
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.monthlyTarget.findMany({ where: { organizationId, year, month, ...repWhere } }),
    prisma.visitLog.groupBy({
      by: ['salespersonId'],
      where: { organizationId, dateOfVisit, ...repWhere },
      _sum: { salesValue: true },
      _count: { _all: true },
    }),
    prisma.visitLog.groupBy({
      by: ['salespersonId'],
      where: { organizationId, dateOfVisit, salesValue: { gt: 0 }, ...repWhere },
      _count: { _all: true },
    }),
    prisma.customer.groupBy({
      by: ['salespersonId'],
      where: { organizationId, createdAt: monthInstantRange(year, month), ...repWhere },
      _count: { _all: true },
    }),
    overdue ? Promise.resolve(overdue) : listOverdueFollowUps(session),
  ]);

  return reps.map((rep) => {
    const target = targets.find((t) => t.salespersonId === rep.id);
    const sale = sales.find((s) => s.salespersonId === rep.id);
    const actualSales = sale?._sum.salesValue ?? 0;
    const targetAmount = target?.targetAmount ?? 0;
    return {
      salespersonId: rep.id,
      salesperson: rep.name,
      target: targetAmount,
      targetWeightKg: target?.targetWeightKg ?? 0,
      actualSales,
      achievementPct: targetAmount > 0 ? Math.round((actualSales / targetAmount) * 1000) / 10 : 0,
      newCustomers: newCustomers.find((c) => c.salespersonId === rep.id)?._count._all ?? 0,
      customerVisits: sale?._count._all ?? 0,
      orders: orders.find((o) => o.salespersonId === rep.id)?._count._all ?? 0,
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
      const [actual, target] = await Promise.all([
        prisma.visitLog.aggregate({
          where: { organizationId, dateOfVisit: monthDateRange(m.year, m.month), ...repWhere },
          _sum: { salesValue: true },
        }),
        prisma.monthlyTarget.aggregate({
          where: { organizationId, year: m.year, month: m.month, ...repWhere },
          _sum: { targetAmount: true },
        }),
      ]);
      return {
        month: `${MONTH_SHORT[m.month]} ${String(m.year).slice(2)}`,
        target: target._sum.targetAmount ?? 0,
        actual: actual._sum.salesValue ?? 0,
      };
    })
  );
}

export async function getDashboardData(session: UserSession): Promise<DashboardData> {
  const { month, year } = currentKigaliMonth();
  const overdue = await listOverdueFollowUps(session);
  const [repRows, trend, deals] = await Promise.all([
    getRepPerformance(session, year, month, overdue),
    getSalesTrend(session, year, month),
    listDeals(session),
  ]);
  return {
    today: todayKigali(),
    month,
    year,
    repRows,
    trend,
    overdue,
    openDeals: deals.filter((d) => d.probability > 0 && d.probability < 100),
  };
}
