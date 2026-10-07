import { prisma } from '@/lib/prisma';
import { customerScope, requirePageSession } from '@/lib/tenant';
import { listVisits } from '@/lib/data/visits';
import { todayKigali } from '@/lib/dates';
import DailySalesEntryClient from './components/DailySalesEntryClient';

const RECENT_DAYS = 60;

export default async function DailySalesEntryPage() {
  const session = await requirePageSession();
  const today = todayKigali();
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - RECENT_DAYS * 86400000).toISOString().slice(0, 10);

  const [visits, customers] = await Promise.all([
    listVisits(session, { from, limit: 1000 }),
    prisma.customer.findMany({
      where: { ...customerScope(session), status: { not: 'INACTIVE' } },
      select: { id: true, name: true, area: true, category: true, customerType: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return <DailySalesEntryClient visits={visits} customers={customers} today={today} />;
}
