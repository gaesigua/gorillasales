import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { customerScope } from '@/lib/tenant';
import { currentKigaliMonth, dateColumnToString, monthDateRange, todayKigali } from '@/lib/dates';
import { toNumber } from '@/lib/domain/money';
import { CUSTOMER_STATUS_LABELS, type Customer } from '@/lib/types';
import { getCustomerBalances, type CustomerBalance } from './balances';

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
const EMPTY_BALANCE: CustomerBalance = { outstanding: 0, overdue: 0, openOrders: 0 };

export function toCustomerDTO(
  c: CustomerRow,
  stats: CustomerStats = EMPTY_STATS,
  balance: CustomerBalance = EMPTY_BALANCE
): Customer {
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
    monthlyPotential: toNumber(c.monthlyPotential),
    monthlyCapacity: stats.salesThisMonth,
    status: CUSTOMER_STATUS_LABELS[c.status],
    nextFollowUp: stats.nextFollowUp,
    visitsThisMonth: stats.visitsThisMonth,
    ordersThisMonth: stats.ordersThisMonth,
    lastOrderDate: stats.lastOrderDate,
    remarks: c.remarks ?? '',
    tin: c.tin ?? '',
    province: c.province ?? '',
    district: c.district ?? '',
    sector: c.sector ?? '',
    priceListId: c.priceListId ?? '',
    paymentTermsDays: c.paymentTermsDays,
    creditLimit: toNumber(c.creditLimit),
    outstandingBalance: balance.outstanding,
    overdueBalance: balance.overdue,
    openOrdersTotal: balance.openOrders,
  };
}

/** Customers visible to the session, with this month's activity and current balances. */
export async function listCustomers(session: UserSession): Promise<Customer[]> {
  const { organizationId } = session;
  const { month, year } = currentKigaliMonth();
  const thisMonth = monthDateRange(year, month);
  const activeOrders = { organizationId, status: { not: 'CANCELLED' as const } };

  const [customers, monthOrders, monthVisits, lastOrders, followUps, balances] = await Promise.all([
    prisma.customer.findMany({ where: customerScope(session), include: customerInclude, orderBy: { name: 'asc' } }),
    prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: { ...activeOrders, orderDate: thisMonth },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.visitLog.groupBy({
      by: ['customerId'],
      where: { organizationId, dateOfVisit: thisMonth },
      _count: { _all: true },
    }),
    prisma.salesOrder.groupBy({ by: ['customerId'], where: activeOrders, _max: { orderDate: true } }),
    prisma.visitLog.groupBy({
      by: ['customerId'],
      where: { organizationId, nextFollowUpDate: { not: null } },
      _max: { nextFollowUpDate: true },
    }),
    getCustomerBalances(organizationId, todayKigali()),
  ]);

  const stats = new Map<string, CustomerStats>();
  const get = (id: string) => {
    if (!stats.has(id)) stats.set(id, { ...EMPTY_STATS });
    return stats.get(id)!;
  };
  monthOrders.forEach((s) => {
    const st = get(s.customerId);
    st.salesThisMonth = toNumber(s._sum.total);
    st.ordersThisMonth = s._count._all;
  });
  monthVisits.forEach((s) => (get(s.customerId).visitsThisMonth = s._count._all));
  lastOrders.forEach((s) => (get(s.customerId).lastOrderDate = dateColumnToString(s._max.orderDate)));
  followUps.forEach((s) => (get(s.customerId).nextFollowUp = dateColumnToString(s._max.nextFollowUpDate)));

  return customers.map((c) => toCustomerDTO(c, stats.get(c.id), balances.get(c.id)));
}
