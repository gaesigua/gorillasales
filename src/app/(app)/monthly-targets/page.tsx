import { canViewAllReps, requirePageSession } from '@/lib/tenant';
import { getAppConfig, listMonthlyTargets } from '@/lib/data/config';
import { listVisits } from '@/lib/data/visits';
import { monthLastDay, parsePeriodParams } from '@/lib/dates';
import MonthlyTargetsClient from './components/MonthlyTargetsClient';

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function MonthlyTargetsPage({ searchParams }: PageProps) {
  const session = await requirePageSession();
  const { month, year, currentYear } = parsePeriodParams(await searchParams);
  const allReps = canViewAllReps(session);
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const [config, visits, yearTargets] = await Promise.all([
    getAppConfig(session),
    listVisits(session, { from, to: monthLastDay(year, month) }),
    listMonthlyTargets(session, { year }),
  ]);
  // Sales officers only see their own row and target
  const targets = yearTargets.filter((t) => t.month === month && (allReps || t.salespersonId === session.userId));
  const reps = allReps ? config.salespeople : config.salespeople.filter((s) => s.id === session.userId);

  return (
    <MonthlyTargetsClient
      month={month}
      year={year}
      years={[currentYear - 2, currentYear - 1, currentYear, currentYear + 1]}
      reps={reps}
      visits={visits}
      targets={targets}
    />
  );
}
