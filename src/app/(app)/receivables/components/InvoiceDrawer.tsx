'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { useConfig } from '@/context/ConfigContext';
import { recordPayment, setEbmReceiptNumber } from '@/actions/payments';
import { canSetEbmNumber } from '@/lib/roles';
import { formatRWFFull } from '@/lib/format';
import { PAYMENT_METHOD_LABELS, type Invoice, type PaymentMethodValue } from '@/lib/types';
import InvoiceStatusBadge from './InvoiceStatusBadge';

interface InvoiceDrawerProps {
  invoice: Invoice;
  today: string;
  onClose: () => void;
  onUpdated: (invoice: Invoice, message: string) => void;
}

export default function InvoiceDrawer({ invoice, today, onClose, onUpdated }: InvoiceDrawerProps) {
  const { currentUser } = useUser();
  const { config } = useConfig();
  const [amount, setAmount] = useState(String(invoice.balance));
  const [method, setMethod] = useState<PaymentMethodValue>('MTN_MOMO');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(today);
  const [notes, setNotes] = useState('');
  const [ebm, setEbm] = useState(invoice.ebmReceiptNumber);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await recordPayment({ invoiceId: invoice.id, amount: Number(amount), method, reference, paidOn, notes });
      if (!res.success) return setError(res.error);
      if (res.data) onUpdated(res.data, `Payment of ${formatRWFFull(Number(amount))} recorded on ${invoice.invoiceNumber}`);
      setReference('');
      setNotes('');
    } finally {
      setBusy(false);
    }
  };

  const saveEbm = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await setEbmReceiptNumber(invoice.id, ebm);
      if (!res.success) return setError(res.error);
      if (res.data) onUpdated(res.data, 'EBM receipt number saved');
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card border-l border-border shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-start justify-between z-10">
          <div>
            <h2 className="text-base font-semibold font-mono">{invoice.invoiceNumber}</h2>
            <p className="text-sm text-muted-foreground">
              {invoice.customerName} · order {invoice.orderNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <InvoiceStatusBadge status={invoice.status} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Seller TIN</dt>
            <dd>{config.settings.tin || '— (set in Config)'}</dd>
            <dt className="text-muted-foreground">Customer TIN</dt>
            <dd>{invoice.customerTin || '—'}</dd>
            <dt className="text-muted-foreground">Issued</dt>
            <dd>{invoice.issueDate}</dd>
            <dt className="text-muted-foreground">Due</dt>
            <dd className={invoice.status === 'OVERDUE' ? 'text-negative font-semibold' : ''}>
              {invoice.dueDate}
              {invoice.daysOverdue > 0 && ` (${invoice.daysOverdue} days overdue)`}
            </dd>
            <dt className="text-muted-foreground">Sales rep</dt>
            <dd>{invoice.salesperson}</dd>
            <dt className="text-muted-foreground">Subtotal (excl. VAT)</dt>
            <dd className="font-tabular">{formatRWFFull(invoice.subtotal)}</dd>
            <dt className="text-muted-foreground">VAT {invoice.vatRate}%</dt>
            <dd className="font-tabular">{formatRWFFull(invoice.vatAmount)}</dd>
            <dt className="font-semibold">Total</dt>
            <dd className="font-tabular font-semibold">{formatRWFFull(invoice.total)}</dd>
            <dt className="text-muted-foreground">Paid</dt>
            <dd className="font-tabular">{formatRWFFull(invoice.paid)}</dd>
            <dt className="font-semibold">Balance due</dt>
            <dd className="font-tabular font-bold">{formatRWFFull(invoice.balance)}</dd>
          </dl>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Payments</h3>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <table className="w-full text-sm border border-border">
                <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Receipt</th>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Method</th>
                    <th className="text-right px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoice.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 font-mono">{p.paymentNumber}</td>
                      <td className="px-3 py-2">{p.paidOn}</td>
                      <td className="px-3 py-2">
                        {PAYMENT_METHOD_LABELS[p.method]}
                        {p.reference && <span className="text-muted-foreground"> · {p.reference}</span>}
                        <div className="text-xs text-muted-foreground">by {p.receivedBy}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-tabular">{formatRWFFull(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {invoice.balance > 0 && (
            <fieldset className="border border-border rounded-lg p-4 space-y-3">
              <legend className="px-1 text-sm font-semibold">Record payment</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Amount (RWF)</label>
                  <input type="number" min="0" max={invoice.balance} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Date received</label>
                  <input type="date" min={invoice.issueDate} max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputClass} />
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
                  <label className="block text-xs font-semibold mb-1">
                    Reference {method !== 'CASH' && <span className="text-negative">*</span>}
                  </label>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={method === 'MTN_MOMO' || method === 'AIRTEL_MONEY' ? 'Transaction ID' : method === 'CASH' ? 'Optional' : 'Reference'}
                    className={inputClass}
                  />
                </div>
              </div>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className={inputClass} />
              <button onClick={pay} disabled={busy} className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-60">
                {busy ? 'Saving...' : 'Record payment'}
              </button>
            </fieldset>
          )}

          <fieldset className="border border-border rounded-lg p-4 space-y-2">
            <legend className="px-1 text-sm font-semibold">EBM receipt</legend>
            {canSetEbmNumber(currentUser.role) ? (
              <div className="flex gap-2">
                <input value={ebm} onChange={(e) => setEbm(e.target.value)} placeholder="Receipt number from the EBM" className={inputClass} />
                <button onClick={saveEbm} disabled={busy || ebm === invoice.ebmReceiptNumber} className="px-4 py-2 text-sm border border-border rounded-lg disabled:opacity-50">
                  Save
                </button>
              </div>
            ) : (
              <p className="text-sm">{invoice.ebmReceiptNumber || 'Not recorded yet'}</p>
            )}
          </fieldset>

          {error && <p className="text-sm text-negative bg-negative-bg border border-negative/20 rounded-lg px-3 py-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}
