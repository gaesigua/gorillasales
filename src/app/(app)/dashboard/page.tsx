import { requirePageSession } from '@/lib/tenant';
import { getDashboardData } from '@/lib/data/performance';
import DashboardClient from './components/DashboardClient';

export default async function DashboardPage() {
  const session = await requirePageSession();
  const data = await getDashboardData(session);
  return <DashboardClient data={data} />;
}
