import { requirePageSession } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { canManageWarehouse, WAREHOUSE_ROLES } from '@/lib/roles';
import { listDeliveryRuns } from '@/lib/data/deliveries';
import { attachStockCoverage } from '@/lib/data/inventory';
import { listOrders } from '@/lib/data/orders';
import { addDaysToDate, todayKigali } from '@/lib/dates';
import DeliveriesClient from './components/DeliveriesClient';

export const metadata = { title: 'Deliveries' };

export default async function DeliveriesPage() {
  const session = await requirePageSession([...WAREHOUSE_ROLES, 'DRIVER']);
  const today = todayKigali();
  const planner = canManageWarehouse(session.role);

  const [runs, queue, drivers] = await Promise.all([
    listDeliveryRuns(session, today, { from: addDaysToDate(today, -30) }),
    // Confirmed orders not yet on a run: the dispatcher's queue
    planner ? listOrders(session, { status: ['CONFIRMED'] }) : Promise.resolve([]),
    planner
      ? prisma.user.findMany({
          where: { organizationId: session.organizationId, isActive: true, role: { in: ['DRIVER', 'DELIVERY_SUPPORT'] } },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ]);
  const unassigned = await attachStockCoverage(
    session.organizationId,
    today,
    queue.filter((o) => !o.deliveryRunId)
  );

  return <DeliveriesClient runs={runs} queue={unassigned} drivers={drivers} today={today} />;
}
