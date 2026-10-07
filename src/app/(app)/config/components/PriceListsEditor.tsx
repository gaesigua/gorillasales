'use client';

import React, { useState } from 'react';
import { deletePriceList, savePriceList } from '@/actions/config';
import type { ActionResult, PriceListDTO, ProductItem } from '@/lib/types';

interface PriceListsEditorProps {
  priceLists: PriceListDTO[];
  products: ProductItem[];
  onSaved: (lists: PriceListDTO[]) => void;
}

interface Draft {
  id?: string;
  name: string;
  description: string;
  prices: Record<string, string>; // productId -> price; blank = standard list price
}

function toDraft(list?: PriceListDTO): Draft {
  return {
    id: list?.id,
    name: list?.name ?? '',
    description: list?.description ?? '',
    prices: Object.fromEntries((list?.items ?? []).map((i) => [i.productId, String(i.unitPrice)])),
  };
}

export default function PriceListsEditor({ priceLists, products, onSaved }: PriceListsEditorProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<ActionResult<PriceListDTO[]>>) {
    setBusy(true);
    setError('');
    try {
      const res = await action();
      if (!res.success) return setError(res.error);
      if (res.data) onSaved(res.data);
      setDraft(null);
    } finally {
      setBusy(false);
    }
  }

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) return setError('Give the price list a name.');
    const items = Object.entries(draft.prices)
      .filter(([, v]) => v.trim() !== '')
      .map(([productId, v]) => ({ productId, unitPrice: Number(v) }));
    if (items.some((i) => !(i.unitPrice >= 0))) return setError('Prices must be numbers of 0 or more.');
    run(() => savePriceList({ id: draft.id, name: draft.name, description: draft.description, items }));
  };

  const inputClass = 'border border-border rounded-md px-2 py-1.5 text-sm bg-background w-full';

  if (draft) {
    return (
      <div className="bg-card border border-border p-3 space-y-4">
        <h3 className="font-semibold text-sm">{draft.id ? `Edit ${draft.name}` : 'New price list'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={inputClass} placeholder="Name, e.g. Hotels & HoReCa" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className={inputClass} placeholder="Description (optional)" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </div>
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left py-2">Product</th>
              <th className="text-right py-2">Standard price</th>
              <th className="text-right py-2 w-44">Price on this list</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="py-2">{p.label}</td>
                <td className="py-2 text-right font-tabular text-muted-foreground">{p.unitPrice.toLocaleString('en-US')}</td>
                <td className="py-2 pl-4">
                  <input
                    className={`${inputClass} text-right`}
                    type="number"
                    min="0"
                    placeholder="standard"
                    value={draft.prices[p.id] ?? ''}
                    onChange={(e) => setDraft({ ...draft, prices: { ...draft.prices, [p.id]: e.target.value } })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">Leave a price blank to use the standard price. Enter prices exactly as the customer pays them.</p>
        {error && <p className="text-sm text-negative">{error}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-60">
            {busy ? 'Saving...' : 'Save price list'}
          </button>
          <button onClick={() => setDraft(null)} className="px-4 py-2 text-sm border border-border rounded-lg">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm">Price Lists</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Special prices for groups of customers (e.g. hotels, wholesalers). Assign a list to a customer in Customer
            Management. Customers without a list pay standard prices.
          </p>
        </div>
        <button onClick={() => setDraft(toDraft())} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold shrink-0">
           New price list
        </button>
      </div>
      {error && <p className="px-5 pt-3 text-sm text-negative">{error}</p>}
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-5 py-2">Name</th>
            <th className="text-left px-5 py-2">Description</th>
            <th className="text-right px-5 py-2">Custom prices</th>
            <th className="text-right px-5 py-2">Customers</th>
            <th className="px-5 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {priceLists.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-6 text-center text-xs text-muted-foreground">
                No price lists yet. Everyone pays standard prices.
              </td>
            </tr>
          )}
          {priceLists.map((l) => (
            <tr key={l.id}>
              <td className="px-5 py-1.5 font-medium">{l.name}</td>
              <td className="px-5 py-1.5 text-muted-foreground">{l.description || '—'}</td>
              <td className="px-5 py-1.5 text-right">{l.items.length}</td>
              <td className="px-5 py-1.5 text-right">{l.customerCount}</td>
              <td className="px-5 py-1.5">
                <div className="flex justify-end gap-1">
                  <button onClick={() => setDraft(toDraft(l))} className="p-1.5 rounded-lg text-muted-foreground hover:text-accent" title="Edit">
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Remove "${l.name}"? ${l.customerCount} customer(s) will go back to standard prices.`)) {
                        run(() => deletePriceList(l.id));
                      }
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-negative"
                    title="Remove"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
