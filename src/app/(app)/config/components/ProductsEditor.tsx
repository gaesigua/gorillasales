'use client';

import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, AlertCircle } from 'lucide-react';
import { newTempId } from '@/lib/clientId';
import type { ProductItem } from '@/lib/types';

interface ProductsEditorProps {
  products: ProductItem[];
  onChange: (products: ProductItem[]) => void;
}

interface FormState {
  label: string;
  sku: string;
  category: string;
  unitPrice: string;
  unitOfMeasure: string;
  weightKg: string;
}

const EMPTY_FORM: FormState = {
  label: '',
  sku: '',
  category: 'Roasted Coffee',
  unitPrice: '',
  unitOfMeasure: 'Pack',
  weightKg: '',
};

function toForm(p: ProductItem): FormState {
  return {
    label: p.label,
    sku: p.sku,
    category: p.category,
    unitPrice: String(p.unitPrice),
    unitOfMeasure: p.unitOfMeasure,
    weightKg: String(p.weightKg),
  };
}

export default function ProductsEditor({ products, onChange }: ProductsEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const validate = (): string => {
    if (!form.label.trim()) return 'Product name is required';
    const dup = products.find((p) => p.id !== editingId && p.label.toLowerCase() === form.label.trim().toLowerCase());
    if (dup) return 'A product with this name already exists';
    const price = Number(form.unitPrice);
    if (form.unitPrice === '' || isNaN(price) || price < 0) return 'Enter a valid unit price (RWF)';
    const kg = Number(form.weightKg);
    if (form.weightKg === '' || isNaN(kg) || kg < 0) return 'Enter the coffee weight of one unit in KG (e.g. 0.25)';
    if (!form.unitOfMeasure.trim()) return 'Enter a unit (e.g. Pack, KG, Box)';
    return '';
  };

  const save = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    const item: ProductItem = {
      id: editingId && editingId !== 'new' ? editingId : newTempId('pr'),
      label: form.label.trim(),
      sku: form.sku.trim(),
      category: form.category.trim(),
      unitPrice: Number(form.unitPrice),
      unitOfMeasure: form.unitOfMeasure.trim(),
      weightKg: Number(form.weightKg),
    };
    onChange(editingId === 'new' ? [...products, item] : products.map((p) => (p.id === editingId ? item : p)));
    cancel();
  };

  const cancel = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const inputClass =
    'w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40';

  const formRow = (
    <tr className="bg-accent/5">
      <td className="px-3 py-2"><input className={inputClass} placeholder="e.g. 250G Roasted Coffee" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></td>
      <td className="px-3 py-2"><input className={inputClass} placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></td>
      <td className="px-3 py-2"><input className={inputClass} placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></td>
      <td className="px-3 py-2"><input className={inputClass} type="number" min="0" placeholder="RWF" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></td>
      <td className="px-3 py-2"><input className={inputClass} placeholder="Pack" value={form.unitOfMeasure} onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })} /></td>
      <td className="px-3 py-2"><input className={inputClass} type="number" min="0" step="0.001" placeholder="0.25" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} /></td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <button onClick={save} className="p-1.5 rounded-md bg-accent text-white hover:bg-accent/90" title="Save"><Check size={13} /></button>
          <button onClick={cancel} className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/80" title="Cancel"><X size={13} /></button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Product Catalogue</h3>
          <p className="text-muted-foreground text-xs mt-0.5">
            Products available in daily sales entry. Weight per unit is used for KG targets (a 250g pack = 0.25).
            Removing a product hides it from new entries; past visits keep it.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId('new');
            setForm(EMPTY_FORM);
            setError('');
          }}
          disabled={editingId !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 disabled:opacity-50 shrink-0"
        >
          <Plus size={13} /> Add product
        </button>
      </div>

      {error && (
        <div className="mx-5 mt-3 flex items-center gap-2 text-xs text-negative bg-negative-bg border border-negative/20 rounded-lg px-3 py-2">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-semibold">Name</th>
              <th className="px-3 py-2.5 text-left font-semibold">SKU</th>
              <th className="px-3 py-2.5 text-left font-semibold">Category</th>
              <th className="px-3 py-2.5 text-right font-semibold">Unit Price (RWF)</th>
              <th className="px-3 py-2.5 text-left font-semibold">Unit</th>
              <th className="px-3 py-2.5 text-right font-semibold">KG / Unit</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((p) =>
              editingId === p.id ? (
                <React.Fragment key={p.id}>{formRow}</React.Fragment>
              ) : (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-medium text-foreground">{p.label}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.sku || '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.category}</td>
                  <td className="px-3 py-2.5 text-right font-tabular">{p.unitPrice.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.unitOfMeasure}</td>
                  <td className="px-3 py-2.5 text-right font-tabular">{p.weightKg}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {deleteConfirmId === p.id ? (
                        <>
                          <button
                            onClick={() => {
                              onChange(products.filter((x) => x.id !== p.id));
                              setDeleteConfirmId(null);
                            }}
                            className="px-2 py-1 rounded bg-negative text-white text-xs"
                          >
                            Remove
                          </button>
                          <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(p.id);
                              setForm(toForm(p));
                              setError('');
                            }}
                            disabled={editingId !== null}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10 disabled:opacity-40"
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(p.id)}
                            disabled={editingId !== null}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-negative hover:bg-negative/10 disabled:opacity-40"
                            title="Remove"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            )}
            {editingId === 'new' && formRow}
            {products.length === 0 && editingId !== 'new' && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No products yet. Add your first product.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
