'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { useUser } from '@/context/UserContext';
import { canManageWarehouse, isManagerRole } from '@/lib/roles';
import { STOCK_MOVEMENT_LABELS, type ProductStock, type RoastRunDTO, type StockBatchDTO, type StockMovementDTO } from '@/lib/types';
import { AdjustStockModal, ReceiveStockModal, RoastRunModal } from './InventoryForms';

type Tab = 'stock' | 'batches' | 'roasting' | 'ledger';
/** Roasted coffee is best within about a month of roasting. */
const FRESH_DAYS = 30;

interface InventoryClientProps {
  stock: ProductStock[];
  batches: StockBatchDTO[];
  movements: StockMovementDTO[];
  roastRuns: RoastRunDTO[];
  today: string;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 3 });

export default function InventoryClient({ stock, batches, movements, roastRuns, today }: InventoryClientProps) {
  const router = useRouter();
  const { currentUser } = useUser();
  const canWarehouse = canManageWarehouse(currentUser.role);
  const canAdjust = isManagerRole(currentUser.role);
  const [tab, setTab] = useState<Tab>('stock');
  const [modal, setModal] = useState<'receive' | 'roast' | null>(null);
  const [adjusting, setAdjusting] = useState<StockBatchDTO | null>(null);
  const [productFilter, setProductFilter] = useState('');

  const done = (message: string) => {
    setModal(null);
    setAdjusting(null);
    toast.success(message);
    router.refresh();
  };

  const shortages = stock.filter((s) => s.available < 0);
  const expiredCount = batches.filter((b) => b.expired).length;
  const visibleBatches = batches.filter((b) => !productFilter || b.productId === productFilter);

  const th = 'px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold';
  const td = 'px-3 py-2';

  return (
    <div className="px-6 lg:px-8 py-6 max-w-screen-2xl mx-auto space-y-5">
      <Toaster position="bottom-right" richColors />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {shortages.length > 0 ? `${shortages.length} product(s) short for open orders · ` : ''}
            {expiredCount > 0 ? `${expiredCount} expired batch(es) · ` : ''}
            Stock by roast batch; oldest batches are used first.
          </p>
        </div>
        {canWarehouse && (
          <div className="flex gap-2">
            <button onClick={() => setModal('receive')} className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg">
              Receive Stock
            </button>
            <button onClick={() => setModal('roast')} className="px-4 py-2 text-sm font-semibold border border-border rounded-lg hover:bg-muted">
              Record Roast Run
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-border">
        {(
          [
            ['stock', 'Stock by Product'],
            ['batches', `Batches (${batches.length})`],
            ['roasting', `Roast Runs (${roastRuns.length})`],
            ['ledger', 'Stock Ledger'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === id ? 'border-primary font-semibold' : 'border-transparent text-muted-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className={`${th} text-left`}>Product</th>
                <th className={`${th} text-left`}>Unit</th>
                <th className={`${th} text-right`}>On hand (usable)</th>
                <th className={`${th} text-right`}>Reserved by open orders</th>
                <th className={`${th} text-right`}>Available</th>
                <th className={`${th} text-right`}>Expired</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stock.map((s) => (
                <tr
                  key={s.productId}
                  className="hover:bg-muted/40 cursor-pointer"
                  onClick={() => {
                    setProductFilter(s.productId);
                    setTab('batches');
                  }}
                >
                  <td className={`${td} font-medium`}>
                    {s.productName} {s.kind === 'GREEN' && <span className="text-xs text-muted-foreground">(green)</span>}
                  </td>
                  <td className={`${td} text-muted-foreground`}>{s.unitOfMeasure}</td>
                  <td className={`${td} text-right font-tabular`}>{fmt(s.onHand)}</td>
                  <td className={`${td} text-right font-tabular text-muted-foreground`}>{fmt(s.reserved)}</td>
                  <td className={`${td} text-right font-tabular font-semibold ${s.available < 0 ? 'text-negative' : ''}`}>
                    {fmt(s.available)}
                    {s.available < 0 && <span className="block text-xs font-normal">short</span>}
                  </td>
                  <td className={`${td} text-right font-tabular ${s.expired > 0 ? 'text-negative' : 'text-muted-foreground'}`}>{fmt(s.expired)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'batches' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-lg bg-background">
              <option value="">All products</option>
              {stock.map((s) => (
                <option key={s.productId} value={s.productId}>
                  {s.productName}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">Batches older than {FRESH_DAYS} days since roasting are flagged.</span>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-muted/40">
                <tr>
                  <th className={`${th} text-left`}>Product</th>
                  <th className={`${th} text-left`}>Batch</th>
                  <th className={`${th} text-left`}>Warehouse</th>
                  <th className={`${th} text-left`}>Roasted / received</th>
                  <th className={`${th} text-right`}>Age (days)</th>
                  <th className={`${th} text-left`}>Best before</th>
                  <th className={`${th} text-right`}>Quantity</th>
                  {canAdjust && <th className={th} />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleBatches.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      No stock. Use “Receive Stock” to record opening stock or deliveries from suppliers.
                    </td>
                  </tr>
                )}
                {visibleBatches.map((b) => {
                  const stale = !!b.roastDate && b.ageDays > FRESH_DAYS;
                  return (
                    <tr key={b.id} className={b.expired ? 'bg-negative-bg' : ''}>
                      <td className={`${td} font-medium`}>{b.productName}</td>
                      <td className={`${td} font-mono`}>{b.batchNumber}</td>
                      <td className={td}>{b.warehouseName}</td>
                      <td className={td}>{b.roastDate ? `Roasted ${b.roastDate}` : `Received ${b.receivedOn}`}</td>
                      <td className={`${td} text-right font-tabular ${stale ? 'text-warning font-semibold' : ''}`}>{b.ageDays}</td>
                      <td className={`${td} ${b.expired ? 'text-negative font-semibold' : ''}`}>
                        {b.bestBefore || '—'}
                        {b.expired && ' (expired)'}
                      </td>
                      <td className={`${td} text-right font-tabular`}>
                        {fmt(b.quantity)} {b.unitOfMeasure}
                      </td>
                      {canAdjust && (
                        <td className={`${td} text-right`}>
                          <button onClick={() => setAdjusting(b)} className="text-xs underline text-muted-foreground hover:text-foreground">
                            Count / adjust
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'roasting' && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted/40">
              <tr>
                <th className={`${th} text-left`}>Run</th>
                <th className={`${th} text-left`}>Date</th>
                <th className={`${th} text-left`}>Green used</th>
                <th className={`${th} text-left`}>Produced</th>
                <th className={`${th} text-right`}>In / out KG</th>
                <th className={`${th} text-right`}>Yield</th>
                <th className={`${th} text-left`}>By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roastRuns.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    No roast runs recorded yet.
                  </td>
                </tr>
              )}
              {roastRuns.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} font-mono`}>{r.runNumber}</td>
                  <td className={td}>{r.roastDate}</td>
                  <td className={td}>{r.inputs.map((i) => `${i.productName} ${fmt(i.quantity)} (lot ${i.batchNumber})`).join(', ')}</td>
                  <td className={td}>{r.outputs.map((o) => `${o.productName} ×${fmt(o.quantity)}`).join(', ')}</td>
                  <td className={`${td} text-right font-tabular`}>
                    {fmt(r.greenInputKg)} / {fmt(r.outputKg)}
                  </td>
                  <td className={`${td} text-right font-tabular`}>{r.yieldPct}%</td>
                  <td className={`${td} text-muted-foreground`}>{r.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'ledger' && (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted/40">
              <tr>
                <th className={`${th} text-left`}>When</th>
                <th className={`${th} text-left`}>Movement</th>
                <th className={`${th} text-left`}>Product / batch</th>
                <th className={`${th} text-right`}>Quantity</th>
                <th className={`${th} text-left`}>Reference</th>
                <th className={`${th} text-left`}>Reason</th>
                <th className={`${th} text-left`}>By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className={`${td} whitespace-nowrap`}>{new Date(m.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Kigali' })}</td>
                  <td className={td}>{STOCK_MOVEMENT_LABELS[m.type]}</td>
                  <td className={td}>
                    {m.productName} <span className="font-mono text-muted-foreground">{m.batchNumber}</span>
                  </td>
                  <td className={`${td} text-right font-tabular ${m.quantity < 0 ? 'text-negative' : 'text-positive'}`}>
                    {m.quantity > 0 ? '+' : ''}
                    {fmt(m.quantity)}
                  </td>
                  <td className={`${td} font-mono text-muted-foreground`}>{m.reference || '—'}</td>
                  <td className={`${td} text-muted-foreground`}>{m.reason || '—'}</td>
                  <td className={`${td} text-muted-foreground`}>{m.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-muted-foreground">Latest 300 movements. The ledger cannot be edited.</p>
        </div>
      )}

      {modal === 'receive' && <ReceiveStockModal today={today} onClose={() => setModal(null)} onSaved={done} />}
      {modal === 'roast' && <RoastRunModal today={today} onClose={() => setModal(null)} onSaved={done} />}
      {adjusting && <AdjustStockModal batch={adjusting} onClose={() => setAdjusting(null)} onSaved={done} />}
    </div>
  );
}
