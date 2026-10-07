'use client';

import React, { useState } from 'react';
import { useConfig } from '@/context/ConfigContext';
import { adjustStock, receiveStock, recordRoastRun } from '@/actions/inventory';
import { bestBeforeFrom, roastYieldPct, validateRoast } from '@/lib/domain/inventory';
import type { StockBatchDTO } from '@/lib/types';

const inputClass = 'w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';
const labelClass = 'block text-xs font-semibold mb-1';

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Close">
            Close
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Footer({ busy, error, onCancel, onSave, label }: { busy: boolean; error: string; onCancel: () => void; onSave: () => void; label: string }) {
  return (
    <>
      {error && <p className="text-sm text-negative bg-negative-bg border border-negative/20 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-border rounded-lg">
          Cancel
        </button>
        <button onClick={onSave} disabled={busy} className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-60">
          {busy ? 'Saving...' : label}
        </button>
      </div>
    </>
  );
}

/** Receive goods (purchases, opening stock) into a warehouse batch. */
export function ReceiveStockModal({ today, onClose, onSaved }: { today: string; onClose: () => void; onSaved: (msg: string) => void }) {
  const { config } = useConfig();
  const [warehouseId, setWarehouseId] = useState(config.warehouses.find((w) => w.isDefault)?.id ?? config.warehouses[0]?.id ?? '');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [receivedOn, setReceivedOn] = useState(today);
  const [roastDate, setRoastDate] = useState('');
  const [bestBefore, setBestBefore] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const product = config.products.find((p) => p.id === productId);
  const suggestedBestBefore = product ? bestBeforeFrom(roastDate || receivedOn, product.shelfLifeDays) : null;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await receiveStock({ warehouseId, productId, quantity: Number(quantity), batchNumber, receivedOn, roastDate, bestBefore, supplier, notes });
      if (!res.success) return setError(res.error);
      onSaved(`Received ${quantity} ${product?.unitOfMeasure ?? ''} of ${product?.label ?? ''}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Receive Stock" onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Warehouse</label>
          <select className={inputClass} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {config.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Product</label>
          <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select product...</option>
            {config.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} {p.kind === 'GREEN' ? '(green)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Quantity {product ? `(${product.unitOfMeasure})` : ''}</label>
          <input className={inputClass} type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Batch / lot number</label>
          <input className={inputClass} value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="Supplier lot or OPENING-2026" />
        </div>
        <div>
          <label className={labelClass}>Received on</label>
          <input className={inputClass} type="date" max={today} value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
        </div>
        {product?.kind === 'FINISHED' && (
          <div>
            <label className={labelClass}>Roast date (if roasted)</label>
            <input className={inputClass} type="date" max={today} value={roastDate} onChange={(e) => setRoastDate(e.target.value)} />
          </div>
        )}
        <div>
          <label className={labelClass}>Best before</label>
          <input className={inputClass} type="date" value={bestBefore} onChange={(e) => setBestBefore(e.target.value)} placeholder={suggestedBestBefore ?? ''} />
          <p className="text-xs text-muted-foreground mt-1">
            {suggestedBestBefore ? `Leave blank to use ${suggestedBestBefore} (product shelf life).` : 'Leave blank for no expiry.'}
          </p>
        </div>
        <div>
          <label className={labelClass}>Supplier</label>
          <input className={inputClass} value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. washing station / cooperative" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Notes</label>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Footer busy={busy} error={error} onCancel={onClose} onSave={save} label="Receive" />
    </Shell>
  );
}

interface RoastLine {
  key: number;
  productId: string;
  quantity: string;
}

/** Record a roast run: green coffee in, finished products out. */
export function RoastRunModal({ today, onClose, onSaved }: { today: string; onClose: () => void; onSaved: (msg: string) => void }) {
  const { config } = useConfig();
  const green = config.products.filter((p) => p.kind === 'GREEN');
  const finished = config.products.filter((p) => p.kind === 'FINISHED' && p.weightKg > 0);
  const [warehouseId, setWarehouseId] = useState(config.warehouses.find((w) => w.isDefault)?.id ?? config.warehouses[0]?.id ?? '');
  const [roastDate, setRoastDate] = useState(today);
  const [inputs, setInputs] = useState<RoastLine[]>([{ key: 1, productId: green[0]?.id ?? '', quantity: '' }]);
  const [outputs, setOutputs] = useState<RoastLine[]>([{ key: 1, productId: '', quantity: '' }]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const kg = (lines: RoastLine[], weightOf: (id: string) => number) =>
    lines.reduce((s, l) => s + (Number(l.quantity) || 0) * weightOf(l.productId), 0);
  const weight = (id: string) => config.products.find((p) => p.id === id)?.weightKg || 1;
  const inKg = Math.round(kg(inputs, weight) * 1000) / 1000;
  const outKg = Math.round(kg(outputs, (id) => config.products.find((p) => p.id === id)?.weightKg ?? 0) * 1000) / 1000;
  const warning = inKg > 0 && outKg > 0 ? validateRoast(inKg, outKg) : null;

  const lineEditor = (lines: RoastLine[], setLines: (l: RoastLine[]) => void, options: typeof config.products) => (
    <div className="space-y-2">
      {lines.map((l) => (
        <div key={l.key} className="flex gap-2">
          <select className={inputClass} value={l.productId} onChange={(e) => setLines(lines.map((x) => (x.key === l.key ? { ...x, productId: e.target.value } : x)))}>
            <option value="">Select...</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            className={`${inputClass} w-32`}
            type="number"
            min="0"
            step="any"
            placeholder={config.products.find((p) => p.id === l.productId)?.unitOfMeasure ?? 'Qty'}
            value={l.quantity}
            onChange={(e) => setLines(lines.map((x) => (x.key === l.key ? { ...x, quantity: e.target.value } : x)))}
          />
          <button onClick={() => setLines(lines.length > 1 ? lines.filter((x) => x.key !== l.key) : lines)} className="p-2 text-muted-foreground hover:text-negative" title="Remove">
            Delete
          </button>
        </div>
      ))}
      <button onClick={() => setLines([...lines, { key: Date.now(), productId: '', quantity: '' }])} className="flex items-center gap-1 text-xs text-accent">
         Add line
      </button>
    </div>
  );

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await recordRoastRun({
        warehouseId,
        roastDate,
        notes,
        inputs: inputs.filter((l) => l.productId && Number(l.quantity) > 0).map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
        outputs: outputs.filter((l) => l.productId && Number(l.quantity) > 0).map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
      });
      if (!res.success) return setError(res.error);
      onSaved(`Roast run ${res.data?.runNumber} recorded`);
    } finally {
      setBusy(false);
    }
  };

  if (green.length === 0) {
    return (
      <Shell title="Record Roast Run" onClose={onClose}>
        <p className="text-sm">No green coffee products yet. Mark a product as “Green (roast input)” in Config → Products first.</p>
      </Shell>
    );
  }

  return (
    <Shell title="Record Roast Run" onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Warehouse / roastery</label>
          <select className={inputClass} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {config.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Roast date</label>
          <input className={inputClass} type="date" max={today} value={roastDate} onChange={(e) => setRoastDate(e.target.value)} />
        </div>
      </div>
      <fieldset className="border border-border rounded-lg p-3">
        <legend className="px-1 text-sm font-semibold">Green coffee used (oldest lots are used first)</legend>
        {lineEditor(inputs, setInputs, green)}
      </fieldset>
      <fieldset className="border border-border rounded-lg p-3">
        <legend className="px-1 text-sm font-semibold">Produced (becomes a new batch dated {roastDate})</legend>
        {lineEditor(outputs, setOutputs, finished)}
      </fieldset>
      <p className="text-sm">
        Green in: <strong>{inKg} KG</strong> · Roasted out: <strong>{outKg} KG</strong>
        {inKg > 0 && outKg > 0 && <> · Yield: <strong>{roastYieldPct(inKg, outKg)}%</strong></>}
      </p>
      {warning && <p className="text-sm text-warning">{warning}</p>}
      <div>
        <label className={labelClass}>Notes</label>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Roast profile, roaster, observations" />
      </div>
      <Footer busy={busy} error={error} onCancel={onClose} onSave={save} label="Record roast" />
    </Shell>
  );
}

/** Stock count correction for one batch (managers). */
export function AdjustStockModal({ batch, onClose, onSaved }: { batch: StockBatchDTO; onClose: () => void; onSaved: (msg: string) => void }) {
  const [counted, setCounted] = useState(String(batch.quantity));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const delta = Math.round(((Number(counted) || 0) - batch.quantity) * 1000) / 1000;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await adjustStock({ batchId: batch.id, countedQuantity: Number(counted), reason });
      if (!res.success) return setError(res.error);
      onSaved(`${batch.productName} ${batch.batchNumber} adjusted by ${delta > 0 ? '+' : ''}${delta}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={`Stock count — ${batch.productName}, batch ${batch.batchNumber}`} onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        System quantity: <strong className="text-foreground">{batch.quantity} {batch.unitOfMeasure}</strong> in {batch.warehouseName}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Counted quantity</label>
          <input className={inputClass} type="number" min="0" step="any" value={counted} onChange={(e) => setCounted(e.target.value)} />
          <p className={`text-xs mt-1 ${delta < 0 ? 'text-negative' : 'text-muted-foreground'}`}>Difference: {delta > 0 ? '+' : ''}{delta}</p>
        </div>
        <div>
          <label className={labelClass}>Reason (required)</label>
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. damaged bags, monthly count" />
        </div>
      </div>
      <Footer busy={busy} error={error} onCancel={onClose} onSave={save} label="Save adjustment" />
    </Shell>
  );
}
