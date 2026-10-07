'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Target, AlertCircle, ChevronDown, Users, CheckCircle2, XCircle, Clock, Download, FileText } from 'lucide-react';
import { formatRWF } from '@/lib/format';
import { MONTH_LONG as MONTHS } from '@/lib/dates';
import { needsFollowUp } from '@/lib/visitRules';
import { useUser } from '@/context/UserContext';
import { calculateCommission } from '@/lib/domain/commission';
import type { CreditNoteDTO, CommissionRule, Order, RepMonthlyTarget, SalespersonItem, VisitLog } from '@/lib/types';

// Per-rep monthly targets are managed via Admin Config → Monthly Targets tab

interface RepPerf {
  id: string;
  name: string;
  target: number;
  targetKg: number;
  actualSales: number;
  actualKg: number;
  achievementPct: number;
  achievementKgPct: number;
  orders: number;
  visits: number;
  outstandingFollowUps: number;
  paidSales: number; // collected on this month's orders
  creditSales: number; // invoiced but not yet paid
  commission: number;
}

/** Per-rep performance for one month: sales from orders, activity from visits. */
function buildMonthlyPerf(
  reps: SalespersonItem[],
  visits: VisitLog[],
  orders: Order[],
  targets: RepMonthlyTarget[],
  rules: CommissionRule[],
  credits: CreditNoteDTO[]
): RepPerf[] {
  // Include reps who are no longer active but still have activity or targets this month
  const repMap = new Map(reps.map((r) => [r.id, r.label]));
  visits.forEach((v) => repMap.set(v.salespersonId, v.salesperson));
  orders.forEach((o) => repMap.set(o.salespersonId, o.salesperson));
  targets.forEach((t) => repMap.set(t.salespersonId, t.repName));

  return [...repMap.entries()].map(([id, name]) => {
    const repVisits = visits.filter((v) => v.salespersonId === id);
    const repOrders = orders.filter((o) => o.salespersonId === id);
    const repTarget = targets.find((t) => t.salespersonId === id);

    // Net sales: orders minus credit notes issued this month for this rep's orders
    const credited = credits.filter((c) => c.salespersonId === id).reduce((s, c) => s + c.total, 0);
    const actualSales = Math.round((repOrders.reduce((s, o) => s + o.total, 0) - credited) * 100) / 100;
    const actualKg = Math.round(repOrders.reduce((s, o) => s + o.weightKg, 0) * 100) / 100;
    const paidSales = repOrders.reduce((s, o) => s + o.amountPaid, 0);
    const creditSales = repOrders.filter((o) => o.invoiceId).reduce((s, o) => s + Math.max(0, o.total - o.creditedAmount - o.amountPaid), 0);
    const target = repTarget?.targetAmount ?? 0;
    const targetKg = repTarget?.targetWeightKg ?? 0;
    const achievementPct = target > 0 ? Math.round((actualSales / target) * 100 * 10) / 10 : 0;
    const achievementKgPct = targetKg > 0 ? Math.round((actualKg / targetKg) * 100 * 10) / 10 : 0;
    const commission = calculateCommission(rules, actualSales, target).total;

    return {
      id,
      name,
      target,
      targetKg,
      actualSales,
      actualKg,
      achievementPct,
      achievementKgPct,
      orders: repOrders.length,
      visits: repVisits.length,
      outstandingFollowUps: repVisits.filter(needsFollowUp).length,
      paidSales,
      creditSales,
      commission,
    };
  });
}

function AchievementBadge({ pct }: { pct: number }) {
  if (pct >= 100) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700">
      <CheckCircle2 size={11} /> {pct}%
    </span>
  );
  if (pct >= 75) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700">
      <Clock size={11} /> {pct}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700">
      <XCircle size={11} /> {pct}%
    </span>
  );
}

interface MonthlyTargetsClientProps {
  month: number;
  year: number;
  years: number[];
  reps: SalespersonItem[];
  visits: VisitLog[];
  orders: Order[];
  targets: RepMonthlyTarget[];
  commissionRules: CommissionRule[];
  credits: CreditNoteDTO[];
}

