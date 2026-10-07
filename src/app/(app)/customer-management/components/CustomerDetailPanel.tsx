'use client';

import React, { useEffect, useState } from 'react';
import { formatRWFFull, formatRWF } from '@/lib/format';
import Link from 'next/link';
import { getCustomerVisits } from '@/actions/visits';
import { isOrder, needsFollowUp } from '@/lib/visitRules';
import type { Customer, VisitLog } from '@/lib/types';
import Badge from '@/components/ui/Badge';

interface CustomerDetailPanelProps {
  customer: Customer | null;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
}

function getStatusVariant(status: string) {
  if (status === 'Active') return 'success';
  if (status === 'Inactive') return 'error';
  return 'info';
}

export default function CustomerDetailPanel({ customer, onClose, onEdit }: CustomerDetailPanelProps) {
  const [customerVisits, setCustomerVisits] = useState<VisitLog[]>([]);
  const [visitsError, setVisitsError] = useState('');
  const customerId = customer?.id;

  useEffect(() => {
    if (!customerId) return;
    let active = true;
    setCustomerVisits([]);
    setVisitsError('');
    getCustomerVisits(customerId).then((res) => {
      if (!active) return;
      if (res.success) setCustomerVisits(res.data ?? []);
      else setVisitsError(res.error);
    });
    return () => {
      active = false;
    };
  }, [customerId]);

  if (!customer) return null;

  const capacityPct =
    customer.monthlyPotential > 0
      ? Math.round((customer.monthlyCapacity / customer.monthlyPotential) * 100)
      : 0;

  const healthColor =
    capacityPct >= 70
      ? 'bg-positive'
      : capacityPct >= 40
      ? 'bg-accent' :'bg-negative';

  const healthTextColor =
    capacityPct >= 70
      ? 'text-positive'
      : capacityPct >= 40
      ? 'text-accent' :'text-negative';

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-card border-l border-border shadow-2xl slide-in-right overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-start justify-between z-10">
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="text-base font-semibold text-foreground leading-tight">
              {customer.name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                label={customer.status}
                variant={getStatusVariant(customer.status)}
                dot
                size="sm"
              />
              <span className="text-xs text-muted-foreground">{customer.category.split('–')[0].trim()}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-5 space-y-5">
          {/* Contact info */}
          <div className="bg-muted/40 rounded-xl p-4 space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Contact
            </h4>
            <div className="flex items-center gap-2 text-sm">
              
              <span className="text-foreground">{customer.contactPerson || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-foreground font-tabular">{customer.phone || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              
              <span className="text-foreground">{customer.area}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              
              <span className="text-muted-foreground">Owner:</span>
              <span className="text-foreground">{customer.salesperson || 'Unassigned'}</span>
            </div>
          </div>

          {/* Account & credit */}
          <div className="bg-muted/40 rounded-xl p-4 space-y-2 text-sm">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Account &amp; Credit
            </h4>
            {[
              ['TIN', customer.tin || '—'],
              ['Address', [customer.sector, customer.district, customer.province].filter(Boolean).join(', ') || '—'],
              ['Payment terms', customer.paymentTermsDays > 0 ? `${customer.paymentTermsDays} days` : 'Cash on delivery'],
              ['Credit limit', customer.paymentTermsDays > 0 ? formatRWFFull(customer.creditLimit) : '—'],
              ['Outstanding', formatRWFFull(customer.outstandingBalance)],
              ['Open orders (not delivered)', formatRWFFull(customer.openOrdersTotal)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground font-tabular text-right">{value}</span>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Overdue</span>
              <span className={`font-tabular font-semibold ${customer.overdueBalance > 0 ? 'text-negative' : 'text-foreground'}`}>
                {formatRWFFull(customer.overdueBalance)}
              </span>
            </div>
            {customer.paymentTermsDays > 0 && (
              <div className="flex justify-between gap-4 border-t border-border pt-2">
                <span className="text-muted-foreground">Available credit</span>
                <span className="font-tabular font-semibold">
                  {formatRWFFull(Math.max(0, customer.creditLimit - customer.outstandingBalance - customer.openOrdersTotal))}
                </span>
              </div>
            )}
            <Link href={`/receivables?customer=${customer.id}`} className="block text-xs text-accent underline pt-1">
              View invoices &amp; payments
            </Link>
          </div>

          {/* Health metrics */}
          <div className="bg-muted/40 rounded-xl p-4 space-y-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Account Health — This Month
            </h4>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Capacity vs Potential</span>
                <span className={`text-sm font-bold font-tabular ${healthTextColor}`}>
                  {capacityPct}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full health-bar-fill ${healthColor}`}
                  style={{ width: `${Math.min(capacityPct, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-muted-foreground">
                  Actual: {formatRWF(customer.monthlyCapacity)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Potential: {formatRWF(customer.monthlyPotential)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card rounded-lg p-3 text-center border border-border">
                <p className="text-xl font-bold text-foreground font-tabular">
                  {customer.visitsThisMonth}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Visits</p>
              </div>
              <div className="bg-card rounded-lg p-3 text-center border border-border">
                <p className="text-xl font-bold text-foreground font-tabular">
                  {customer.ordersThisMonth}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Orders</p>
              </div>
              <div className="bg-card rounded-lg p-3 text-center border border-border">
                <p className="text-sm font-bold text-foreground font-tabular leading-tight mt-1">
                  {customer.lastOrderDate ? customer.lastOrderDate.slice(5) : '—'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Last Order</p>
              </div>
            </div>
          </div>

          {/* Next follow-up */}
          {customer.nextFollowUp && (
            <div className="flex items-center gap-3 bg-accent/5 border border-accent/20 rounded-xl p-4">
              
              <div>
                <p className="text-xs font-semibold text-accent">Next Follow-up</p>
                <p className="text-sm text-foreground font-tabular mt-0.5">
                  {customer.nextFollowUp}
                </p>
              </div>
            </div>
          )}

          {/* Remarks */}
          {customer.remarks && (
            <div className="bg-muted/40 rounded-xl p-4">
              <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Remarks
              </h4>
              <p className="text-sm text-foreground leading-relaxed">{customer.remarks}</p>
            </div>
          )}

          {/* Recent visits */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Recent Visits ({customerVisits.length})
            </h4>
            {customerVisits.length === 0 ? (
              <div className="bg-muted/40 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground">{visitsError || 'No visits logged for this customer'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {customerVisits.slice(0, 5).map((v) => (
                  <div
                    key={`detail-visit-${v.id}`}
                    className="bg-muted/40 rounded-lg p-3 border border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-foreground font-tabular">
                            {v.dateOfVisit}
                          </span>
                          <Badge
                            label={v.visitOutcome}
                            variant={isOrder(v) ? 'success' : needsFollowUp(v) ? 'warning' : 'neutral'}
                            size="sm"
                            dot
                          />
                        </div>
                        {v.salesValue > 0 && (
                          <p className="text-xs font-semibold text-foreground font-tabular">
                            {formatRWFFull(v.salesValue)}
                            <span className="text-muted-foreground font-normal ml-1">
                              · {v.orderNumber} · {v.productSummary}
                            </span>
                          </p>
                        )}
                        {v.remarks && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {v.remarks}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-card border-t border-border px-5 py-3 flex items-center gap-2">
          <Link
            href="/daily-sales-entry"
            className="flex-1 text-center bg-primary text-primary-foreground text-sm font-semibold py-2 rounded-lg hover:bg-primary/90 transition-colors active:scale-95"
          >
            Log Visit
          </Link>
          <Link
            href={`/orders?new=${customer.id}`}
            className="flex-1 text-center border border-border text-sm font-semibold py-2 rounded-lg hover:bg-muted transition-colors"
          >
            New Order
          </Link>
          <button
            onClick={() => onEdit(customer)}
            className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}