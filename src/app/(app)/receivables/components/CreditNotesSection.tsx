'use client';

import React, { useState } from 'react';
import { useUser } from '@/context/UserContext';
import { approveCreditNote, recordRefund, rejectCreditNote, requestCreditNote } from '@/actions/creditNotes';
import { formatRWFFull } from '@/lib/format';
import {
  CREDIT_NOTE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  RETURN_DISPOSITION_LABELS,
  type ActionResult,
  type Invoice,
  type PaymentMethodValue,
  type ReturnDispositionValue,
} from '@/lib/types';

interface Props {
  invoice: Invoice;
  today: string;
  onUpdated: (invoice: Invoice, message: string) => void;
}

const inputClass = 'w-full border border-border rounded-lg px-3 py-2 text-sm bg-background';

/** Credit notes, refunds and the return/correction form for one invoice. */
export default function CreditNotesSection({ invoice, today, onUpdated }: Props) {
  const { canViewAllReps: isManager } = useUser();
  const [mode, setMode] = useState<'view' | 'request' | 'refund'>('view');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<ActionResult<Invoice>>, message: string) {
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

  const creditable = invoice.lines.filter((l) => l.quantity - l.creditedQuantity > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Returns &amp; credit notes</h3>
        {mode === 'view' && (
          <div className="flex gap-2">
            {creditable.length > 0 && invoice.status !== 'VOID' && (
              <button onClick={() => setMode('request')} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted">
                Return / credit…
              </button>
            )}
            {isManager && invoice.refundDue > 0 && (
              <button onClick={() => setMode('refund')} className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg">
                Record refund
              </button>
            )}
          </div>
        )}
      </div>

      {invoice.creditNotes.length === 0 && mode === 'view' && <p className="text-sm text-muted-foreground">None.</p>}
      {invoice.creditNotes.map((cn) => (
        <div key={cn.id} className="border border-border rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between gap-2">
            <span className="font-mono font-semibold">{cn.creditNoteNumber || 'Requested'}</span>
            <span className={cn.status === 'APPROVED' ? 'text-positive' : cn.status === 'REJECTED' ? 'text-negative' : 'text-warning'}>
              {CREDIT_NOTE_STATUS_LABELS[cn.status]}
            </span>
          </div>
          <p className="text-muted-foreground">
            {cn.requestedOn} by {cn.requestedBy} · {cn.reason}
          </p>
          <ul className="text-xs">
            {cn.lines.map((l, i) => (
              <li key={i}>
                {l.productName} ×{l.quantity} = {formatRWFFull(l.lineTotal)} — {RETURN_DISPOSITION_LABELS[l.disposition]}
              </li>
            ))}
          </ul>
          <p className="font-semibold">Credit {formatRWFFull(cn.total)} (VAT {formatRWFFull(cn.vatAmount)})</p>
          {cn.rejectedReason && <p className="text-negative text-xs">Rejected: {cn.rejectedReason}</p>}
          {isManager && cn.status === 'PENDING_APPROVAL' && (
            <PendingActions
              busy={busy}
              onApprove={() => run(() => approveCreditNote(cn.id), 'Credit note approved')}
              onReject={(reason) => run(() => rejectCreditNote(cn.id, reason), 'Credit note rejected')}
            />
          )}
        </div>
      ))}

      {invoice.refunds.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold">Refunds paid</p>
          {invoice.refunds.map((r) => (
            <p key={r.id} className="text-muted-foreground">
              <span className="font-mono">{r.refundNumber}</span> · {r.paidOn} · {PAYMENT_METHOD_LABELS[r.method]}
              {r.reference && ` · ${r.reference}`} · {formatRWFFull(r.amount)} by {r.paidBy}
            </p>
          ))}
        </div>
      )}

      {mode === 'request' && (
        <RequestForm
          invoice={invoice}
          busy={busy}
          onCancel={() => setMode('view')}
          onSubmit={(reason, lines) =>
            run(
              () => requestCreditNote({ invoiceId: invoice.id, reason, lines }),
              isManager ? 'Credit note requested — approve it to apply' : 'Credit note sent to a manager for approval'
            )
          }
        />
      )}

      {mode === 'refund' && (
        <RefundForm
          due={invoice.refundDue}
          today={today}
          busy={busy}
          onCancel={() => setMode('view')}
          onSubmit={(amount, method, reference, paidOn) =>
            run(() => recordRefund({ invoiceId: invoice.id, amount, method, reference, paidOn }), 'Refund recorded')
          }
        />
      )}

      {error && <p className="text-sm text-negative bg-negative-bg border border-negative/20 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}

function PendingActions({ busy, onApprove, onReject }: { busy: boolean; onApprove: () => void; onReject: (reason: string) => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  return rejecting ? (
    <div className="flex gap-2 pt-1">
      <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why reject?" />
      <button disabled={busy} onClick={() => onReject(reason)} className="px-3 py-1.5 text-xs bg-negative text-white rounded-lg">
        Reject
      </button>
      <button onClick={() => setRejecting(false)} className="px-3 py-1.5 text-xs border border-border rounded-lg">
        Back
      </button>
    </div>
  ) : (
    <div className="flex gap-2 pt-1">
      <button disabled={busy} onClick={onApprove} className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-60">
        Approve &amp; issue
      </button>
      <button onClick={() => setRejecting(true)} className="px-3 py-1.5 text-xs border border-negative/40 text-negative rounded-lg">
        Reject…
      </button>
    </div>
  );
}

function RequestForm({
  invoice,
  busy,
  onCancel,
  onSubmit,
}: {
  invoice: Invoice;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (reason: string, lines: { orderLineId: string; quantity: number; disposition: ReturnDispositionValue }[]) => void;
}) {
  const [reason, setReason] = useState('');
  const [rows, setRows] = useState(
    invoice.lines.map((l) => ({ ...l, remaining: Math.round((l.quantity - l.creditedQuantity) * 1000) / 1000, qty: '', disposition: 'RESTOCK' as ReturnDispositionValue }))
  );
  const set = (id: string, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x) => (x.orderLineId === id ? { ...x, ...patch } : x)));
  const chosen = rows.filter((r) => Number(r.qty) > 0);
  const estimate = chosen.reduce((s, r) => s + Number(r.qty) * r.unitPrice, 0);

  return (
    <fieldset className="border border-border rounded-lg p-3 space-y-3">
      <legend className="px-1 text-sm font-semibold">Return / credit request</legend>
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase text-muted-foreground">
          <tr>
            <th className="text-left py-1">Product</th>
            <th className="text-right py-1">Can credit</th>
            <th className="text-right py-1 w-24">Quantity</th>
            <th className="text-left py-1 pl-2">What happened</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.orderLineId}>
              <td className="py-1">{r.productName}</td>
              <td className="py-1 text-right font-tabular">{r.remaining}</td>
              <td className="py-1 pl-2">
                <input
                  className={`${inputClass} text-right`}
                  type="number"
                  min="0"
                  max={r.remaining}
                  step="any"
                  disabled={r.remaining <= 0}
                  value={r.qty}
                  onChange={(e) => set(r.orderLineId, { qty: e.target.value })}
                />
              </td>
              <td className="py-1 pl-2">
                <select className={inputClass} value={r.disposition} onChange={(e) => set(r.orderLineId, { disposition: e.target.value as ReturnDispositionValue })}>
                  {(Object.keys(RETURN_DISPOSITION_LABELS) as ReturnDispositionValue[]).map((d) => (
                    <option key={d} value={d}>
                      {RETURN_DISPOSITION_LABELS[d]}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => setRows((r) => r.map((x) => ({ ...x, qty: x.remaining > 0 ? String(x.remaining) : '' })))} className="text-xs underline">
        Credit everything still open (cancel the invoice)
      </button>
      <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. 3 bags damaged in transport" />
      <p className="text-sm">Credit ≈ {formatRWFFull(Math.round(estimate))} (incl. VAT). A manager must approve it before it applies.</p>
      <div className="flex gap-2">
        <button
          disabled={busy || chosen.length === 0}
          onClick={() => onSubmit(reason, chosen.map((r) => ({ orderLineId: r.orderLineId, quantity: Number(r.qty), disposition: r.disposition })))}
          className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
        >
          {busy ? 'Saving...' : 'Request credit note'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-border rounded-lg">
          Cancel
        </button>
      </div>
    </fieldset>
  );
}

function RefundForm({
  due,
  today,
  busy,
  onCancel,
  onSubmit,
}: {
  due: number;
  today: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (amount: number, method: PaymentMethodValue, reference: string, paidOn: string) => void;
}) {
  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState<PaymentMethodValue>('MTN_MOMO');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(today);
  return (
    <fieldset className="border border-border rounded-lg p-3 space-y-3">
      <legend className="px-1 text-sm font-semibold">Refund to customer (due {formatRWFFull(due)})</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input className={inputClass} type="number" min="0" max={due} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
        <input className={inputClass} type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} aria-label="Date" />
        <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethodValue)}>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === 'CASH' ? 'Reference (optional)' : 'Transaction ID'} />
      </div>
      <div className="flex gap-2">
        <button disabled={busy} onClick={() => onSubmit(Number(amount), method, reference, paidOn)} className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-60">
          {busy ? 'Saving...' : 'Record refund'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-border rounded-lg">
          Cancel
        </button>
      </div>
    </fieldset>
  );
}
