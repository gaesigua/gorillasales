import { MANAGER_ROLES, requirePageSession } from '@/lib/tenant';
import { listCommissionRules, listMonthlyTargets } from '@/lib/data/config';
import ConfigAdminClient from './components/ConfigAdminClient';

export default async function ConfigPage() {
  const session = await requirePageSession(MANAGER_ROLES);
  const [targets, commissionRules] = await Promise.all([listMonthlyTargets(session), listCommissionRules(session)]);
  return <ConfigAdminClient targets={targets} commissionRules={commissionRules} />;
}
