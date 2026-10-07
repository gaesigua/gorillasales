import { MANAGER_ROLES, requirePageSession } from '@/lib/tenant';
import { listUsers } from '@/lib/data/users';
import UserManagementClient from './components/UserManagementClient';

export default async function UserManagementPage() {
  const session = await requirePageSession(MANAGER_ROLES);
  const users = await listUsers(session);
  return <UserManagementClient users={users} />;
}
