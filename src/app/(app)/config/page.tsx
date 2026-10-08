import { MANAGER_ROLES, requirePageSession } from '@/lib/tenant';
import { listCommissionRules, listMonthlyTargets, listPriceLists } from '@/lib/data/config';
import ConfigAdminClient from './components/ConfigAdminClient';

export const metadata = { title: 'Setup' };

export default async function ConfigPage() {
  const session = await requirePageSession(MANAGER_ROLES);
  const [targets, commissionRules, priceLists] = await Promise.all([
    listMonthlyTargets(session),
    listCommissionRules(session),
    listPriceLists(session),
  ]);
  return <ConfigAdminClient targets={targets} commissionRules={commissionRules} priceLists={priceLists} />;
}
