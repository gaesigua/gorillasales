import 'server-only';

import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { currentKigaliMonth, monthDateRange } from '@/lib/dates';
import type { ManagedUser } from '@/lib/types';

export async function listUsers(session: UserSession): Promise<ManagedUser[]> {
  const { organizationId } = session;
  const { month, year } = currentKigaliMonth();
  const [users, sales, customers] = await Promise.all([
    prisma.user.findMany({ where: { organizationId }, orderBy: { name: 'asc' } }),
    prisma.visitLog.groupBy({
      by: ['salespersonId'],
      where: { organizationId, dateOfVisit: monthDateRange(year, month) },
      _sum: { salesValue: true },
    }),
    prisma.customer.groupBy({ by: ['salespersonId'], where: { organizationId }, _count: { _all: true } }),
  ]);

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    initials: u.initials,
    phone: u.phone ?? '',
    area: u.area ?? '',
    employeeCode: u.employeeCode ?? '',
    lastLogin: u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 10) : '',
    joinedDate: u.createdAt.toISOString().slice(0, 10),
    salesThisMonth: sales.find((s) => s.salespersonId === u.id)?._sum.salesValue ?? 0,
    customersAssigned: customers.find((c) => c.salespersonId === u.id)?._count._all ?? 0,
  }));
}
