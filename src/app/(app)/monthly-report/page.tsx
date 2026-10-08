import { canViewAllReps, requirePageSession } from '@/lib/tenant';
import { listMonthlyTargets } from '@/lib/data/config';
import { currentKigaliMonth, todayKigali } from '@/lib/dates';
import MonthlyReportClient from './components/MonthlyReportClient';

export const metadata = { title: 'Reports' };

export default async function MonthlyReportPage() {
  const session = await requirePageSession();
  const { year } = currentKigaliMonth();
  const allTargets = await listMonthlyTargets(session);
  const targets = canViewAllReps(session) ? allTargets : allTargets.filter((t) => t.salespersonId === session.userId);

  return <MonthlyReportClient today={todayKigali()} years={[year - 2, year - 1, year]} targets={targets} />;
}
