'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { logoutAction } from '@/actions/auth';
import { ROLE_LABELS, WAREHOUSE_ROLES, type Role } from '@/lib/roles';

interface Tab {
  label: string;
  href: string;
  /** Only shown to these roles; all roles when omitted. */
  roles?: Role[];
}

const MANAGERS: Role[] = ['ADMIN', 'MANAGER'];

const TABS: Tab[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Visits', href: '/daily-sales-entry' },
  { label: 'Orders', href: '/orders' },
  { label: 'Deliveries', href: '/deliveries', roles: [...WAREHOUSE_ROLES, 'DRIVER'] },
  { label: 'Receivables', href: '/receivables' },
  { label: 'Inventory', href: '/inventory' },
  { label: 'Customers', href: '/customer-management' },
  { label: 'Routes', href: '/routes', roles: ['ADMIN', 'MANAGER', 'SALES_OFFICER'] },
  { label: 'Pipeline', href: '/sales-pipeline' },
  { label: 'Targets', href: '/monthly-targets' },
  { label: 'Reports', href: '/monthly-report' },
  { label: 'Team', href: '/manager', roles: MANAGERS },
  { label: 'Users', href: '/user-management', roles: MANAGERS },
  { label: 'Setup', href: '/config', roles: MANAGERS },
];

/** Classic application shell: brown header strip, a row of text tabs, then the page. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser } = useUser();
  const tabs = TABS.filter((t) => !t.roles || t.roles.includes(currentUser.role));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-brand text-white">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <div>
            <Link href="/dashboard" className="text-white no-underline font-bold text-lg">
              GorillaSales
            </Link>
            <span className="ml-3 text-sm text-white/80">{currentUser.organizationName}</span>
          </div>
          <div className="text-sm">
            <span>
              {currentUser.name} ({ROLE_LABELS[currentUser.role]})
            </span>
            <span className="mx-2">|</span>
            <button
              type="button"
              onClick={async () => {
                await logoutAction();
                window.location.href = '/login';
              }}
              className="text-white underline"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-brand-light border-b border-border px-2 pt-2" aria-label="Main">
        <ul className="flex gap-1 overflow-x-auto sm:flex-wrap sm:overflow-visible">
          {tabs.map((t) => {
            const active = isActive(t.href);
            return (
              <li key={t.href} className="shrink-0">
                <Link
                  href={t.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block whitespace-nowrap px-3 py-1.5 text-sm border border-b-0 border-border no-underline -mb-px ${
                    active ? 'bg-white text-black font-bold' : 'bg-[#e9e2d8] text-link hover:bg-white'
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main>{children}</main>

      <footer className="no-print border-t border-border mt-8 px-4 py-3 text-xs text-muted-foreground">
        GorillaSales · {currentUser.organizationName}
      </footer>
    </div>
  );
}
