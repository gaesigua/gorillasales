'use client';

import React, { useEffect, useRef, useState } from 'react';
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

  // Keyboard flow: Enter in Quantity/Price moves to the next line's product, adding a line at the end
  const tableRef = useRef<HTMLTableElement>(null);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  useEffect(() => {
    if (focusRow === null) return;
    tableRef.current?.querySelectorAll<HTMLSelectElement>('select[aria-label="Product"]')[focusRow]?.focus();
    setFocusRow(null);
  }, [focusRow, lines.length]);
  const onLineKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const isLast = index === lines.length - 1;
    if (isLast && lines[index].productId && lines.length < products.length) onChange([...lines, emptyLine()]);
    if (!isLast || lines[index].productId) setFocusRow(index + 1);
  };

  const update = (key: string, patch: Partial<DraftLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const usedProducts = new Set(lines.map((l) => l.productId));

  const cell = 'border border-border px-1.5 py-1 text-sm bg-background text-foreground w-full';

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full text-sm max-sm:[&_thead]:hidden">
          <thead>
            <tr>
              <th className="text-left px-2 py-1">Product</th>
              <th className="text-right px-2 py-1 w-28">Quantity</th>
              <th className="text-right px-2 py-1 w-36">Unit price (RWF)</th>
              <th className="text-right px-2 py-1 w-36">Line total</th>
              <th className="px-2 py-1 w-16" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, index) => {
              const product = products.find((p) => p.id === l.productId);
              const price = effectivePrice(l);
              return (
                <tr key={l.key} className="max-sm:grid max-sm:grid-cols-4 max-sm:border max-sm:border-border max-sm:mb-2 max-sm:[&>td]:border-0">
                  <td className="p-1 max-sm:col-span-4">
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
                  <td className="p-1">
                    <span className="block text-xs font-bold sm:hidden">Quantity</span>
                    <input
                      className={`${cell} text-right`}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      placeholder={product?.unitOfMeasure ?? 'Qty'}
                      value={l.quantity}
                      onChange={(e) => update(l.key, { quantity: e.target.value })}
                      onKeyDown={(e) => onLineKeyDown(e, index)}
                      aria-label="Quantity"
                    />
                  </td>
                  <td className="p-1">
                    <span className="block text-xs font-bold sm:hidden">Price</span>
                    {canEditPrice ? (
                      <input
                        className={`${cell} text-right`}
                        type="number"
                        min="0"
                        placeholder={l.productId ? String(priceFor(l.productId)) : ''}
                        value={l.unitPrice}
                        onChange={(e) => update(l.key, { unitPrice: e.target.value })}
                        onKeyDown={(e) => onLineKeyDown(e, index)}
                        aria-label="Unit price"
                      />
                    ) : (
                      <div className="text-right font-tabular px-2 py-2 text-muted-foreground">
                        {l.productId ? price.toLocaleString('en-US') : '—'}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right font-tabular font-semibold">
                    <span className="block text-xs font-bold sm:hidden">Total</span>
                    {l.productId && Number(l.quantity) > 0 ? (Number(l.quantity) * price).toLocaleString('en-US') : '—'}
                  </td>
                  <td className="p-1 text-center max-sm:self-end">
                    <button
                      type="button"
                      onClick={() => onChange(lines.length > 1 ? lines.filter((x) => x.key !== l.key) : [emptyLine()])}
                      className="text-xs text-link underline"
                      title="Remove line"
                    >
                      Delete
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
          className="px-3 py-1 border border-border text-sm disabled:opacity-40"
        >
          Add product
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
      <p className="text-xs text-muted-foreground no-print">Press Enter in Quantity to go to the next line.</p>
      {!canEditPrice && (
        <p className="text-xs text-muted-foreground">Prices come from the customer&apos;s price list. Ask a manager for special pricing.</p>
      )}
    </div>
  );
}
