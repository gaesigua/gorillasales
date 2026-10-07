'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { computeOrderTotals } from '@/lib/domain/money';
import { formatRWFFull } from '@/lib/format';
import { newTempId } from '@/lib/clientId';
import type { ProductItem } from '@/lib/types';

export interface DraftLine {
  key: string;
  productId: string;
  quantity: string;
  unitPrice: string; // only sent to the server when the user may override prices
}

export function emptyLine(): DraftLine {
  return { key: newTempId('line'), productId: '', quantity: '', unitPrice: '' };
}

/** Lines that are filled in, ready to send to createOrder / createVisitLog. */
export function completedLines(lines: DraftLine[], canEditPrice: boolean) {
  return lines
    .filter((l) => l.productId && Number(l.quantity) > 0)
    .map((l) => ({
      productId: l.productId,
      quantity: Number(l.quantity),
      ...(canEditPrice && l.unitPrice !== '' ? { unitPrice: Number(l.unitPrice) } : {}),
    }));
}

interface OrderLinesEditorProps {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  products: ProductItem[];
  /** Price the customer pays for a product (price list or list price). */
  priceFor: (productId: string) => number;
  canEditPrice: boolean;
  vatRate: number;
  pricesIncludeVat: boolean;
}

export default function OrderLinesEditor({
  lines,
  onChange,
  products,
  priceFor,
  canEditPrice,
  vatRate,
  pricesIncludeVat,
}: OrderLinesEditorProps) {
  const effectivePrice = (l: DraftLine) =>
    canEditPrice && l.unitPrice !== '' ? Number(l.unitPrice) || 0 : l.productId ? priceFor(l.productId) : 0;

  const filled = lines.filter((l) => l.productId && Number(l.quantity) > 0);
  const totals = computeOrderTotals(
    filled.map((l) => ({ quantity: Number(l.quantity), unitPrice: effectivePrice(l) })),
    vatRate,
    pricesIncludeVat
  );
  const kg = filled.reduce((s, l) => s + Number(l.quantity) * (products.find((p) => p.id === l.productId)?.weightKg ?? 0), 0);

  const update = (key: string, patch: Partial<DraftLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const usedProducts = new Set(lines.map((l) => l.productId));

  const cell = 'border border-border rounded-md px-2 py-2 text-sm bg-background text-foreground w-full focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-semibold pb-2 pr-2">Product</th>
              <th className="text-right font-semibold pb-2 px-2 w-28">Quantity</th>
              <th className="text-right font-semibold pb-2 px-2 w-36">Unit Price (RWF)</th>
              <th className="text-right font-semibold pb-2 px-2 w-36">Line Total</th>
              <th className="pb-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const product = products.find((p) => p.id === l.productId);
              const price = effectivePrice(l);
              return (
                <tr key={l.key}>
                  <td className="py-1 pr-2">
                    <select
                      className={cell}
                      value={l.productId}
                      onChange={(e) => update(l.key, { productId: e.target.value, unitPrice: '' })}
                      aria-label="Product"
                    >
                      <option value="">Select product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id} disabled={usedProducts.has(p.id) && p.id !== l.productId}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 px-2">
                    <input
                      className={`${cell} text-right`}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      placeholder={product?.unitOfMeasure ?? 'Qty'}
                      value={l.quantity}
                      onChange={(e) => update(l.key, { quantity: e.target.value })}
                      aria-label="Quantity"
                    />
                  </td>
                  <td className="py-1 px-2">
                    {canEditPrice ? (
                      <input
                        className={`${cell} text-right`}
                        type="number"
                        min="0"
                        placeholder={l.productId ? String(priceFor(l.productId)) : ''}
                        value={l.unitPrice}
                        onChange={(e) => update(l.key, { unitPrice: e.target.value })}
                        aria-label="Unit price"
                      />
                    ) : (
                      <div className="text-right font-tabular px-2 py-2 text-muted-foreground">
                        {l.productId ? price.toLocaleString('en-US') : '—'}
                      </div>
                    )}
                  </td>
                  <td className="py-1 px-2 text-right font-tabular font-semibold">
                    {l.productId && Number(l.quantity) > 0 ? (Number(l.quantity) * price).toLocaleString('en-US') : '—'}
                  </td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      onClick={() => onChange(lines.length > 1 ? lines.filter((x) => x.key !== l.key) : [emptyLine()])}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-negative hover:bg-negative/10"
                      title="Remove line"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => onChange([...lines, emptyLine()])}
          disabled={lines.length >= products.length}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-40"
        >
          <Plus size={14} /> Add product
        </button>
        <dl className="text-sm min-w-[240px] space-y-1">
          <div className="flex justify-between gap-6">
            <dt className="text-muted-foreground">Subtotal (excl. VAT)</dt>
            <dd className="font-tabular">{formatRWFFull(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-muted-foreground">VAT {vatRate}%</dt>
            <dd className="font-tabular">{formatRWFFull(totals.vatAmount)}</dd>
          </div>
          <div className="flex justify-between gap-6 border-t border-border pt-1 font-bold">
            <dt>Total</dt>
            <dd className="font-tabular">{formatRWFFull(totals.total)}</dd>
          </div>
          <div className="flex justify-between gap-6 text-xs text-muted-foreground">
            <dt>Coffee weight</dt>
            <dd className="font-tabular">{Math.round(kg * 100) / 100} KG</dd>
          </div>
        </dl>
      </div>
      {!canEditPrice && (
        <p className="text-xs text-muted-foreground">Prices come from the customer&apos;s price list. Ask a manager for special pricing.</p>
      )}
    </div>
  );
}
