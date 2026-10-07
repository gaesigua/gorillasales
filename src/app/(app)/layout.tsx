import React from 'react';
import AppLayout from '@/components/AppLayout';
import { ConfigProvider } from '@/context/ConfigContext';
import { UserProvider } from '@/context/UserContext';
import { requirePageSession } from '@/lib/tenant';
import { getAppConfig } from '@/lib/data/config';

// Every page in this group shows live, per-user data
export const dynamic = 'force-dynamic';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();
  const config = await getAppConfig(session);
  const user = {
    id: session.userId,
    name: session.name,
    email: session.email,
    role: session.role,
    initials: session.initials,
    organizationName: session.organizationName,
  };

  return (
    <UserProvider user={user}>
      <ConfigProvider config={config}>
        <AppLayout>{children}</AppLayout>
      </ConfigProvider>
    </UserProvider>
  );
}
