import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { customerScope } from '@/lib/tenant';
import { currentKigaliMonth, dateColumnToString, monthDateRange } from '@/lib/dates';
import { CUSTOMER_STATUS_LABELS, type Customer } from '@/lib/types';

export const customerInclude = {
  salesperson: { select: { name: true } },
  mainProduct: { select: { name: true } },
} satisfies Prisma.CustomerInclude;

type CustomerRow = Prisma.CustomerGetPayload<{ include: typeof customerInclude }>;

interface CustomerStats {
  salesThisMonth: number;
  visitsThisMonth: number;
  ordersThisMonth: number;
  lastOrderDate: string;
  nextFollowUp: string;
}

const EMPTY_STATS: CustomerStats = {
  salesThisMonth: 0,
  visitsThisMonth: 0,
  ordersThisMonth: 0,
  lastOrderDate: '',
  nextFollowUp: '',
};

export function toCustomerDTO(c: CustomerRow, stats: CustomerStats = EMPTY_STATS): Customer {
  return {
    id: c.id,
    code: c.code ?? '',
    name: c.name,
    category: c.category,
    customerType: c.customerType,
    area: c.area,
    contactPerson: c.contactPerson ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    salespersonId: c.salespersonId ?? '',
    salesperson: c.salesperson?.name ?? '',
    mainProductId: c.mainProductId ?? '',
    mainProduct: c.mainProduct?.name ?? '',
    monthlyPotential: c.monthlyPotential,
    monthlyCapacity: stats.salesThisMonth,
    status: CUSTOMER_STATUS_LABELS[c.status],
    nextFollowUp: stats.nextFollowUp,
    visitsThisMonth: stats.visitsThisMonth,
    ordersThisMonth: stats.ordersThisMonth,
    lastOrderDate: stats.lastOrderDate,
    remarks: c.remarks ?? '',
    outstandingBalance: c.outstandingBalance,
    creditLimit: c.creditLimit,
  };
}

/** Customers visible to the session, with this-month activity computed from visit logs. */
export async function listCustomers(session: UserSession): Promise<Customer[]> {
  const { organizationId } = session;
  const { month, year } = currentKigaliMonth();
  const thisMonth = monthDateRange(year, month);

  const [customers, monthStats, orderStats, lastOrders, followUps] = await Promise.all([
    prisma.customer.findMany({ where: customerScope(session), include: customerInclude, orderBy: { name: 'asc' } }),
    prisma.visitLog.groupBy({
      by: ['customerId'],
      where: { organizationId, dateOfVisit: thisMonth },
      _sum: { salesValue: true },
      _count: { _all: true },
    }),
    prisma.visitLog.groupBy({
      by: ['customerId'],
      where: { organizationId, dateOfVisit: thisMonth, salesValue: { gt: 0 } },
      _count: { _all: true },
    }),
    prisma.visitLog.groupBy({
      by: ['customerId'],
      where: { organizationId, salesValue: { gt: 0 } },
      _max: { dateOfVisit: true },
    }),
    prisma.visitLog.groupBy({
      by: ['customerId'],
      where: { organizationId, nextFollowUpDate: { not: null } },
      _max: { nextFollowUpDate: true },
    }),
  ]);

  const stats = new Map<string, CustomerStats>();
  const get = (id: string) => {
    if (!stats.has(id)) stats.set(id, { ...EMPTY_STATS });
    return stats.get(id)!;
  };
  monthStats.forEach((s) => {
    const st = get(s.customerId);
    st.salesThisMonth = s._sum.salesValue ?? 0;
    st.visitsThisMonth = s._count._all;
  });
  orderStats.forEach((s) => (get(s.customerId).ordersThisMonth = s._count._all));
  lastOrders.forEach((s) => (get(s.customerId).lastOrderDate = dateColumnToString(s._max.dateOfVisit)));
  followUps.forEach((s) => (get(s.customerId).nextFollowUp = dateColumnToString(s._max.nextFollowUpDate)));

  return customers.map((c) => toCustomerDTO(c, stats.get(c.id)));
}
