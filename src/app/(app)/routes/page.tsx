import { prisma } from '@/lib/prisma';
import { canViewAllReps, customerScope, requirePageSession } from '@/lib/tenant';
import { getRouteCompliance, listRoutes } from '@/lib/data/routes';
import { addDaysToDate, todayKigali } from '@/lib/dates';
import { isoWeekday } from '@/lib/domain/routes';
import RoutesClient from './components/RoutesClient';

export default async function RoutesPage() {
  const session = await requirePageSession(['ADMIN', 'MANAGER', 'SALES_OFFICER']);
  const today = todayKigali();
  const weekStart = addDaysToDate(today, 1 - isoWeekday(today));
  const last28 = addDaysToDate(today, -27);

  const [routes, thisWeek, last4Weeks, customers] = await Promise.all([
    listRoutes(session),
    getRouteCompliance(session, weekStart, today),
    getRouteCompliance(session, last28, today),
    prisma.customer.findMany({
      where: { ...customerScope(session), status: { not: 'INACTIVE' } },
      select: { id: true, name: true, area: true, salespersonId: true },
      orderBy: [{ area: 'asc' }, { name: 'asc' }],
    }),
  ]);

  return (
    <RoutesClient
      routes={routes}
      thisWeek={thisWeek}
      last4Weeks={last4Weeks}
      customers={customers}
      today={today}
      weekStart={weekStart}
      canEdit={canViewAllReps(session)}
    />
  );
}
