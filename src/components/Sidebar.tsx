'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  SlidersHorizontal,
  UserCog,
  BarChart2,
  Kanban,
  TrendingUp,
  ShieldCheck,
  ShoppingCart,
  Wallet,
  Truck,
  Package,
  Map as MapIcon,
} from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { ROLE_LABELS, WAREHOUSE_ROLES, type Role } from '@/lib/roles';
import { logoutAction } from '@/actions/auth';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  managerOnly?: boolean;
  /** Only shown to these roles (when set). */
  roles?: Role[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard size={20} />,
  },
  {
    label: 'Daily Sales Entry',
    href: '/daily-sales-entry',
    icon: <ClipboardList size={20} />,
  },
  {
    label: 'Orders',
    href: '/orders',
    icon: <ShoppingCart size={20} />,
  },
  {
    label: 'Deliveries',
    href: '/deliveries',
    icon: <Truck size={20} />,
    roles: [...WAREHOUSE_ROLES, 'DRIVER'],
  },
  {
    label: 'Receivables',
    href: '/receivables',
    icon: <Wallet size={20} />,
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: <Package size={20} />,
  },
  {
    label: 'Routes',
    href: '/routes',
    icon: <MapIcon size={20} />,
    roles: ['ADMIN', 'MANAGER', 'SALES_OFFICER'],
  },
  {
    label: 'Customer Management',
    href: '/customer-management',
    icon: <Users size={20} />,
  },
  {
    label: 'Sales Pipeline',
    href: '/sales-pipeline',
    icon: <Kanban size={20} />,
  },
  {
    label: 'Monthly Targets',
    href: '/monthly-targets',
    icon: <TrendingUp size={20} />,
  },
  {
    label: 'Team Management',
    href: '/manager',
    icon: <UserCog size={20} />,
    managerOnly: true,
  },
  {
    label: 'Monthly Report',
    href: '/monthly-report',
    icon: <BarChart2 size={20} />,
  },
  {
    label: 'Config & Master Lists',
    href: '/config',
    icon: <SlidersHorizontal size={20} />,
    managerOnly: true,
  },
  {
    label: 'User Management',
    href: '/user-management',
    icon: <ShieldCheck size={20} />,
    managerOnly: true,
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { currentUser, canViewAllReps } = useUser();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const visibleNavItems = navItems.filter((item) => {
    if (item.managerOnly && !canViewAllReps) return false;
    if (item.roles && !item.roles.includes(currentUser.role)) return false;
    return true;
  });

  return (
    <aside
      className={`relative flex flex-col h-screen bg-primary border-r border-primary/20 sidebar-transition overflow-hidden ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div
        className={`flex items-center border-b border-primary-foreground/10 ${
          collapsed ? 'justify-center px-0 py-4' : 'px-5 py-4 gap-3'
        }`}
      >
        <AppLogo size={32} />
        {!collapsed && (
          <span className="font-semibold text-primary-foreground text-base tracking-tight truncate">
            GorillaSales
          </span>
        )}
      </div>

      {/* Signed-in user */}
      {!collapsed && (
        <div className="mx-3 mt-3 mb-1 px-3 py-2 rounded-lg bg-primary-foreground/10 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white shrink-0">
            {currentUser.initials}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-primary-foreground text-xs font-semibold truncate">{currentUser.name}</p>
            <p className="text-primary-foreground/60 text-[11px] truncate">{ROLE_LABELS[currentUser.role]}</p>
          </div>
        </div>
      )}

      {/* Nav section label */}
      {!collapsed && (
        <p className="px-4 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/40">
          Main Menu
        </p>
      )}

      {/* Nav Items */}
      <nav className="flex-1 px-2 py-1 flex flex-col gap-0.5 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={`nav-${item.href}`}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                active
                  ? 'bg-accent text-white font-semibold shadow-sm'
                  : 'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground'
              } ${collapsed ? 'justify-center px-2' : ''}`}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && (
                <span className="text-sm truncate">{item.label}</span>
              )}
              {!collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto bg-negative text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
              {collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-negative rounded-full" />
              )}
              {/* Tooltip for collapsed */}
              {collapsed && (
                <span className="absolute left-full ml-3 bg-foreground text-primary-foreground text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav */}
      {!collapsed && (
        <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/40">
          System
        </p>
      )}
      <div className="px-2 pb-2 flex flex-col gap-0.5">
        <button
          onClick={async () => {
            await logoutAction();
            window.location.href = '/login';
          }}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 text-primary-foreground/50 hover:bg-negative/20 hover:text-negative group w-full text-left ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span className="text-sm">Sign Out</span>}
          {collapsed && (
            <span className="absolute left-full ml-3 bg-foreground text-primary-foreground text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              Sign Out
            </span>
          )}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors z-10"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight size={12} className="text-muted-foreground" />
        ) : (
          <ChevronLeft size={12} className="text-muted-foreground" />
        )}
      </button>
    </aside>
  );
}