'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { useConfig } from '@/context/ConfigContext';
import { approveOrder, cancelOrder, deliverOrder } from '@/actions/orders';
import { canDeliverOrders } from '@/lib/roles';
import { formatRWFFull } from '@/lib/format';
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, type Order, type PaymentMethodValue } from '@/lib/types';
import OrderStatusBadge from './OrderStatusBadge';

interface OrderDetailDrawerProps {
  order: Order;
  today: string;
  onClose: () => void;
  onUpdated: (order: Order, message: string) => void;
}

export default function OrderDetailDrawer({ order, today, onClose, onUpdated }: OrderDetailDrawerProps) {
  const { currentUser, canViewAllReps } = useUser();
  const [mode, setMode] = useState<'view' | 'deliver' | 'cancel'>('view');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Deliver form
  const [deliveredOn, setDeliveredOn] = useState(today);
  const [collect, setCollect] = useState(order.paymentTermsDays === 0);
  const [amount, setAmount] = useState(String(order.total));
  const [method, setMethod] = useState<PaymentMethodValue>('CASH');
  const [reference, setReference] = useState('');
  // Cancel form
  const [reason, setReason] = useState('');

  const isOwn = order.salespersonId === currentUser.id;
  const canApprove = canViewAllReps && order.status === 'PENDING_APPROVAL';
  // Orders on a delivery run are delivered from the run
  const canDeliver = canDeliverOrders(currentUser.role) && order.status === 'CONFIRMED' && !order.deliveryRunId;
  const { config } = useConfig();
  const [warehouseId, setWarehouseId] = useState(config.warehouses.find((w) => w.isDefault)?.id ?? config.warehouses[0]?.id ?? '');
  const canCancel = (canViewAllReps || isOwn) && (order.status === 'PENDING_APPROVAL' || order.status === 'CONFIRMED');

  async function run(action: () => Promise<{ success: true; data?: Order } | { success: false; error: string }>, message: string) {
    setBusy(true);
    setError('');
    try {
      const res = await action();
      if (!res.success) return setError(res.error);
      if (res.data) onUpdated(res.data, message);
      setMode('view');
    } finally {
      setBusy(false);
    }
  }

  const inputClass = 'w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card border-l border-border shadow-2xl overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-start justify-between z-10">
          <div>
            <h2 className="text-base font-semibold text-foreground font-mono">{order.orderNumber}</h2>
            <p className="text-sm text-muted-foreground">
              {order.customerName} · {order.orderDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Close">
              Close
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {order.status === 'PENDING_APPROVAL' && (
            <div className="flex gap-2 p-3 rounded-lg bg-warning-bg border border-warning/30 text-sm text-warning">
              
              <div>
                <p className="font-semibold">On credit hold</p>
                <p>{order.holdReason}</p>
              </div>
            </div>
          )}
          {order.status === 'CANCELLED' && order.cancelReason && (
            <p className="text-sm text-negative">Cancelled: {order.cancelReason}</p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Sales rep</dt>
            <dd>{order.salesperson}</dd>
            <dt className="text-muted-foreground">Area</dt>
            <dd>{order.area}</dd>
            <dt className="text-muted-foreground">Payment terms</dt>
            <dd>{order.paymentTermsDays > 0 ? `${order.paymentTermsDays} days` : 'Cash on delivery'}</dd>
            <dt className="text-muted-foreground">Coffee weight</dt>
            <dd>{order.weightKg} KG</dd>
            {order.deliveryRunNumber && (
              <>
                <dt className="text-muted-foreground">Delivery run</dt>
                <dd>
                  <Link href="/deliveries" className="underline font-mono">
                    {order.deliveryRunNumber}
                  </Link>
                </dd>
              </>
            )}
            {order.deliveryFailedReason && order.status === 'CONFIRMED' && (
              <>
                <dt className="text-muted-foreground">Last delivery attempt</dt>
                <dd className="text-negative">{order.deliveryFailedReason}</dd>
              </>
            )}
            {order.stockShort && (
              <>
                <dt className="text-muted-foreground">Stock</dt>
                <dd className={order.stockShort.length ? 'text-negative' : 'text-positive'}>
                  {order.stockShort.length
                    ? `Short: ${order.stockShort.map((s) => `${s.productName} (${s.missing})`).join(', ')}`
                    : 'Covered by current stock'}
                </dd>
              </>
            )}
            {order.invoiceNumber && (
              <>
                <dt className="text-muted-foreground">Invoice</dt>
                <dd>
                  <Link href={`/receivables?q=${order.invoiceNumber}`} className="underline font-mono">
                    {order.invoiceNumber}
                  </Link>{' '}
                  · paid {formatRWFFull(order.amountPaid)}
                </dd>
              </>
            )}
          </dl>

          <table className="w-full text-sm border border-border">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Product</th>
                <th className="text-right px-3 py-2">Qty</th>
                <th className="text-right px-3 py-2">Price</th>
                <th className="text-right px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2">{l.productName}</td>
                  <td className="px-3 py-2 text-right font-tabular">{l.quantity}</td>
                  <td className="px-3 py-2 text-right font-tabular">{l.unitPrice.toLocaleString('en-US')}</td>
                  <td className="px-3 py-2 text-right font-tabular">{l.lineTotal.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border">
              <tr>
                <td colSpan={3} className="px-3 py-1 text-right text-muted-foreground">Subtotal (excl. VAT)</td>
                <td className="px-3 py-1 text-right font-tabular">{formatRWFFull(order.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="px-3 py-1 text-right text-muted-foreground">VAT</td>
                <td className="px-3 py-1 text-right font-tabular">{formatRWFFull(order.vatAmount)}</td>
              </tr>
              <tr className="font-bold">
                <td colSpan={3} className="px-3 py-2 text-right">Total</td>
                <td className="px-3 py-2 text-right font-tabular">{formatRWFFull(order.total)}</td>
              </tr>
            </tfoot>
          </table>

          {order.notes && <p className="text-sm text-muted-foreground">Notes: {order.notes}</p>}

          {mode === 'deliver' && (
            <fieldset className="border border-border rounded-lg p-4 space-y-3">
              <legend className="px-1 text-sm font-semibold">Mark delivered &amp; issue invoice</legend>
              <div>
                <label className="block text-xs font-semibold mb-1">Delivery date</label>
                <input type="date" max={today} min={order.orderDate} value={deliveredOn} onChange={(e) => setDeliveredOn(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Take stock from</label>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputClass}>
                  {config.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">Oldest batches are used first. Delivery is refused if stock is short.</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={collect} onChange={(e) => setCollect(e.target.checked)} />
                Payment collected on delivery
              </label>
              {collect && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Amount (RWF)</label>
                    <input type="number" min="0" max={order.total} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Method</label>
                    <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethodValue)} className={inputClass}>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Reference</label>
                    <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === 'CASH' ? 'Optional' : 'Required'} className={inputClass} />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        deliverOrder(order.id, {
                          deliveredOn,
                          warehouseId,
                          payment: collect ? { amount: Number(amount), method, reference } : undefined,
                        }),
                      `${order.orderNumber} delivered and invoiced`
                    )
                  }
                  className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
                >
                  {busy ? 'Saving...' : 'Confirm delivery'}
                </button>
                <button onClick={() => setMode('view')} className="px-4 py-2 text-sm border border-border rounded-lg">
                  Back
                </button>
              </div>
            </fieldset>
          )}

          {mode === 'cancel' && (
            <fieldset className="border border-negative/30 rounded-lg p-4 space-y-3">
              <legend className="px-1 text-sm font-semibold text-negative">Cancel order</legend>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className={inputClass} />
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => run(() => cancelOrder(order.id, reason), `${order.orderNumber} cancelled`)}
                  className="px-4 py-2 text-sm font-semibold bg-negative text-white rounded-lg disabled:opacity-60"
                >
                  {busy ? 'Saving...' : 'Cancel order'}
                </button>
                <button onClick={() => setMode('view')} className="px-4 py-2 text-sm border border-border rounded-lg">
                  Back
                </button>
              </div>
            </fieldset>
          )}

          {error && <p className="text-sm text-negative bg-negative-bg border border-negative/20 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {mode === 'view' && (canApprove || canDeliver || canCancel) && (
          <div className="sticky bottom-0 bg-card border-t border-border px-5 py-3 flex flex-wrap gap-2">
            {canApprove && (
              <button
                disabled={busy}
                onClick={() => run(() => approveOrder(order.id), `${order.orderNumber} approved`)}
                className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
              >
                Approve credit
              </button>
            )}
            {canDeliver && (
              <button onClick={() => setMode('deliver')} className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg">
                Mark delivered
              </button>
            )}
            {canCancel && (
              <button onClick={() => setMode('cancel')} className="px-4 py-2 text-sm border border-negative/40 text-negative rounded-lg">
                Cancel order
              </button>
            )}
            <span className="text-xs text-muted-foreground self-center ml-auto">{ORDER_STATUS_LABELS[order.status]}</span>
          </div>
        )}
      </div>
    </div>
  );
}
