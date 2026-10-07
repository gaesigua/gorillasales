'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { useConfig } from '@/context/ConfigContext';
import { useUser } from '@/context/UserContext';
import { formatRWF, formatRWFFull } from '@/lib/format';
import type { CustomerOption, Order, OrderStatusValue, PriceBook } from '@/lib/types';
import NewOrderModal from './NewOrderModal';
import OrderDetailDrawer from './OrderDetailDrawer';
import OrderStatusBadge from './OrderStatusBadge';

type StatusFilter = 'ALL' | OrderStatusValue;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING_APPROVAL', label: 'Credit Hold' },
  { value: 'CONFIRMED', label: 'To Deliver' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

interface OrdersClientProps {
  orders: Order[];
  customers: CustomerOption[];
  priceBook: PriceBook;
  today: string;
  initialNewCustomerId: string;
  initialSearch: string;
}

export default function OrdersClient({ orders: initialOrders, customers, priceBook, today, initialNewCustomerId, initialSearch }: OrdersClientProps) {
  const router = useRouter();
  const { config } = useConfig();
  const { canViewAllReps } = useUser();
  const [orders, setOrders] = useState(initialOrders);
  useEffect(() => setOrders(initialOrders), [initialOrders]);
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState(initialSearch);
  const [repId, setRepId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(!!initialNewCustomerId);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: orders.length };
    orders.forEach((o) => (c[o.status] = (c[o.status] ?? 0) + 1));
    return c;
  }, [orders]);

  const filtered = orders.filter((o) => {
    const q = search.trim().toLowerCase();
    return (
      (status === 'ALL' || o.status === status) &&
      (!repId || o.salespersonId === repId) &&
      (!q || o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.invoiceNumber.toLowerCase().includes(q))
    );
  });
  const selected = orders.find((o) => o.id === selectedId) ?? null;
  const openValue = orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'PENDING_APPROVAL').reduce((s, o) => s + o.total, 0);

  function replace(order: Order, message: string) {
    setOrders((prev) => {
      const exists = prev.some((o) => o.id === order.id);
      return exists ? prev.map((o) => (o.id === order.id ? order : o)) : [order, ...prev];
    });
    toast.success(message);
    router.refresh();
  }

  return (
    <div className="px-6 lg:px-8 py-6 max-w-screen-2xl mx-auto space-y-5">
      <Toaster position="bottom-right" richColors />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {counts.PENDING_APPROVAL ?? 0} on credit hold · {counts.CONFIRMED ?? 0} to deliver · {formatRWF(openValue)} open
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
        >
           New Order
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatus(t.value)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              status === t.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
            }`}
          >
            {t.label} ({counts[t.value] ?? 0})
          </button>
        ))}
        <div className="relative ml-auto">
          
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order #, invoice # or customer"
            className="pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background w-64"
          />
        </div>
        {canViewAllReps && (
          <select value={repId} onChange={(e) => setRepId(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-lg bg-background">
            <option value="">All reps</option>
            {config.salespeople.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Order</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Rep</th>
              <th className="text-left px-4 py-3">Products</th>
              <th className="text-right px-4 py-3">Total</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No orders match these filters.
                </td>
              </tr>
            )}
            {filtered.map((o) => (
              <tr key={o.id} onClick={() => setSelectedId(o.id)} className="hover:bg-muted/40 cursor-pointer">
                <td className="px-4 py-3 font-mono">{o.orderNumber}</td>
                <td className="px-4 py-3 whitespace-nowrap">{o.orderDate}</td>
                <td className="px-4 py-3 font-medium">{o.customerName}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.salesperson}</td>
                <td className="px-4 py-3 text-muted-foreground max-w-[260px] truncate" title={o.lines.map((l) => `${l.productName} ×${l.quantity}`).join(', ')}>
                  {o.lines.map((l) => `${l.productName} ×${l.quantity}`).join(', ')}
                </td>
                <td className="px-4 py-3 text-right font-tabular font-semibold">{formatRWFFull(o.total)}</td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={o.status} />
                  {o.deliveryRunNumber && o.status === 'CONFIRMED' && (
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{o.deliveryRunNumber}</div>
                  )}
                  {o.stockShort && o.stockShort.length > 0 && <div className="text-xs text-negative mt-0.5">Short of stock</div>}
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{o.invoiceNumber || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <NewOrderModal
          customers={customers}
          priceBook={priceBook}
          today={today}
          initialCustomerId={initialNewCustomerId}
          onClose={() => setShowNew(false)}
          onCreated={(order) => {
            setShowNew(false);
            replace(
              order,
              order.status === 'PENDING_APPROVAL'
                ? `${order.orderNumber} placed — on credit hold for manager approval`
                : `${order.orderNumber} placed and confirmed`
            );
            setSelectedId(order.id);
          }}
        />
      )}
      {selected && <OrderDetailDrawer key={selected.id + selected.status} order={selected} today={today} onClose={() => setSelectedId(null)} onUpdated={replace} />}
    </div>
  );
}
