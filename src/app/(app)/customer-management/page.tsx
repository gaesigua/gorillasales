import { requirePageSession } from '@/lib/tenant';
import { listCustomers } from '@/lib/data/customers';
import { listVisits } from '@/lib/data/visits';
import { todayKigali } from '@/lib/dates';
import CustomerTableClient from './components/CustomerTableClient';

export const metadata = { title: 'Customers' };

export default async function CustomerManagementPage() {
  const session = await requirePageSession();
  const today = todayKigali();
  // Weekly export offers this week and the three before it
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 35 * 86400000).toISOString().slice(0, 10);

  const [customers, recentVisits] = await Promise.all([
    listCustomers(session),
    listVisits(session, { from }),
  ]);

  return <CustomerTableClient customers={customers} recentVisits={recentVisits} today={today} />;
}
