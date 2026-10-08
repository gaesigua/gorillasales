'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { useOffline } from '@/context/OfflineContext';
import { logoutAction } from '@/actions/auth';
import { ROLE_LABELS, WAREHOUSE_ROLES, type Role } from '@/lib/roles';
import { APP_VERSION, COMPANY } from '@/lib/company';
import BrandMark from '@/components/brand/BrandMark';

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
  const offline = useOffline();
  const tabs = TABS.filter((t) => !t.roles || t.roles.includes(currentUser.role));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-brand text-white border-b-4 border-gold">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5">
          <div className="flex items-center gap-2.5">
            <Link href="/dashboard" className="flex items-center gap-2.5 text-white no-underline font-bold text-lg">
              <BrandMark size={32} />
              GorillaSales
            </Link>
            <span className="hidden text-sm text-gray-300 sm:inline">{currentUser.organizationName}</span>
          </div>
          <div className="text-sm">
            <span>
              {currentUser.name} ({ROLE_LABELS[currentUser.role]})
            </span>
            <span className="mx-2">|</span>
            <button
              type="button"
              onClick={async () => {
                const unsent = offline.queued.length;
                if (
                  unsent > 0 &&
                  !window.confirm(
                    `${unsent} visit${unsent === 1 ? ' has' : 's have'} not been sent yet. Logging out deletes ${unsent === 1 ? 'it' : 'them'} from this phone. Log out anyway?`
                  )
                ) {
                  return;
                }
                // Customer data and unsent visits must not stay on a shared phone
                await offline.clearDevice();
                try {
                  await logoutAction();
                } finally {
                  window.location.href = '/login';
                }
              }}
              className="text-white underline"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-gold-pale border-b border-border px-2 pt-2" aria-label="Main">
        <ul className="flex gap-1 overflow-x-auto sm:flex-wrap sm:overflow-visible">
          {tabs.map((t) => {
            const active = isActive(t.href);
            return (
              <li key={t.href} className="shrink-0">
                <Link
                  href={t.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block whitespace-nowrap px-3 py-1.5 text-sm border border-b-0 border-border no-underline -mb-px ${
                    active ? 'bg-white text-black font-bold border-t-2 border-t-brand' : 'bg-gold-soft text-link hover:bg-white'
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <OfflineStatusBar />

      <main>{children}</main>

      <footer className="no-print mt-8 border-t-4 border-gold bg-[#ececec] px-4 py-2 text-xs">
        <p>
          <Link href="/help">Help &amp; working offline</Link> | <Link href="/help#contacts">Contact your administrator</Link> |{' '}
          <a href={COMPANY.website}>gorillascoffee.com</a>
        </p>
        <p className="mt-1 text-muted-foreground">
          GorillaSales version {APP_VERSION} · {currentUser.organizationName} · © {new Date().getFullYear()} {COMPANY.name}
        </p>
      </footer>
    </div>
  );
}

/** One line under the tabs while offline, or while visits saved on this phone are waiting. */
function OfflineStatusBar() {
  const { online, queued, syncing, notice, needsSignIn, syncNow } = useOffline();
  const waiting = queued.filter((v) => v.status === 'waiting').length;
  const rejected = queued.length - waiting;
  if (online && queued.length === 0 && !notice) return null;

  const alert = !online || rejected > 0 || needsSignIn;
  return (
    <div
      role="status"
      className={`no-print border-b px-4 py-1.5 text-sm ${alert ? 'bg-warning-bg border-warning' : 'bg-muted border-border'}`}
    >
      {!online && <strong>No connection. </strong>}
      {!online && 'Visits you log are kept on this phone and sent when the connection returns. '}
      {waiting > 0 && (
        <>
          {waiting} visit{waiting === 1 ? '' : 's'} waiting to be sent.{' '}
          {online && !needsSignIn && (
            <button type="button" onClick={syncNow} disabled={syncing} className="text-link underline">
              {syncing ? 'Sending...' : 'Send now'}
            </button>
          )}{' '}
        </>
      )}
      {needsSignIn && (
        <>
          Your session has ended: <a href="/login?from=/daily-sales-entry">sign in again</a> to send them.{' '}
        </>
      )}
      {rejected > 0 && (
        <>
          {rejected} visit{rejected === 1 ? '' : 's'} could not be accepted — <Link href="/daily-sales-entry">see Visits</Link>.{' '}
        </>
      )}
      {online && notice && queued.length === 0 && notice}
    </div>
  );
}
