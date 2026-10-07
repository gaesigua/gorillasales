'use client';

import React, { useState } from 'react';
import { useConfig } from '@/context/ConfigContext';
import { createDeliveryRun, setRunStops } from '@/actions/deliveries';
import { formatRWFFull } from '@/lib/format';
import type { DeliveryRunDTO, Order } from '@/lib/types';

interface PlanRunModalProps {
  /** Existing planned run to change, or null for a new run. */
  run: DeliveryRunDTO | null;
  queue: Order[];
  drivers: { id: string; name: string }[];
  today: string;
  onClose: () => void;
  onSaved: (run: DeliveryRunDTO, message: string) => void;
}

export default function PlanRunModal({ run, queue, drivers, today, onClose, onSaved }: PlanRunModalProps) {
  const { config } = useConfig();
  const candidates = [...(run?.stops ?? []), ...queue];
  const [selected, setSelected] = useState<Set<string>>(new Set(run?.stops.map((s) => s.id) ?? []));
  const [runDate, setRunDate] = useState(today);
  const [warehouseId, setWarehouseId] = useState(config.warehouses.find((w) => w.isDefault)?.id ?? config.warehouses[0]?.id ?? '');
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? '');
  const [vehicle, setVehicle] = useState('');
  const [notes, setNotes] = useState('');
  const [area, setArea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const areas = [...new Set(candidates.map((o) => o.area))].sort();
  const shown = candidates.filter((o) => !area || o.area === area);
  const chosen = candidates.filter((o) => selected.has(o.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const orderIds = [...selected];
      const res = run
        ? await setRunStops(run.id, orderIds)
        : await createDeliveryRun({ runDate, warehouseId, driverId, vehicle, notes, orderIds });
      if (!res.success) return setError(res.error);
      if (res.data) onSaved(res.data, run ? `${run.runNumber} updated` : `${res.data.runNumber} planned`);
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
          <h2 className="font-semibold">{run ? `Change stops — ${run.runNumber}` : 'Plan Delivery Run'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Close">
            Close
          </button>
        </div>
        <div className="p-5 space-y-4">
          {!run && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Date</label>
                <input type="date" min={today} className={inputClass} value={runDate} onChange={(e) => setRunDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Load from</label>
                <select className={inputClass} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  {config.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Driver</label>
                <select className={inputClass} value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                  {drivers.length === 0 && <option value="">No drivers — add one in User Management</option>}
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Vehicle</label>
                <input className={inputClass} value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="e.g. RAD 123 B" />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Orders</span>
            <select className="border border-border rounded-lg px-2 py-1 text-sm bg-background" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">All areas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button onClick={() => setSelected(new Set([...selected, ...shown.map((o) => o.id)]))} className="text-xs underline">
              Select all shown
            </button>
            <span className="ml-auto text-sm">
              {chosen.length} stop(s) · {formatRWFFull(chosen.reduce((s, o) => s + o.total, 0))}
            </span>
          </div>

          <div className="border border-border rounded-lg divide-y divide-border max-h-[45vh] overflow-y-auto">
            {shown.length === 0 && <p className="p-4 text-sm text-muted-foreground">No confirmed orders waiting.</p>}
            {shown.map((o) => {
              const short = o.stockShort && o.stockShort.length > 0;
              return (
                <label key={o.id} className="flex items-start gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                  <input type="checkbox" className="mt-1" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <span>
                        <span className="font-mono">{o.orderNumber}</span> · <strong>{o.customerName}</strong> · {o.area}
                      </span>
                      <span className="font-tabular">{formatRWFFull(o.total)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {o.orderDate} · {o.lines.map((l) => `${l.productName} ×${l.quantity}`).join(', ')}
                      {o.deliveryFailedReason && ` · last attempt failed: ${o.deliveryFailedReason}`}
                    </p>
                    {short && (
                      <p className="text-xs text-negative">
                        Short of stock: {o.stockShort!.map((s) => `${s.productName} (${s.missing})`).join(', ')}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {!run && (
            <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for the driver (optional)" />
          )}
          <p className="text-xs text-muted-foreground">
            Stock is taken from the warehouse when the run is dispatched, oldest batches first. Dispatch is refused if any
            product is short.
          </p>
          {error && <p className="text-sm text-negative bg-negative-bg border border-negative/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy || selected.size === 0}
              className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {busy ? 'Saving...' : run ? 'Save stops' : 'Plan run'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
