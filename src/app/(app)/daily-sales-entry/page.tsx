import { requirePageSession } from '@/lib/tenant';
import { listVisits } from '@/lib/data/visits';
import { getPriceBook, listCustomerOptions } from '@/lib/data/config';
import { getRoutePlan } from '@/lib/data/routes';
import { addDaysToDate, todayKigali } from '@/lib/dates';
import DailySalesEntryClient from './components/DailySalesEntryClient';

const RECENT_DAYS = 60;

export default async function DailySalesEntryPage() {
  const session = await requirePageSession();
  const today = todayKigali();

  const [visits, customers, priceBook, routePlan] = await Promise.all([
    listVisits(session, { from: addDaysToDate(today, -RECENT_DAYS), limit: 1000 }),
    listCustomerOptions(session),
    getPriceBook(session),
    getRoutePlan(session, today),
  ]);

  return <DailySalesEntryClient visits={visits} customers={customers} priceBook={priceBook} routePlan={routePlan} today={today} />;
}
