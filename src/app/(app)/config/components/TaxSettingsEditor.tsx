'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { saveOrganizationSettings } from '@/actions/config';
import type { OrganizationSettings } from '@/lib/types';

export default function TaxSettingsEditor({ settings }: { settings: OrganizationSettings }) {
  const router = useRouter();
  const { isAdmin } = useUser();
  const [tin, setTin] = useState(settings.tin);
  const [vatRate, setVatRate] = useState(String(settings.vatRate));
  const [pricesIncludeVat, setPricesIncludeVat] = useState(settings.pricesIncludeVat);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await saveOrganizationSettings({ tin, vatRate: Number(vatRate), pricesIncludeVat });
      setMessage(res.success ? { ok: true, text: 'Saved. New orders use these settings.' } : { ok: false, text: res.error });
      if (res.success) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'border border-border rounded-lg px-3 py-2 text-sm bg-background w-full disabled:bg-muted/40';

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 max-w-xl">
      <div>
        <h3 className="font-semibold text-sm">Tax &amp; Invoicing — {settings.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Printed on invoices and used to split VAT. Changes apply to new orders; existing orders and invoices keep
          their amounts.
        </p>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1">Company TIN</label>
        <input className={inputClass} value={tin} onChange={(e) => setTin(e.target.value)} placeholder="9 digits" maxLength={9} disabled={!isAdmin} />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1">VAT rate (%)</label>
        <input className={inputClass} type="number" min="0" max="100" step="0.01" value={vatRate} onChange={(e) => setVatRate(e.target.value)} disabled={!isAdmin} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={pricesIncludeVat} onChange={(e) => setPricesIncludeVat(e.target.checked)} disabled={!isAdmin} />
        Product and price-list prices already include VAT
      </label>
      {isAdmin ? (
        <button onClick={save} disabled={busy} className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-60">
          {busy ? 'Saving...' : 'Save'}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">Only an admin can change tax settings.</p>
      )}
      {message && <p className={`text-sm ${message.ok ? 'text-positive' : 'text-negative'}`}>{message.text}</p>}
    </div>
  );
}
