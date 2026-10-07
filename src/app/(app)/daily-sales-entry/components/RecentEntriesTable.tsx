'use client';

import React, { useState } from 'react';
import { Trash2, Eye, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatRWFFull } from '@/lib/format';
import { isOrder, needsFollowUp } from '@/lib/visitRules';
import Link from 'next/link';
import { ORDER_STATUS_LABELS, type OrderStatusValue, type VisitLog } from '@/lib/types';
import Badge from '@/components/ui/Badge';

interface RecentEntriesTableProps {
  entries: VisitLog[];
  onDelete: (id: string) => Promise<void>;
  canDelete: (entry: VisitLog) => boolean;
}

type SortKey = keyof VisitLog;

function getOutcomeBadge(entry: VisitLog) {
  if (isOrder(entry)) return <Badge label={entry.visitOutcome} variant="success" dot />;
  if (needsFollowUp(entry)) return <Badge label={entry.visitOutcome} variant="warning" dot />;
  return <Badge label={entry.visitOutcome} variant="neutral" dot />;
}

function getOrderBadge(status: OrderStatusValue) {
  const variant = status === 'DELIVERED' ? 'success' : status === 'PENDING_APPROVAL' ? 'warning' : status === 'CANCELLED' ? 'error' : 'info';
  return <Badge label={ORDER_STATUS_LABELS[status]} variant={variant} />;
}

const PAGE_SIZE = 5;

export default function RecentEntriesTable({ entries, onDelete, canDelete }: RecentEntriesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('dateOfVisit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = [...entries].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    return sortDir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const handleDelete = async (entry: VisitLog) => {
    if (!window.confirm(`Delete the visit to ${entry.customerName} on ${entry.dateOfVisit}? This cannot be undone.`)) return;
    setDeletingId(entry.id);
    try {
      await onDelete(entry.id);
    } finally {
      setDeletingId(null);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortDir === 'asc' ? (
        <ChevronUp size={12} className="text-accent" />
      ) : (
        <ChevronDown size={12} className="text-accent" />
      )
    ) : (
      <ChevronDown size={12} className="text-muted-foreground opacity-40" />
    );

  if (entries.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
          <Eye size={22} className="text-muted-foreground" />
        </div>
        <h4 className="text-sm font-semibold text-foreground mb-1">
          No visit logs yet
        </h4>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Use the form above to log your first field visit. Entries will appear here immediately after saving.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Recent Visit Logs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entries.length} entries — last 60 days
          </p>
        </div>
        <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, entries.length)} of {entries.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              {(
                [
                  { key: 'dateOfVisit', label: 'Date' },
                  { key: 'salesperson', label: 'Rep' },
                  { key: 'customerName', label: 'Customer' },
                  { key: 'area', label: 'Area' },
                  { key: 'visitOutcome', label: 'Outcome' },
                  { key: 'orderNumber', label: 'Order' },
                  { key: 'productSummary', label: 'Products' },
                  { key: 'salesValue', label: 'Order Value' },
                  { key: 'orderStatus', label: 'Order Status' },
                  { key: 'customerType', label: 'Type' },
                  { key: 'nextFollowUpDate', label: 'Follow-up' },
                ] as { key: SortKey; label: string }[]
              ).map((col) => (
                <th
                  key={`th-${col.key}`}
                  className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    <SortIcon col={col.key} />
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageData.map((entry) => (
              <tr
                key={`entry-row-${entry.id}`}
                className={`hover:bg-muted/40 transition-all duration-300 ${
                  deletingId === entry.id ? 'opacity-0 max-h-0' : 'opacity-100'
                }`}
              >
                <td className="px-3 py-3 text-sm text-foreground whitespace-nowrap font-tabular">
                  {entry.dateOfVisit}
                </td>
                <td className="px-3 py-3 text-sm text-foreground whitespace-nowrap">
                  {entry.salesperson.split(' ')[0]}
                </td>
                <td className="px-3 py-3 text-sm font-medium text-foreground max-w-[180px] truncate">
                  {entry.customerName}
                </td>
                <td className="px-3 py-3 text-sm text-muted-foreground whitespace-nowrap">
                  {entry.area}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {getOutcomeBadge(entry)}
                </td>
                <td className="px-3 py-3 text-sm font-mono whitespace-nowrap">
                  {entry.orderNumber ? (
                    <Link href={`/orders?q=${entry.orderNumber}`} className="underline hover:text-accent">
                      {entry.orderNumber}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-3 text-sm text-muted-foreground max-w-[220px] truncate whitespace-nowrap" title={entry.productSummary}>
                  {entry.productSummary || '—'}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-foreground font-tabular whitespace-nowrap text-right">
                  {entry.salesValue > 0 ? formatRWFFull(entry.salesValue) : '—'}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {entry.orderStatus ? getOrderBadge(entry.orderStatus) : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {entry.customerType === 'New Customer' ? (
                    <Badge label="New" variant="accent" dot />
                  ) : (
                    <Badge label="Existing" variant="neutral" />
                  )}
                </td>
                <td className="px-3 py-3 text-sm text-muted-foreground font-tabular whitespace-nowrap">
                  {entry.nextFollowUpDate || '—'}
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {canDelete(entry) && (
                      <button
                        title="Delete this visit log — cannot be undone"
                        disabled={deletingId === entry.id}
                        onClick={() => handleDelete(entry)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-negative/10 hover:text-negative transition-colors disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-muted/20">
        <span className="text-xs text-muted-foreground">
          {entries.length} visit{entries.length !== 1 ? 's' : ''} total
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-7 h-7 rounded-md flex items-center justify-center border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={13} />
          </button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={`page-${i + 1}`}
              onClick={() => setPage(i + 1)}
              className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                page === i + 1
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-7 h-7 rounded-md flex items-center justify-center border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}