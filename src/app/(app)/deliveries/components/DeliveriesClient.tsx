'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { useUser } from '@/context/UserContext';
import { canManageWarehouse } from '@/lib/roles';
import { formatRWFFull } from '@/lib/format';
import { DELIVERY_RUN_STATUS_LABELS, PAYMENT_METHOD_LABELS, type DeliveryRunDTO, type Order } from '@/lib/types';
import PlanRunModal from './PlanRunModal';
import RunDetail from './RunDetail';

interface DeliveriesClientProps {
  runs: DeliveryRunDTO[];
  queue: Order[];
  drivers: { id: string; name: string }[];
  today: string;
}

export default function DeliveriesClient({ runs: initialRuns, queue, drivers, today }: DeliveriesClientProps) {
  const router = useRouter();
  const { currentUser } = useUser();
  const planner = canManageWarehouse(currentUser.role);
  const [runs, setRuns] = useState(initialRuns);
  useEffect(() => setRuns(initialRuns), [initialRuns]);
  const [selectedId, setSelectedId] = useState<string | null>(initialRuns.find((r) => r.status === 'DISPATCHED')?.id ?? null);
  const [planning, setPlanning] = useState<DeliveryRunDTO | 'new' | null>(null);
  const selected = runs.find((r) => r.id === selectedId) ?? null;

  const updated = (run: DeliveryRunDTO, message: string) => {
    setRuns((prev) => (prev.some((r) => r.id === run.id) ? prev.map((r) => (r.id === run.id ? run : r)) : [run, ...prev]));
    setSelectedId(run.id);
    toast.success(message);
    router.refresh();
  };

  const shortQueue = queue.filter((o) => o.stockShort && o.stockShort.length > 0).length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-screen-2xl mx-auto space-y-5">
      <Toaster position="bottom-right" richColors />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{planner ? 'Delivery Runs' : 'My Deliveries'}</h1>
          {planner && (
            <p className="text-sm text-muted-foreground mt-1">
              {queue.length} confirmed order(s) waiting for a run{shortQueue > 0 ? ` · ${shortQueue} short of stock` : ''}
            </p>
          )}
        </div>
        {planner && (
          <button
            onClick={() => setPlanning('new')}
            disabled={queue.length === 0}
            className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
          >
            Plan Delivery Run
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,380px)_1fr] gap-5 items-start">
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {runs.length === 0 && <p className="p-6 text-sm text-center text-muted-foreground">No delivery runs in the last 30 days.</p>}
          {runs.map((r) => {
            const delivered = r.stops.filter((s) => s.status === 'DELIVERED').length;
            const collected = r.collections.reduce((s, c) => s + c.amount, 0);
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/40 ${selectedId === r.id ? 'bg-muted/60' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold">{r.runNumber}</span>
                  <span className={`text-xs font-semibold ${r.status === 'DISPATCHED' ? 'text-info' : r.status === 'CANCELLED' ? 'text-negative' : 'text-muted-foreground'}`}>
                    {DELIVERY_RUN_STATUS_LABELS[r.status]}
                  </span>
                </div>
                <p className="text-sm">
                  {r.runDate} · {r.driverName}
                  {r.vehicle ? ` · ${r.vehicle}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {delivered}/{r.stops.length} delivered
                  {collected > 0 && ` · collected ${formatRWFFull(collected)}`}
                </p>
              </button>
            );
          })}
        </div>

        {selected ? (
          <RunDetail
            key={selected.id + selected.status}
            run={selected}
            today={today}
            planner={planner}
            onUpdated={updated}
            onEditStops={() => setPlanning(selected)}
          />
        ) : (
          <div className="bg-card border border-border rounded-xl p-8 text-sm text-center text-muted-foreground">
            Select a run to see its stops, picking list and collections.
          </div>
        )}
      </div>

      {planning && (
        <PlanRunModal
          run={planning === 'new' ? null : planning}
          queue={queue}
          drivers={drivers}
          today={today}
          onClose={() => setPlanning(null)}
          onSaved={(run, message) => {
            setPlanning(null);
            updated(run, message);
          }}
        />
      )}
    </div>
  );
}

export function CollectionsSummary({ run }: { run: DeliveryRunDTO }) {
  if (run.collections.length === 0) return <p className="text-sm text-muted-foreground">Nothing collected on this run.</p>;
  const total = run.collections.reduce((s, c) => s + c.amount, 0);
  return (
    <table className="text-sm">
      <tbody>
        {run.collections.map((c) => (
          <tr key={c.method}>
            <td className="pr-6 py-0.5">{PAYMENT_METHOD_LABELS[c.method]}</td>
            <td className="text-right font-tabular">{formatRWFFull(c.amount)}</td>
          </tr>
        ))}
        <tr className="font-semibold border-t border-border">
          <td className="pr-6 py-0.5">Total collected</td>
          <td className="text-right font-tabular">{formatRWFFull(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}
