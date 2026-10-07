'use client';

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { saveWarehouses } from '@/actions/config';
import { newTempId } from '@/lib/clientId';
import type { WarehouseDTO } from '@/lib/types';

interface WarehousesEditorProps {
  warehouses: WarehouseDTO[];
  onSaved: (warehouses: WarehouseDTO[]) => void;
}

export default function WarehousesEditor({ warehouses, onSaved }: WarehousesEditorProps) {
  const [rows, setRows] = useState<WarehouseDTO[]>(
    warehouses.length ? warehouses : [{ id: newTempId('wh'), name: 'Main Warehouse', address: '', isDefault: true }]
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const update = (id: string, patch: Partial<WarehouseDTO>) => setRows((r) => r.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await saveWarehouses(rows);
      if (!res.success) return setMessage({ ok: false, text: res.error });
      if (res.data) {
        setRows(res.data);
        onSaved(res.data);
      }
      setMessage({ ok: true, text: 'Saved' });
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'border border-border rounded-md px-2 py-1.5 text-sm bg-background w-full';

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-sm">Warehouses</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Where stock is kept and roasted. The default warehouse is used for direct deliveries. A warehouse can only be
          removed once its stock is zero.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left py-2">Name</th>
            <th className="text-left py-2">Address</th>
            <th className="text-center py-2 w-24">Default</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((w) => (
            <tr key={w.id}>
              <td className="py-2 pr-2">
                <input className={inputClass} value={w.name} onChange={(e) => update(w.id, { name: e.target.value })} />
              </td>
              <td className="py-2 pr-2">
                <input className={inputClass} value={w.address} onChange={(e) => update(w.id, { address: e.target.value })} placeholder="e.g. Kigali Special Economic Zone" />
              </td>
              <td className="py-2 text-center">
                <input
                  type="radio"
                  name="default-warehouse"
                  checked={w.isDefault}
                  onChange={() => setRows((r) => r.map((x) => ({ ...x, isDefault: x.id === w.id })))}
                  aria-label={`Make ${w.name} the default`}
                />
              </td>
              <td className="py-2 text-right">
                <button
                  onClick={() => setRows((r) => r.filter((x) => x.id !== w.id))}
                  disabled={rows.length === 1}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-negative disabled:opacity-30"
                  title="Remove"
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setRows((r) => [...r, { id: newTempId('wh'), name: '', address: '', isDefault: false }])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
        >
          <Plus size={14} /> Add warehouse
        </button>
        <button onClick={save} disabled={busy} className="px-4 py-1.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-60">
          {busy ? 'Saving...' : 'Save warehouses'}
        </button>
        {message && <span className={`text-sm ${message.ok ? 'text-positive' : 'text-negative'}`}>{message.text}</span>}
      </div>
    </div>
  );
}
