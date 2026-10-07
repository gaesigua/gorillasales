import { requirePageSession } from '@/lib/tenant';
import { listDeals } from '@/lib/data/deals';
import { getRepPerformance } from '@/lib/data/performance';
import { currentKigaliMonth, todayKigali } from '@/lib/dates';
import SalesPipelineClient from './components/SalesPipelineClient';

export default async function SalesPipelinePage() {
  const session = await requirePageSession();
  const { month, year } = currentKigaliMonth();
  const [deals, repRows] = await Promise.all([listDeals(session), getRepPerformance(session, year, month)]);
  return <SalesPipelineClient deals={deals} repRows={repRows} today={todayKigali()} />;
}
