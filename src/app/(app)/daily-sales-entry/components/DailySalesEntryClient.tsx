'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import SalesEntryForm from './SalesEntryForm';
import RecentEntriesTable from './RecentEntriesTable';
import { ClipboardList, TrendingUp, ChevronDown } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { useConfig } from '@/context/ConfigContext';
import { deleteVisitLog } from '@/actions/visits';
import { isOrder } from '@/lib/visitRules';
import type { CustomerOption, PriceBook, VisitLog } from '@/lib/types';

export type { CustomerOption, PriceBook };

interface DailySalesEntryClientProps {
  visits: VisitLog[];
  customers: CustomerOption[];
  priceBook: PriceBook;
  today: string;
}

export default function DailySalesEntryClient({ visits, customers, priceBook, today }: DailySalesEntryClientProps) {
  const router = useRouter();
  const { currentUser, canViewAllReps } = useUser();
  const { config } = useConfig();
  const [selectedRepId, setSelectedRepId] = useState<string>('');

  // Sales officers only ever receive their own visits from the server
  const visibleEntries = useMemo(
    () => (selectedRepId ? visits.filter((e) => e.salespersonId === selectedRepId) : visits),
    [visits, selectedRepId]
  );
  const selectedRepName = config.salespeople.find((s) => s.id === selectedRepId)?.label;

  const todayEntries = visibleEntries.filter((e) => e.dateOfVisit === today);
  const todaySales = todayEntries.reduce((s, e) => s + e.salesValue, 0);
  const todayOrders = todayEntries.filter(isOrder).length;

  const handleDelete = async (id: string) => {
    const res = await deleteVisitLog(id);
    if (res.success) {
      toast.success('Visit deleted');
      router.refresh();
    } else {
      toast.error('Could not delete visit', { description: res.error });
    }
  };

  return (
    <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Daily Sales Entry</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {canViewAllReps ? 'Log and review field visit outcomes' : 'Log your field visit outcomes'} — {today}
          </p>
        </div>

        {/* Salesperson selector for managers/admins */}
        {canViewAllReps && (
          <div className="shrink-0">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Viewing Rep</label>
            <div className="relative">
              <select
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-accent/40 pr-8 min-w-[160px]"
              >
                <option value="">All Reps</option>
                {config.salespeople.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* Today's summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ClipboardList size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Visits Today</p>
            <p className="text-2xl font-bold text-foreground font-tabular">{todayEntries.length}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <TrendingUp size={18} className="text-accent" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Sales Today</p>
            <p className="text-2xl font-bold text-foreground font-tabular">
              {todaySales >= 1000000
                ? `RWF ${(todaySales / 1000000).toFixed(2)}M`
                : `RWF ${(todaySales / 1000).toFixed(0)}K`}
            </p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-positive/10 flex items-center justify-center shrink-0">
            <ClipboardList size={18} className="text-positive" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Orders Today</p>
            <p className="text-2xl font-bold text-foreground font-tabular">{todayOrders}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-accent rounded-full" />
          <h2 className="text-base font-semibold text-foreground">Log New Visit</h2>
        </div>
        <SalesEntryForm customers={customers} priceBook={priceBook} today={today} />
      </div>

      {/* Recent entries table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h2 className="text-base font-semibold text-foreground">
              {!canViewAllReps ? 'My Visit Logs' : selectedRepName ? `${selectedRepName.split(' ')[0]}'s Visit Logs` : 'All Visit Logs'}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">{visibleEntries.length} entries</span>
        </div>
        <RecentEntriesTable
          entries={visibleEntries}
          onDelete={handleDelete}
          canDelete={(e) => canViewAllReps || e.salespersonId === currentUser.id}
        />
      </div>
    </div>
  );
}