export default function MonthlyTargetsClient({ month, year, years, reps, visits, orders, targets, commissionRules, credits }: MonthlyTargetsClientProps) {
  const router = useRouter();
  const { currentUser, canViewAllReps } = useUser();
  const selectedMonth = month;
  const selectedYear = year;
  const [exportMsg, setExportMsg] = useState('');

  const selectPeriod = (m: number, y: number) => router.push(`/monthly-targets?month=${m}&year=${y}`);

  const perfData = useMemo(
    () => buildMonthlyPerf(reps, visits, orders, targets, commissionRules, credits),
    [reps, visits, orders, targets, commissionRules, credits]
  );

  // The server only sends a sales officer their own visits and targets
  const visibleData = canViewAllReps ? perfData : perfData.filter((r) => r.id === currentUser.id);

  // Team aggregates (always from full data)
  const teamTarget = perfData.reduce((s, r) => s + r.target, 0);
  const teamTargetKg = perfData.reduce((s, r) => s + r.targetKg, 0);
  const teamActual = perfData.reduce((s, r) => s + r.actualSales, 0);
  const teamActualKg = perfData.reduce((s, r) => s + r.actualKg, 0);
  const teamAchievement = teamTarget > 0 ? Math.round((teamActual / teamTarget) * 100 * 10) / 10 : 0;
  const teamAchievementKg = teamTargetKg > 0 ? Math.round((teamActualKg / teamTargetKg) * 100 * 10) / 10 : 0;
  const teamOrders = perfData.reduce((s, r) => s + r.orders, 0);
  const teamFollowUps = perfData.reduce((s, r) => s + r.outstandingFollowUps, 0);

  function handleDownloadCSV() {
    const rows = [
      ['Officer', 'Target (RWF)', 'Target (KG)', 'Actual Sales (RWF)', 'Actual (KG)', 'Achievement % (RWF)', 'Achievement % (KG)', 'Orders', 'Visits', 'Follow-ups', 'Collected (RWF)', 'Unpaid (RWF)', 'Commission (RWF)'],
      ...visibleData.map((r) => [
        r.name, r.target, r.targetKg, r.actualSales, r.actualKg, r.achievementPct, r.achievementKgPct, r.orders, r.visits, r.outstandingFollowUps, r.paidSales, r.creditSales, r.commission,
      ]),
    ];
    if (canViewAllReps) {
      rows.push([]);
      rows.push(['TEAM TOTAL', teamTarget, teamTargetKg, teamActual, teamActualKg, teamAchievement, teamAchievementKg, teamOrders, perfData.reduce((s, r) => s + r.visits, 0), teamFollowUps, perfData.reduce((s, r) => s + r.paidSales, 0), perfData.reduce((s, r) => s + r.creditSales, 0), perfData.reduce((s, r) => s + r.commission, 0)]);
    }
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Monthly_Targets_${MONTHS[selectedMonth]}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg('CSV downloaded successfully.');
    setTimeout(() => setExportMsg(''), 3000);
  }

  function handleDownloadPDF() {
    const periodLabel = `${MONTHS[selectedMonth]} ${selectedYear}`;
    const rows = visibleData.map((r) => `
      <tr>
        <td>${r.name}</td>
        <td style="text-align:right">${r.target.toLocaleString()}</td>
        <td style="text-align:right">${r.targetKg.toLocaleString()} KG</td>
        <td style="text-align:right">${r.actualSales.toLocaleString()}</td>
        <td style="text-align:right">${r.actualKg.toLocaleString()} KG</td>
        <td style="text-align:center">${r.achievementPct}%</td>
        <td style="text-align:center">${r.achievementKgPct}%</td>
        <td style="text-align:center">${r.orders}</td>
        <td style="text-align:center">${r.visits}</td>
        <td style="text-align:center">${r.outstandingFollowUps}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Monthly Targets — ${periodLabel}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      p { color: #666; font-size: 13px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: #f3f4f6; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e5e7eb; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
      td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f9fafb; }
      .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; }
    </style></head><body>
    <h1>Monthly Targets — ${periodLabel}</h1>
    <p>Generated on ${new Date().toLocaleDateString()} · GorillaSales</p>
    <table>
      <thead><tr>
        <th>Officer</th>
        <th style="text-align:right">Target (RWF)</th>
        <th style="text-align:right">Target (KG)</th>
        <th style="text-align:right">Actual (RWF)</th>
        <th style="text-align:right">Actual (KG)</th>
        <th style="text-align:center">Achievement (RWF)</th>
        <th style="text-align:center">Achievement (KG)</th>
        <th style="text-align:center">Orders</th>
        <th style="text-align:center">Visits</th>
        <th style="text-align:center">Follow-ups</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">GorillaSales · Monthly Targets Report · ${periodLabel}</div>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.onload = () => { win.print(); URL.revokeObjectURL(url); };
    }
    setExportMsg('PDF print dialog opened.');
    setTimeout(() => setExportMsg(''), 3000);
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Monthly Targets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canViewAllReps
              ? 'All officers\' performance auto-aggregated from daily reports'
              : `Your monthly performance — ${currentUser.name}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => selectPeriod(Number(e.target.value), selectedYear)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => selectPeriod(selectedMonth, Number(e.target.value))}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          {/* Download buttons */}
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors"
            title="Download CSV"
          >
            <Download size={14} />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors"
            title="Download PDF"
          >
            <FileText size={14} />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {exportMsg && (
        <div className="flex items-center gap-2 bg-positive/10 border border-positive/30 text-positive text-sm px-4 py-3 rounded-lg">
          <CheckCircle2 size={15} />
          {exportMsg}
        </div>
      )}

      {/* Team KPI strip — only for managers */}
      {canViewAllReps && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Team Target (RWF)</p>
            <p className="text-xl font-bold text-foreground font-tabular">{formatRWF(teamTarget)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{perfData.length} officers</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Team Target (KG)</p>
            <p className="text-xl font-bold text-foreground font-tabular">{teamTargetKg.toLocaleString()} KG</p>
            <p className="text-xs text-muted-foreground mt-0.5">Actual: {teamActualKg.toLocaleString()} KG</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Team Actual (RWF)</p>
            <p className="text-xl font-bold text-accent font-tabular">{formatRWF(teamActual)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">From daily reports</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Achievement</p>
            <div className="flex items-baseline gap-2">
              <p className={`text-xl font-bold font-tabular ${teamAchievement >= 100 ? 'text-green-600' : teamAchievement >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                {teamAchievement}%
              </p>
              <span className="text-xs text-muted-foreground">RWF</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`text-xs font-semibold ${teamAchievementKg >= 100 ? 'text-green-600' : teamAchievementKg >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                {teamAchievementKg}%
              </span>
              <span className="text-xs text-muted-foreground">KG</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
              <div
                className={`h-1.5 rounded-full health-bar-fill ${teamAchievement >= 100 ? 'bg-green-500' : teamAchievement >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(teamAchievement, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Performance Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Users size={16} className="text-accent" />
          <h2 className="text-sm font-semibold text-foreground">
            Officer Performance — {MONTHS[selectedMonth]} {selectedYear}
          </h2>
          <span className="ml-auto text-xs text-muted-foreground hidden sm:inline">Auto-aggregated from daily reports</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Officer</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target (RWF)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target (KG)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actual (RWF)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actual (KG)</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Achiev. RWF</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Achiev. KG</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Orders</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visits</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Follow-ups</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission</th>
              </tr>
            </thead>
            <tbody>
              {visibleData.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-muted-foreground text-sm">
                    No data for this period.
                  </td>
                </tr>
              )}
              {visibleData.map((rep, idx) => {
                const gapRwf = rep.target - rep.actualSales;
                const gapKg = rep.targetKg - rep.actualKg;
                const barPct = Math.min(rep.achievementPct, 100);
                const barColor =
                  rep.achievementPct >= 100 ? 'bg-green-500' :
                  rep.achievementPct >= 75  ? 'bg-amber-500' : 'bg-red-500';

                return (
                  <tr
                    key={rep.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                      idx % 2 === 0 ? '' : 'bg-muted/10'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">
                          {rep.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{rep.name}</p>
                          {gapRwf > 0 ? (
                            <p className="text-[11px] text-muted-foreground">
                              Gap: <span className="text-negative font-semibold">{formatRWF(gapRwf)}</span>
                            </p>
                          ) : (
                            <p className="text-[11px] text-green-600 font-semibold">RWF target exceeded ✓</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-tabular text-muted-foreground">
                      {formatRWF(rep.target)}
                    </td>
                    <td className="px-4 py-3 text-right font-tabular text-muted-foreground">
                      {rep.targetKg.toLocaleString()} KG
                    </td>
                    <td className="px-4 py-3 text-right font-tabular font-bold text-foreground">
                      {formatRWF(rep.actualSales)}
                    </td>
                    <td className="px-4 py-3 text-right font-tabular font-bold text-foreground">
                      {rep.actualKg.toLocaleString()} KG
                    </td>
                    <td className="px-4 py-3 text-center">
                      <AchievementBadge pct={rep.achievementPct} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <AchievementBadge pct={rep.achievementKgPct} />
                    </td>
                    <td className="px-4 py-3 text-right font-tabular font-semibold text-foreground">
                      {rep.orders}
                    </td>
                    <td className="px-4 py-3 text-right font-tabular text-muted-foreground">
                      {rep.visits}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {rep.outstandingFollowUps > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700">
                          <AlertCircle size={10} />
                          {rep.outstandingFollowUps}
                        </span>
                      ) : (
                        <span className="text-xs text-green-600 font-semibold">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-tabular font-semibold text-foreground">
                      {formatRWF(rep.commission)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {canViewAllReps && visibleData.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Team Total
                  </td>
                  <td className="px-4 py-3 text-right font-tabular font-bold text-muted-foreground">
                    {formatRWF(teamTarget)}
                  </td>
                  <td className="px-4 py-3 text-right font-tabular font-bold text-muted-foreground">
                    {teamTargetKg.toLocaleString()} KG
                  </td>
                  <td className="px-4 py-3 text-right font-tabular font-bold text-foreground">
                    {formatRWF(teamActual)}
                  </td>
                  <td className="px-4 py-3 text-right font-tabular font-bold text-foreground">
                    {teamActualKg.toLocaleString()} KG
                  </td>
                  <td className="px-4 py-3 text-center">
                    <AchievementBadge pct={teamAchievement} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <AchievementBadge pct={teamAchievementKg} />
                  </td>
                  <td className="px-4 py-3 text-right font-tabular font-bold text-foreground">
                    {teamOrders}
                  </td>
                  <td className="px-4 py-3 text-right font-tabular font-bold text-muted-foreground">
                    {perfData.reduce((s, r) => s + r.visits, 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {teamFollowUps > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700">
                        <AlertCircle size={10} />
                        {teamFollowUps}
                      </span>
                    ) : (
                      <span className="text-xs text-green-600 font-semibold">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-tabular font-bold text-foreground">
                    {formatRWF(perfData.reduce((s, r) => s + r.commission, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Legend note */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-green-600" /> ≥ 100% — Target met</span>
        <span className="flex items-center gap-1.5"><Clock size={12} className="text-amber-600" /> 75–99% — On track</span>
        <span className="flex items-center gap-1.5"><XCircle size={12} className="text-red-600" /> &lt; 75% — Below target</span>
        <span className="ml-auto italic hidden sm:inline">Data auto-aggregated from daily sales entries</span>
      </div>
    </div>
  );
}
