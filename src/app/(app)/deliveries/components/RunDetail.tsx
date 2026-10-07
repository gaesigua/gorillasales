'use client';

import React, { useState } from 'react';
import { Phone } from 'lucide-react';
import { cancelRun, completeRun, deliverStop, dispatchRun, failStop } from '@/actions/deliveries';
import { formatRWFFull } from '@/lib/format';
import { DELIVERY_RUN_STATUS_LABELS, PAYMENT_METHOD_LABELS, type ActionResult, type DeliveryRunDTO, type Order, type PaymentMethodValue } from '@/lib/types';
import { CollectionsSummary } from './DeliveriesClient';

interface RunDetailProps {
  run: DeliveryRunDTO;
  today: string;
  planner: boolean;
  onUpdated: (run: DeliveryRunDTO, message: string) => void;
  onEditStops: () => void;
}

export default function RunDetail({ run, today, planner, onUpdated, onEditStops }: RunDetailProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run_(action: () => Promise<ActionResult<DeliveryRunDTO>>, message: string) {
    setBusy(true);
    setError('');
    try {
      const res = await action();
      if (!res.success) return setError(res.error);
      if (res.data) onUpdated(res.data, message);
    } finally {
      setBusy(false);
    }
  }

  const shortPicking = run.picking.filter((p) => p.short > 0);
  const pending = run.stops.filter((s) => s.status === 'CONFIRMED' && !s.deliveryFailedReason).length;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold font-mono">{run.runNumber}</h2>
            <p className="text-sm text-muted-foreground">
              {run.runDate} · {run.driverName}
              {run.vehicle && ` · ${run.vehicle}`} · from {run.warehouseName} · {DELIVERY_RUN_STATUS_LABELS[run.status]}
            </p>
            {run.notes && <p className="text-sm mt-1">Notes: {run.notes}</p>}
          </div>
          {planner && (
            <div className="flex flex-wrap gap-2">
              {run.status === 'PLANNED' && (
                <>
                  <button onClick={onEditStops} className="px-3 py-1.5 text-sm border border-border rounded-lg">
                    Change stops
                  </button>
                  <button
                    disabled={busy || shortPicking.length > 0}
                    onClick={() => run_(() => dispatchRun(run.id), `${run.runNumber} dispatched — stock loaded`)}
                    className="px-3 py-1.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                    title={shortPicking.length ? 'Some products are short' : ''}
                  >
                    Dispatch
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => window.confirm(`Cancel ${run.runNumber}? Its orders go back to the queue.`) && run_(() => cancelRun(run.id), `${run.runNumber} cancelled`)}
                    className="px-3 py-1.5 text-sm border border-negative/40 text-negative rounded-lg"
                  >
                    Cancel run
                  </button>
                </>
              )}
              {run.status === 'DISPATCHED' && (
                <button
                  disabled={busy || pending > 0}
                  onClick={() => run_(() => completeRun(run.id), `${run.runNumber} completed`)}
                  className="px-3 py-1.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                  title={pending ? `${pending} stop(s) still open` : ''}
                >
                  Complete run
                </button>
              )}
            </div>
          )}
        </div>
        {error && <p className="text-sm text-negative bg-negative-bg border border-negative/20 rounded-lg px-3 py-2">{error}</p>}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-2">{run.status === 'PLANNED' ? 'Picking list (oldest batches first)' : 'Loaded on the vehicle'}</h3>
        {run.picking.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {run.picking.map((p) => (
                <tr key={p.productName}>
                  <td className="py-1.5 font-medium">{p.productName}</td>
                  <td className="py-1.5 text-right font-tabular w-20">{p.quantity}</td>
                  <td className="py-1.5 pl-4 text-muted-foreground">
                    {p.batches.map((b) => `${b.batchNumber}: ${b.quantity}`).join(' · ') || '—'}
                    {p.short > 0 && <span className="text-negative font-semibold"> · short by {p.short}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {shortPicking.length > 0 && (
          <p className="text-sm text-negative mt-2">Not enough usable stock to dispatch. Receive or roast more, or remove orders.</p>
        )}
      </div>

      <div className="space-y-3">
        {run.stops.map((stop, i) => (
          <StopCard key={stop.id + stop.status + stop.deliveryFailedReason} index={i + 1} stop={stop} run={run} today={today} busy={busy} onAction={run_} />
        ))}
      </div>

      {(run.status === 'DISPATCHED' || run.status === 'COMPLETED') && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-2">Driver collections (cash-up)</h3>
          <CollectionsSummary run={run} />
        </div>
      )}
    </div>
  );
}

function StopCard({
  index,
  stop,
  run,
  today,
  busy,
  onAction,
}: {
  index: number;
  stop: Order;
  run: DeliveryRunDTO;
  today: string;
  busy: boolean;
  onAction: (action: () => Promise<ActionResult<DeliveryRunDTO>>, message: string) => Promise<void>;
}) {
  const cod = stop.paymentTermsDays === 0;
  const [mode, setMode] = useState<'view' | 'deliver' | 'fail'>('view');
  const [collect, setCollect] = useState(cod);
  const [amount, setAmount] = useState(String(stop.total));
  const [method, setMethod] = useState<PaymentMethodValue>('CASH');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');

  const delivered = stop.status === 'DELIVERED';
  const failed = stop.status === 'CONFIRMED' && !!stop.deliveryFailedReason;
  const canAct = run.status === 'DISPATCHED' && !delivered && !failed;
  const inputClass = 'w-full border border-border rounded-lg px-3 py-2 text-sm bg-background';

  return (
    <div className={`bg-card border rounded-xl p-4 ${delivered ? 'border-positive/40' : failed ? 'border-negative/40' : 'border-border'}`}>
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <p className="font-semibold">
            {index}. {stop.customerName}
          </p>
          <p className="text-sm text-muted-foreground">
            {[stop.customerAddress || stop.area, stop.customerContact].filter(Boolean).join(' · ')}
          </p>
          {stop.customerPhone && (
            <a href={`tel:${stop.customerPhone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 text-sm text-accent underline">
              <Phone size={13} /> {stop.customerPhone}
            </a>
          )}
        </div>
        <div className="text-right">
          <p className="font-mono text-sm">{stop.orderNumber}</p>
          <p className="font-semibold font-tabular">{formatRWFFull(stop.total)}</p>
          <p className={`text-xs ${cod ? 'text-warning font-semibold' : 'text-muted-foreground'}`}>
            {cod ? 'Collect on delivery' : `${stop.paymentTermsDays}-day credit`}
          </p>
        </div>
      </div>
      <p className="text-sm mt-2">{stop.lines.map((l) => `${l.productName} ×${l.quantity}`).join(', ')}</p>
      {delivered && <p className="text-sm text-positive font-semibold mt-2">Delivered · invoice {stop.invoiceNumber}{stop.amountPaid > 0 && ` · paid ${formatRWFFull(stop.amountPaid)}`}</p>}
      {failed && <p className="text-sm text-negative font-semibold mt-2">Not delivered: {stop.deliveryFailedReason}</p>}

      {canAct && mode === 'view' && (
        <div className="flex gap-2 mt-3">
          <button onClick={() => setMode('deliver')} className="flex-1 px-3 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg">
            Delivered
          </button>
          <button onClick={() => setMode('fail')} className="flex-1 px-3 py-2 text-sm border border-negative/40 text-negative rounded-lg">
            Could not deliver
          </button>
        </div>
      )}

      {canAct && mode === 'deliver' && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={collect} onChange={(e) => setCollect(e.target.checked)} /> Payment collected
          </label>
          {collect && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input className={inputClass} type="number" min="0" max={stop.total} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
              <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethodValue)} aria-label="Method">
                {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === 'CASH' ? 'Reference (optional)' : 'Transaction ID'} />
            </div>
          )}
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() =>
                onAction(
                  () => deliverStop(stop.id, { deliveredOn: today, payment: collect ? { amount: Number(amount), method, reference } : undefined }),
                  `${stop.customerName} delivered`
                )
              }
              className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              Confirm delivery
            </button>
            <button onClick={() => setMode('view')} className="px-4 py-2 text-sm border border-border rounded-lg">
              Back
            </button>
          </div>
        </div>
      )}

      {canAct && mode === 'fail' && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? e.g. shop closed, customer refused" />
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => onAction(() => failStop(stop.id, reason), `${stop.customerName} marked not delivered`)}
              className="px-4 py-2 text-sm font-semibold bg-negative text-white rounded-lg disabled:opacity-60"
            >
              Save
            </button>
            <button onClick={() => setMode('view')} className="px-4 py-2 text-sm border border-border rounded-lg">
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
