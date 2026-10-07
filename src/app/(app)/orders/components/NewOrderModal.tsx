'use client';

import React, { useState } from 'react';
import { useConfig } from '@/context/ConfigContext';
import { useUser } from '@/context/UserContext';
import { createOrder } from '@/actions/orders';
import OrderLinesEditor, { completedLines, emptyLine, type DraftLine } from '@/components/orders/OrderLinesEditor';
import type { CustomerOption, Order, PriceBook } from '@/lib/types';

interface NewOrderModalProps {
  customers: CustomerOption[];
  priceBook: PriceBook;
  today: string;
  initialCustomerId?: string;
  onClose: () => void;
  onCreated: (order: Order) => void;
}

export default function NewOrderModal({ customers, priceBook, today, initialCustomerId = '', onClose, onCreated }: NewOrderModalProps) {
  const { config } = useConfig();
  const { canViewAllReps } = useUser();
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [salespersonId, setSalespersonId] = useState('');
  const [orderDate, setOrderDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const customer = customers.find((c) => c.id === customerId);
  const priceFor = (productId: string) =>
    (customer?.priceListId ? priceBook[customer.priceListId]?.[productId] : undefined) ??
    config.products.find((p) => p.id === productId)?.unitPrice ??
    0;

  const submit = async () => {
    const orderLines = completedLines(lines, canViewAllReps);
    if (!customerId) return setError('Select a customer.');
    if (orderLines.length === 0) return setError('Add at least one product with a quantity.');
    setSaving(true);
    setError('');
    try {
      const res = await createOrder({
        customerId,
        salespersonId: salespersonId || undefined,
        orderDate,
        lines: orderLines,
        notes,
      });
      if (!res.success) return setError(res.error);
      if (res.data) onCreated(res.data);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
  const labelClass = 'block text-xs font-semibold text-foreground mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-foreground">New Order</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted" aria-label="Close">
            Close
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>
                Customer <span className="text-negative">*</span>
              </label>
              <select className={inputClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.area}
                  </option>
                ))}
              </select>
              {customer && (
                <p className="text-xs text-muted-foreground mt-1">
                  {customer.paymentTermsDays > 0 ? `Credit: ${customer.paymentTermsDays} days after delivery` : 'Cash on delivery'}
                  {customer.priceListId
                    ? ` · Price list: ${config.priceLists.find((p) => p.id === customer.priceListId)?.name ?? ''}`
                    : ' · Standard prices'}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Order Date</label>
              <input type="date" max={today} className={inputClass} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
            {canViewAllReps && (
              <div>
                <label className={labelClass}>Sales Rep</label>
                <select className={inputClass} value={salespersonId} onChange={(e) => setSalespersonId(e.target.value)}>
                  <option value="">Customer&apos;s assigned rep</option>
                  {config.salespeople.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <OrderLinesEditor
            lines={lines}
            onChange={setLines}
            products={config.products}
            priceFor={priceFor}
            canEditPrice={canViewAllReps}
            vatRate={config.settings.vatRate}
            pricesIncludeVat={config.settings.pricesIncludeVat}
          />

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              rows={2}
              className={`${inputClass} resize-none`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery instructions, special requests..."
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Orders over the customer&apos;s credit limit, or for customers with overdue invoices, are put on credit hold
            until a manager approves them.
          </p>

          {error && <p className="text-sm text-negative bg-negative-bg border border-negative/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? 'Placing order...' : 'Place Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
