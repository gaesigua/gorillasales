'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { formatRWF, formatRWFFull } from '@/lib/format';
import { AGING_LABELS, type AgingBucket } from '@/lib/domain/receivables';
import { CREDIT_NOTE_STATUS_LABELS, type AgingTotals, type CreditNoteDTO, type Invoice } from '@/lib/types';
import InvoiceDrawer from './InvoiceDrawer';
import InvoiceStatusBadge from './InvoiceStatusBadge';

type Tab = 'OPEN' | 'OVERDUE' | 'PAID' | 'ALL' | 'CREDITS';
const TABS: { value: Tab; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PAID', label: 'Paid' },
  { value: 'ALL', label: 'All (180 days)' },
  { value: 'CREDITS', label: 'Credit notes' },
];
const BUCKETS: AgingBucket[] = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'];

interface ReceivablesClientProps {
  invoices: Invoice[];
  aging: AgingTotals;
  creditNotes: CreditNoteDTO[];
  today: string;
  initialCustomerId: string;
  initialSearch: string;
}

export default function ReceivablesClient({ invoices: initial, aging, creditNotes, today, initialCustomerId, initialSearch }: ReceivablesClientProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState(initial);
  useEffect(() => setInvoices(initial), [initial]);
  const [tab, setTab] = useState<Tab>(initialSearch ? 'ALL' : 'OPEN');
  const [search, setSearch] = useState(initialSearch);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const customers = useMemo(() => {
    const map = new Map<string, string>();
    invoices.forEach((i) => map.set(i.customerId, i.customerName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [invoices]);

  // Customers with the largest unpaid balances
  const debtors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; balance: number; overdue: number; oldestDue: string }>();
    invoices
      .filter((i) => i.balance > 0)
      .forEach((i) => {
        const d = map.get(i.customerId) ?? { id: i.customerId, name: i.customerName, balance: 0, overdue: 0, oldestDue: i.dueDate };
        d.balance += i.balance;
        if (i.status === 'OVERDUE') d.overdue += i.balance;
        if (i.dueDate < d.oldestDue) d.oldestDue = i.dueDate;
        map.set(i.customerId, d);
      });
    return [...map.values()].sort((a, b) => b.overdue - a.overdue || b.balance - a.balance).slice(0, 8);
  }, [invoices]);

  const filtered = invoices.filter((i) => {
    const q = search.trim().toLowerCase();
    const matchTab =
      tab === 'ALL' ||
      (tab === 'OPEN' && i.balance > 0) ||
      (tab === 'OVERDUE' && i.status === 'OVERDUE') ||
      (tab === 'PAID' && i.status === 'PAID');
    return (
      matchTab &&
      (!customerId || i.customerId === customerId) &&
      (!q ||
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.orderNumber.toLowerCase().includes(q) ||
        i.customerName.toLowerCase().includes(q) ||
        i.ebmReceiptNumber.toLowerCase().includes(q))
    );
  });
  const selected = invoices.find((i) => i.id === selectedId) ?? null;

  function replace(invoice: Invoice, message: string) {
    setInvoices((prev) => prev.map((i) => (i.id === invoice.id ? invoice : i)));
    toast.success(message);
    router.refresh();
  }

  return (
    <div className="px-6 lg:px-8 py-6 max-w-screen-2xl mx-auto space-y-5">
      <Toaster position="bottom-right" richColors />
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Receivables</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {formatRWFFull(aging.total)} outstanding · {formatRWFFull(aging.overdue)} overdue
        </p>
      </div>

      {/* Aging summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {BUCKETS.map((b) => (
          <div key={b} className="bg-card border border-border rounded-xl p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{AGING_LABELS[b]}</p>
            <p className={`text-lg font-bold font-tabular mt-1 ${b !== 'current' && aging[b] > 0 ? 'text-negative' : 'text-foreground'}`}>
              {formatRWF(aging[b])}
            </p>
          </div>
        ))}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total outstanding</p>
          <p className="text-lg font-bold font-tabular mt-1">{formatRWF(aging.total)}</p>
        </div>
      </div>

      {debtors.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <div className="px-4 py-3 border-b border-border text-sm font-semibold">Who owes the most</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Customer</th>
                <th className="text-right px-4 py-2">Outstanding</th>
                <th className="text-right px-4 py-2">Overdue</th>
                <th className="text-left px-4 py-2">Oldest due date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {debtors.map((d) => (
                <tr
                  key={d.id}
                  className="hover:bg-muted/40 cursor-pointer"
                  onClick={() => {
                    setCustomerId(d.id);
                    setTab('OPEN');
                  }}
                >
                  <td className="px-4 py-2 font-medium">{d.name}</td>
                  <td className="px-4 py-2 text-right font-tabular">{formatRWFFull(d.balance)}</td>
                  <td className={`px-4 py-2 text-right font-tabular ${d.overdue > 0 ? 'text-negative font-semibold' : ''}`}>
                    {formatRWFFull(d.overdue)}
                  </td>
                  <td className="px-4 py-2">{d.oldestDue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${tab === t.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
          >
            {t.label}
          </button>
        ))}
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="ml-auto px-3 py-2 text-sm border border-border rounded-lg bg-background">
          <option value="">All customers</option>
          {customers.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <div className="relative">
          
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Invoice, order, EBM # or customer"
            className="pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background w-64"
          />
        </div>
      </div>

      {tab === 'CREDITS' && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Credit note</th>
                <th className="text-left px-4 py-3">Invoice</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Reason</th>
                <th className="text-left px-4 py-3">Requested</th>
                <th className="text-right px-4 py-3">Credit</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {creditNotes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No credit notes yet. Open an invoice and choose “Return / credit…”.
                  </td>
                </tr>
              )}
              {creditNotes.map((cn) => (
                <tr
                  key={cn.id}
                  onClick={() => invoices.some((i) => i.id === cn.invoiceId) && setSelectedId(cn.invoiceId)}
                  className="hover:bg-muted/40 cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono">{cn.creditNoteNumber || '—'}</td>
                  <td className="px-4 py-3 font-mono">{cn.invoiceNumber}</td>
                  <td className="px-4 py-3">{cn.customerName}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[260px] truncate">{cn.reason}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {cn.requestedOn} · {cn.requestedBy}
                  </td>
                  <td className="px-4 py-3 text-right font-tabular">{formatRWFFull(cn.total)}</td>
                  <td className={`px-4 py-3 ${cn.status === 'PENDING_APPROVAL' ? 'text-warning font-semibold' : cn.status === 'REJECTED' ? 'text-negative' : ''}`}>
                    {CREDIT_NOTE_STATUS_LABELS[cn.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={`bg-card border border-border rounded-xl overflow-x-auto ${tab === 'CREDITS' ? 'hidden' : ''}`}>
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Invoice</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Issued</th>
              <th className="text-left px-4 py-3">Due</th>
              <th className="text-right px-4 py-3">Total</th>
              <th className="text-right px-4 py-3">Paid</th>
              <th className="text-right px-4 py-3">Balance</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">EBM #</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  No invoices match these filters.
                </td>
              </tr>
            )}
            {filtered.map((i) => (
              <tr key={i.id} onClick={() => setSelectedId(i.id)} className="hover:bg-muted/40 cursor-pointer">
                <td className="px-4 py-3 font-mono">
                  {i.invoiceNumber}
                  <div className="text-xs text-muted-foreground">{i.orderNumber}</div>
                </td>
                <td className="px-4 py-3 font-medium">{i.customerName}</td>
                <td className="px-4 py-3 whitespace-nowrap">{i.issueDate}</td>
                <td className={`px-4 py-3 whitespace-nowrap ${i.status === 'OVERDUE' ? 'text-negative font-semibold' : ''}`}>
                  {i.dueDate}
                  {i.daysOverdue > 0 && <div className="text-xs">{i.daysOverdue}d overdue</div>}
                </td>
                <td className="px-4 py-3 text-right font-tabular">{formatRWFFull(i.total)}</td>
                <td className="px-4 py-3 text-right font-tabular text-muted-foreground">{formatRWFFull(i.paid)}</td>
                <td className="px-4 py-3 text-right font-tabular font-semibold">{formatRWFFull(i.balance)}</td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={i.status} />
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{i.ebmReceiptNumber || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <InvoiceDrawer key={`${selected.id}|${selected.paid}|${selected.credited}|${selected.creditNotes.map((c) => c.status).join()}`} invoice={selected} today={today} onClose={() => setSelectedId(null)} onUpdated={replace} />
      )}
    </div>
  );
}
