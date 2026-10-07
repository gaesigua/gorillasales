import { MANAGER_ROLES, requirePageSession } from '@/lib/tenant';
import { listUsers } from '@/lib/data/users';
import SalesManagerClient from './components/SalesManagerClient';

export default async function SalesManagerPage() {
  const session = await requirePageSession(MANAGER_ROLES);
  const users = await listUsers(session);
  return <SalesManagerClient users={users} />;
}
