'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { useConfig } from '@/context/ConfigContext';
import { deleteRoute, saveRoute } from '@/actions/routes';
import { WEEKDAY_LABELS } from '@/lib/domain/routes';
import type { RepCompliance, RouteDTO } from '@/lib/types';

interface CustomerChoice {
  id: string;
  name: string;
  area: string;
  salespersonId: string | null;
}

interface RoutesClientProps {
  routes: RouteDTO[];
  thisWeek: RepCompliance[];
  last4Weeks: RepCompliance[];
  customers: CustomerChoice[];
  today: string;
  weekStart: string;
  canEdit: boolean;
}

export default function RoutesClient({ routes: initial, thisWeek, last4Weeks, customers, today, weekStart, canEdit }: RoutesClientProps) {
  const router = useRouter();
  const [routes, setRoutes] = useState(initial);
  useEffect(() => setRoutes(initial), [initial]);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [editing, setEditing] = useState<RouteDTO | 'new' | null>(null);
  const [openMissed, setOpenMissed] = useState<string | null>(null);
  const compliance = period === 'week' ? thisWeek : last4Weeks;

  const saved = (list: RouteDTO[], message: string) => {
    setRoutes(list);
    setEditing(null);
    toast.success(message);
    router.refresh();
  };

  const th = 'px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold';

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-screen-2xl mx-auto space-y-6">
      <Toaster position="bottom-right" richColors />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Routes &amp; Visit Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Each route is a list of customers visited on a weekday, weekly or every other week. Reps see today&apos;s route on Daily Sales Entry.
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setEditing('new')} className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg">
            New Route
          </button>
        )}
      </div>

      <section className="bg-card border border-border rounded-xl">
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-sm">Visit compliance — planned stops visited on the planned day</h2>
          <div className="flex gap-1">
            {(
              [
                ['week', `This week (from ${weekStart})`],
                ['month', 'Last 4 weeks'],
              ] as const
            ).map(([v, l]) => (
              <button key={v} onClick={() => setPeriod(v)} className={`px-3 py-1 text-xs rounded-lg border ${period === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className={`${th} text-left`}>Rep</th>
              <th className={`${th} text-right`}>Planned</th>
              <th className={`${th} text-right`}>Visited</th>
              <th className={`${th} text-right`}>Compliance</th>
              <th className={`${th} text-right`}>Off-route visits</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {compliance.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No routes planned yet.
                </td>
              </tr>
            )}
            {compliance.map((c) => (
              <React.Fragment key={c.salespersonId}>
                <tr>
                  <td className="px-3 py-2 font-medium">{c.salesperson}</td>
                  <td className="px-3 py-2 text-right font-tabular">{c.planned}</td>
                  <td className="px-3 py-2 text-right font-tabular">{c.visited}</td>
                  <td className={`px-3 py-2 text-right font-tabular font-semibold ${c.pct < 70 ? 'text-negative' : c.pct < 90 ? 'text-warning' : 'text-positive'}`}>
                    {c.planned ? `${c.pct}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-tabular text-muted-foreground">{c.offRoute}</td>
                  <td className="px-3 py-2 text-right">
                    {c.missed.length > 0 && (
                      <button onClick={() => setOpenMissed(openMissed === c.salespersonId ? null : c.salespersonId)} className="text-xs underline">
                        {openMissed === c.salespersonId ? 'Hide' : `${c.missed.length} missed`}
                      </button>
                    )}
                  </td>
                </tr>
                {openMissed === c.salespersonId && (
                  <tr>
                    <td colSpan={6} className="px-3 pb-3">
                      <ul className="text-xs text-muted-foreground columns-1 sm:columns-2 lg:columns-3">
                        {c.missed.map((m, i) => (
                          <li key={i}>
                            {m.date} · {m.customerName} ({m.routeName}){m.date === today ? ' — today' : ''}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Routes</h2>
        {routes.length === 0 && <p className="text-sm text-muted-foreground">No routes yet.</p>}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {routes.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.salesperson} · {WEEKDAY_LABELS[r.weekday]} · {r.frequency === 'WEEKLY' ? 'every week' : `every 2 weeks from ${r.startDate}`}
                  </p>
                </div>
                {canEdit && (
                  <button onClick={() => setEditing(r)} className="text-xs underline self-start">
                    Edit
                  </button>
                )}
              </div>
              <ol className="text-sm list-decimal list-inside">
                {r.customers.map((c) => (
                  <li key={c.id}>
                    {c.name} <span className="text-muted-foreground">· {c.area}</span>
                  </li>
                ))}
              </ol>
              {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
            </div>
          ))}
        </div>
      </section>

      {editing && (
        <RouteEditor
          route={editing === 'new' ? null : editing}
          customers={customers}
          today={today}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}

function RouteEditor({
  route,
  customers,
  today,
  onClose,
  onSaved,
}: {
  route: RouteDTO | null;
  customers: CustomerChoice[];
  today: string;
  onClose: () => void;
  onSaved: (routes: RouteDTO[], message: string) => void;
}) {
  const { config } = useConfig();
  const [name, setName] = useState(route?.name ?? '');
  const [salespersonId, setSalespersonId] = useState(route?.salespersonId ?? config.salespeople[0]?.id ?? '');
  const [weekday, setWeekday] = useState(route?.weekday ?? 1);
  const [frequency, setFrequency] = useState<'WEEKLY' | 'BIWEEKLY'>(route?.frequency ?? 'WEEKLY');
  const [startDate, setStartDate] = useState(route?.startDate ?? today);
  const [notes, setNotes] = useState(route?.notes ?? '');
  const [stops, setStops] = useState<string[]>(route?.customers.map((c) => c.id) ?? []);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // A route can only contain the rep's own customers or unassigned ones
  const eligible = customers.filter((c) => !c.salespersonId || c.salespersonId === salespersonId);
  const byId = new Map(customers.map((c) => [c.id, c]));
  const available = eligible.filter(
    (c) => !stops.includes(c.id) && (!filter || `${c.name} ${c.area}`.toLowerCase().includes(filter.toLowerCase()))
  );
  const move = (i: number, d: -1 | 1) =>
    setStops((s) => {
      const next = [...s];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  const run = async (action: () => ReturnType<typeof saveRoute>, message: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await action();
      if (!res.success) return setError(res.error);
      onSaved(res.data ?? [], message);
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'w-full border border-border rounded-lg px-3 py-2 text-sm bg-background';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center justify-between z-10">
          <h2 className="font-semibold">{route ? `Edit ${route.name}` : 'New Route'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Name</label>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Remera Monday" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Rep</label>
              <select
                className={inputClass}
                value={salespersonId}
                onChange={(e) => {
                  setSalespersonId(e.target.value);
                  setStops((s) => s.filter((id) => !byId.get(id)?.salespersonId || byId.get(id)?.salespersonId === e.target.value));
                }}
              >
                {config.salespeople.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Day</label>
              <select className={inputClass} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                {WEEKDAY_LABELS.slice(1).map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">How often</label>
              <select className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value as 'WEEKLY' | 'BIWEEKLY')}>
                <option value="WEEKLY">Every week</option>
                <option value="BIWEEKLY">Every 2 weeks</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Starts</label>
              <input className={inputClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold mb-1">Notes</label>
              <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold mb-1">Stops in visit order ({stops.length})</p>
              <ol className="border border-border rounded-lg divide-y divide-border min-h-[120px]">
                {stops.map((id, i) => (
                  <li key={id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="w-5 text-muted-foreground">{i + 1}.</span>
                    <span className="flex-1">
                      {byId.get(id)?.name} <span className="text-muted-foreground">· {byId.get(id)?.area}</span>
                    </span>
                    <button disabled={i === 0} onClick={() => move(i, -1)} className="p-1 disabled:opacity-30" aria-label="Move up">
                      <ArrowUp size={13} />
                    </button>
                    <button disabled={i === stops.length - 1} onClick={() => move(i, 1)} className="p-1 disabled:opacity-30" aria-label="Move down">
                      <ArrowDown size={13} />
                    </button>
                    <button onClick={() => setStops((s) => s.filter((x) => x !== id))} className="p-1 text-negative" aria-label="Remove">
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">Add customers (this rep&apos;s and unassigned)</p>
              <input className={`${inputClass} mb-2`} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name or area" />
              <div className="border border-border rounded-lg divide-y divide-border max-h-[280px] overflow-y-auto">
                {available.map((c) => (
                  <button key={c.id} onClick={() => setStops((s) => [...s, c.id])} className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/40">
                    + {c.name} <span className="text-muted-foreground">· {c.area}</span>
                  </button>
                ))}
                {available.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">No more customers.</p>}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-negative bg-negative-bg border border-negative/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-between gap-2 pt-2 border-t border-border">
            {route ? (
              <button
                disabled={busy}
                onClick={() => window.confirm(`Remove route "${route.name}"?`) && run(() => deleteRoute(route.id), 'Route removed')}
                className="px-4 py-2 text-sm border border-negative/40 text-negative rounded-lg"
              >
                Remove route
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg">
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  run(
                    () => saveRoute({ id: route?.id, name, salespersonId, weekday, frequency, startDate, notes, customerIds: stops }),
                    route ? 'Route saved' : 'Route created'
                  )
                }
                className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
              >
                {busy ? 'Saving...' : 'Save route'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
