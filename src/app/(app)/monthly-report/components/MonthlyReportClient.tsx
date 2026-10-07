'use client';

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Users,
  ShoppingCart,
  DollarSign,
  BarChart2,
  ChevronDown,
  CheckCircle,
  User,
  Trophy,
  Award,
  Zap,
} from 'lucide-react';
import { formatRWF } from '@/lib/format';
import { MONTH_LONG as MONTHS, monthLastDay } from '@/lib/dates';
import { isOrder, needsFollowUp } from '@/lib/visitRules';
import { getVisitsForPeriod } from '@/actions/visits';
import { useUser } from '@/context/UserContext';
import { useConfig } from '@/context/ConfigContext';
import type { RepMonthlyTarget, VisitLog } from '@/lib/types';

function findTarget(targets: RepMonthlyTarget[], repName: string, month: number, year: number) {
  return targets.find((t) => t.repName === repName && t.month === month && t.year === year);
}
const getRepTarget = (targets: RepMonthlyTarget[], repName: string, month: number, year: number) =>
  findTarget(targets, repName, month, year)?.targetAmount ?? 0;
const getRepTargetWeight = (targets: RepMonthlyTarget[], repName: string, month: number, year: number) =>
  findTarget(targets, repName, month, year)?.targetWeightKg ?? 0;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function localDateString(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const QUARTERS = [
  { label: 'Q1 (Jan–Mar)', months: [0, 1, 2] },
  { label: 'Q2 (Apr–Jun)', months: [3, 4, 5] },
  { label: 'Q3 (Jul–Sep)', months: [6, 7, 8] },
  { label: 'Q4 (Oct–Dec)', months: [9, 10, 11] },
];

type ReportType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const REPORT_TABS: { key: ReportType; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'yearly', label: 'Yearly' },
];

interface RepSummary {
  name: string;
  totalVisits: number;
  ordersPlaced: number;
  totalSales: number;
  totalKg: number;
  followUps: number;
  paidSales: number;
  creditSales: number;
}

function getWeekRange(year: number, week: number): { start: Date; end: Date } {
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  const startOffset = (week - 1) * 7 - dayOfWeek + 1;
  const start = new Date(year, 0, 1 + startOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function getWeeksInYear(year: number): number {
  const dec31 = new Date(year, 11, 31);
  const jan1 = new Date(year, 0, 1);
  const days = Math.round((dec31.getTime() - jan1.getTime()) / 86400000) + 1;
  return Math.ceil(days / 7);
}

function buildReportFromLogs(logs: VisitLog[], repNamesAll: string[], repFilter?: string) {
  const filtered = repFilter ? logs.filter((v) => v.salesperson === repFilter) : logs;

  const totalSales = filtered.reduce((s, v) => s + v.salesValue, 0);
  const totalKg = Math.round(filtered.reduce((s, v) => s + v.weightKg, 0) * 100) / 100;
  const totalVisits = filtered.length;
  const ordersPlaced = filtered.filter(isOrder).length;
  const followUps = filtered.filter(needsFollowUp).length;
  const paidSales = filtered.filter((v) => v.paymentStatus === 'Paid').reduce((s, v) => s + v.salesValue, 0);
  const creditSales = filtered.filter((v) => v.paymentStatus === 'Credit').reduce((s, v) => s + v.salesValue, 0);

  const repNames = repFilter ? [repFilter] : repNamesAll;
  const byRep: Record<string, RepSummary> = {};
  repNames.forEach((name) => {
    byRep[name] = { name, totalVisits: 0, ordersPlaced: 0, totalSales: 0, totalKg: 0, followUps: 0, paidSales: 0, creditSales: 0 };
  });
  filtered.forEach((v) => {
    if (!byRep[v.salesperson]) {
      byRep[v.salesperson] = { name: v.salesperson, totalVisits: 0, ordersPlaced: 0, totalSales: 0, totalKg: 0, followUps: 0, paidSales: 0, creditSales: 0 };
    }
    byRep[v.salesperson].totalVisits++;
    if (isOrder(v)) byRep[v.salesperson].ordersPlaced++;
    if (needsFollowUp(v)) byRep[v.salesperson].followUps++;
    byRep[v.salesperson].totalSales += v.salesValue;
    byRep[v.salesperson].totalKg += v.weightKg;
    if (v.paymentStatus === 'Paid') byRep[v.salesperson].paidSales += v.salesValue;
    if (v.paymentStatus === 'Credit') byRep[v.salesperson].creditSales += v.salesValue;
  });

  const byProduct: Record<string, { qty: number; sales: number }> = {};
  filtered.forEach((v) => {
    if (!byProduct[v.productCategory]) byProduct[v.productCategory] = { qty: 0, sales: 0 };
    byProduct[v.productCategory].qty += v.quantity;
    byProduct[v.productCategory].sales += v.salesValue;
  });

  return {
    filtered,
    totalSales,
    totalKg,
    totalVisits,
    ordersPlaced,
    followUps,
    paidSales,
    creditSales,
    repSummaries: Object.values(byRep).sort((a, b) => b.totalSales - a.totalSales),
    productBreakdown: Object.entries(byProduct)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.sales - a.sales),
  };
}


interface RepBadge {
  label: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
}

function computeBadges(repSummaries: RepSummary[]): Record<string, RepBadge[]> {
  const result: Record<string, RepBadge[]> = {};
  if (repSummaries.length === 0) return result;

  const topPerformer = [...repSummaries].sort((a, b) => b.totalSales - a.totalSales)[0];
  const mostImproved = [...repSummaries]
    .filter((r) => r.totalVisits > 0)
    .sort((a, b) => (b.ordersPlaced / b.totalVisits) - (a.ordersPlaced / a.totalVisits))[0];
  const fastestCloser = [...repSummaries].sort((a, b) => b.ordersPlaced - a.ordersPlaced)[0];

  if (topPerformer) {
    if (!result[topPerformer.name]) result[topPerformer.name] = [];
    result[topPerformer.name].push({ label: 'Top Performer', color: 'text-amber-700', bg: 'bg-amber-100 border-amber-300', icon: <Trophy size={11} /> });
  }
  if (mostImproved && mostImproved.totalVisits > 0) {
    if (!result[mostImproved.name]) result[mostImproved.name] = [];
    result[mostImproved.name].push({ label: 'Most Improved', color: 'text-violet-700', bg: 'bg-violet-100 border-violet-300', icon: <Award size={11} /> });
  }
  if (fastestCloser && fastestCloser.ordersPlaced > 0) {
    if (!result[fastestCloser.name]) result[fastestCloser.name] = [];
    result[fastestCloser.name].push({ label: 'Fastest Closer', color: 'text-sky-700', bg: 'bg-sky-100 border-sky-300', icon: <Zap size={11} /> });
  }

  return result;
}

interface MonthlyReportClientProps {
  today: string;
  years: number[];
  targets: RepMonthlyTarget[];
}

export default function MonthlyReportClient({ today, years, targets }: MonthlyReportClientProps) {
  const { currentUser, canViewAllReps } = useUser();
  const { config } = useConfig();
  const now = new Date(`${today}T12:00:00`);
  const YEARS = years.map(String);

  // Report type tab
  const [reportType, setReportType] = useState<ReportType>('monthly');

  // Period selectors
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedRep, setSelectedRep] = useState<string>(canViewAllReps ? '' : currentUser.name);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedWeekYear, setSelectedWeekYear] = useState(now.getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(now.getMonth() / 3));
  const [selectedQuarterYear, setSelectedQuarterYear] = useState(now.getFullYear());
  const [selectedYearOnly, setSelectedYearOnly] = useState(now.getFullYear());

  const [generated, setGenerated] = useState(false);
  const [logs, setLogs] = useState<VisitLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');

  const effectiveRep = canViewAllReps ? selectedRep : currentUser.name;

  const weeksInYear = useMemo(() => getWeeksInYear(selectedWeekYear), [selectedWeekYear]);

  // Inclusive date range (YYYY-MM-DD) of the selected period
  function getPeriodRange(): { from: string; to: string } {
    if (reportType === 'daily') return { from: selectedDate, to: selectedDate };
    if (reportType === 'weekly') {
      const { start, end } = getWeekRange(selectedWeekYear, selectedWeek);
      return { from: localDateString(start), to: localDateString(end) };
    }
    if (reportType === 'quarterly') {
      const months = QUARTERS[selectedQuarter].months;
      return {
        from: `${selectedQuarterYear}-${pad2(months[0] + 1)}-01`,
        to: monthLastDay(selectedQuarterYear, months[months.length - 1]),
      };
    }
    if (reportType === 'yearly') return { from: `${selectedYearOnly}-01-01`, to: `${selectedYearOnly}-12-31` };
    return { from: `${selectedYear}-${pad2(selectedMonth + 1)}-01`, to: monthLastDay(selectedYear, selectedMonth) };
  }

  const repNamesAll = useMemo(() => config.salespeople.map((s) => s.label), [config.salespeople]);
  const report = useMemo(
    () => buildReportFromLogs(logs, canViewAllReps ? repNamesAll : [currentUser.name], effectiveRep || undefined),
    [logs, repNamesAll, canViewAllReps, currentUser.name, effectiveRep]
  );

  const badges = useMemo(() => computeBadges(report.repSummaries), [report.repSummaries]);
  const showLeaderboard = canViewAllReps && !effectiveRep;

  function getPeriodLabel(): string {
    if (reportType === 'daily') return selectedDate;
    if (reportType === 'weekly') {
      const { start, end } = getWeekRange(selectedWeekYear, selectedWeek);
      return `Week ${selectedWeek} (${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    }
    if (reportType === 'monthly') return `${MONTHS[selectedMonth]} ${selectedYear}`;
    if (reportType === 'quarterly') return `${QUARTERS[selectedQuarter].label} ${selectedQuarterYear}`;
    return `${selectedYearOnly}`;
  }

  function handleTabChange(tab: ReportType) {
    setReportType(tab);
    setGenerated(false);
  }

  async function handleGenerate() {
    const { from, to } = getPeriodRange();
    setLoading(true);
    setLoadError('');
    try {
      const res = await getVisitsForPeriod(from, to);
      if (!res.success) {
        setLoadError(res.error);
        setGenerated(false);
        return;
      }
      setLogs(res.data ?? []);
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  }

  function handleExportCSV() {
    const rows = [
      ['Sales Rep', 'Total Visits', 'Orders Placed', 'Total Sales (RWF)', 'Total (KG)', 'Paid (RWF)', 'Credit (RWF)', 'Follow-ups'],
      ...report.repSummaries.map((r) => [
        r.name, r.totalVisits, r.ordersPlaced, r.totalSales, r.totalKg, r.paidSales, r.creditSales, r.followUps,
      ]),
      [],
      ['TOTAL', report.totalVisits, report.ordersPlaced, report.totalSales, report.totalKg, report.paidSales, report.creditSales, report.followUps],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)}_Report_${getPeriodLabel().replace(/[^a-zA-Z0-9]/g, '_')}${effectiveRep ? `_${effectiveRep.split(' ')[0]}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportSuccess('CSV exported successfully.');
    setTimeout(() => setExportSuccess(''), 3000);
  }

  function handleExportPDF() {
    const periodLabel = getPeriodLabel();
    const dateStr = new Date().toLocaleDateString();
    const conversionRate = report.totalVisits > 0 ? Math.round((report.ordersPlaced / report.totalVisits) * 100) : 0;

    const repRows = report.repSummaries.map((r, i) => {
      const tgt = reportType === 'monthly' ? getRepTarget(targets, r.name, selectedMonth, selectedYear) : 0;
      const tgtKg = reportType === 'monthly' ? getRepTargetWeight(targets, r.name, selectedMonth, selectedYear) : 0;
      const achPct = tgt > 0 ? Math.round((r.totalSales / tgt) * 100) : 0;
      const achKgPct = tgtKg > 0 ? Math.round((r.totalKg / tgtKg) * 100) : 0;
      return `
      <tr>
        <td>${i === 0 && canViewAllReps && !effectiveRep ? '<span style="background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:bold">Top</span> ' : ''}${r.name}</td>
        <td style="text-align:center">${r.totalVisits}</td>
        <td style="text-align:center">${r.ordersPlaced}</td>
        <td style="text-align:center">${r.followUps}</td>
        <td style="text-align:right">${r.totalSales > 0 ? r.totalSales.toLocaleString() : '—'}</td>
        <td style="text-align:right">${r.totalKg > 0 ? r.totalKg.toLocaleString() + ' KG' : '—'}</td>
        <td style="text-align:center">${tgt > 0 ? achPct + '%' : '—'}</td>
        <td style="text-align:center">${tgtKg > 0 ? achKgPct + '%' : '—'}</td>
      </tr>`;
    }).join('');

    const productRows = report.productBreakdown.slice(0, 8).map((p) => `
      <tr>
        <td>${p.name}</td>
        <td style="text-align:center">${p.qty}</td>
        <td style="text-align:right">${p.sales.toLocaleString()}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report — ${periodLabel}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      h2 { font-size: 14px; margin: 20px 0 8px; color: #374151; }
      p.sub { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
      .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
      .kpi { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
      .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 4px; }
      .kpi-value { font-size: 18px; font-weight: bold; color: #111827; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
      th { background: #f3f4f6; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
      td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f9fafb; }
      tfoot td { font-weight: bold; background: #f3f4f6; border-top: 2px solid #d1d5db; }
      .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    </style></head><body>
    <h1>${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report — ${periodLabel}</h1>
    <p class="sub">Generated on ${dateStr} · GorillaSales${effectiveRep ? ' · ' + effectiveRep : ' · All Reps'}</p>
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Total Sales</div><div class="kpi-value">${report.totalSales.toLocaleString()} RWF</div></div>
      <div class="kpi"><div class="kpi-label">Total Weight</div><div class="kpi-value">${report.totalKg.toLocaleString()} KG</div></div>
      <div class="kpi"><div class="kpi-label">Orders Placed</div><div class="kpi-value">${report.ordersPlaced}</div></div>
      <div class="kpi"><div class="kpi-label">Conversion Rate</div><div class="kpi-value">${conversionRate}%</div></div>
    </div>
    <h2>Rep Performance Breakdown</h2>
    <table>
      <thead><tr>
        <th>Sales Rep</th><th style="text-align:center">Visits</th><th style="text-align:center">Orders</th>
        <th style="text-align:center">Follow-ups</th><th style="text-align:right">Total Sales (RWF)</th>
        <th style="text-align:right">Total (KG)</th>
        <th style="text-align:center">Achiev. (RWF)</th><th style="text-align:center">Achiev. (KG)</th>
      </tr></thead>
      <tbody>${repRows}</tbody>
      <tfoot><tr>
        <td>TOTAL</td>
        <td style="text-align:center">${report.totalVisits}</td>
        <td style="text-align:center">${report.ordersPlaced}</td>
        <td style="text-align:center">${report.followUps}</td>
        <td style="text-align:right">${report.totalSales.toLocaleString()}</td>
        <td style="text-align:right">${report.totalKg.toLocaleString()} KG</td>
        <td style="text-align:center">—</td>
        <td style="text-align:center">—</td>
      </tr></tfoot>
    </table>
    ${report.productBreakdown.length > 0 ? `
    <h2>Top Products</h2>
    <table>
      <thead><tr><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Sales (RWF)</th></tr></thead>
      <tbody>${productRows}</tbody>
    </table>` : ''}
    <div class="footer">GorillaSales · ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report · ${periodLabel}</div>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.onload = () => { win.print(); URL.revokeObjectURL(url); };
    }
    setExportSuccess('PDF print dialog opened.');
    setTimeout(() => setExportSuccess(''), 3000);
  }

  const conversionRate = report.totalVisits > 0
    ? Math.round((report.ordersPlaced / report.totalVisits) * 100)
    : 0;

  const rankMedals = ['🥇', '🥈', '🥉'];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canViewAllReps
              ? 'Generate and export performance reports for any period'
              : `Your personal performance reports — ${currentUser.name}`}
          </p>
        </div>
        {generated && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 border border-border bg-card text-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              <Download size={15} />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 border border-border bg-card text-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              <FileText size={15} />
              <span>PDF</span>
            </button>
          </div>
        )}
      </div>

      {exportSuccess && (
        <div className="flex items-center gap-2 bg-positive/10 border border-positive/30 text-positive text-sm px-4 py-3 rounded-lg">
          <CheckCircle size={16} />
          {exportSuccess}
        </div>
      )}

      {/* Report Type Tabs */}
      <div className="bg-card border border-border rounded-xl p-1.5 flex gap-1 overflow-x-auto">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              reportType === tab.key
                ? 'bg-accent text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Period selector */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Calendar size={16} className="text-accent" />
          {reportType === 'daily' && 'Select Date'}
          {reportType === 'weekly' && 'Select Week'}
          {reportType === 'monthly' && 'Select Month & Year'}
          {reportType === 'quarterly' && 'Select Quarter & Year'}
          {reportType === 'yearly' && 'Select Year'}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-end">

          {/* Daily: date picker */}
          {reportType === 'daily' && (
            <div className="flex-1">
              <label className="block text-sm font-semibold text-muted-foreground mb-2">Date</label>
              <input
                type="date"
                className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors cursor-pointer"
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setGenerated(false); }}
              />
            </div>
          )}

          {/* Weekly: week number + year */}
          {reportType === 'weekly' && (
            <>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-muted-foreground mb-2">Week</label>
                <div className="relative">
                  <select
                    className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-accent/40 pr-8 transition-colors cursor-pointer"
                    value={selectedWeek}
                    onChange={(e) => { setSelectedWeek(Number(e.target.value)); setGenerated(false); }}
                  >
                    {Array.from({ length: weeksInYear }, (_, i) => i + 1).map((w) => {
                      const { start, end } = getWeekRange(selectedWeekYear, w);
                      return (
                        <option key={w} value={w}>
                          Week {w} ({start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-muted-foreground mb-2">Year</label>
                <div className="relative">
                  <select
                    className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-accent/40 pr-8 transition-colors cursor-pointer"
                    value={selectedWeekYear}
                    onChange={(e) => { setSelectedWeekYear(Number(e.target.value)); setGenerated(false); }}
                  >
                    {YEARS.map((y) => <option key={y} value={Number(y)}>{y}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </>
          )}

          {/* Monthly: month + year */}
          {reportType === 'monthly' && (
            <>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-muted-foreground mb-2">Month</label>
                <div className="relative">
                  <select
                    className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-accent/40 pr-8 transition-colors cursor-pointer"
                    value={selectedMonth}
                    onChange={(e) => { setSelectedMonth(Number(e.target.value)); setGenerated(false); }}
                  >
                    {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-muted-foreground mb-2">Year</label>
                <div className="relative">
                  <select
                    className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-accent/40 pr-8 transition-colors cursor-pointer"
                    value={selectedYear}
                    onChange={(e) => { setSelectedYear(Number(e.target.value)); setGenerated(false); }}
                  >
                    {YEARS.map((y) => <option key={y} value={Number(y)}>{y}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </>
          )}

          {/* Quarterly: quarter + year */}
          {reportType === 'quarterly' && (
            <>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-muted-foreground mb-2">Quarter</label>
                <div className="relative">
                  <select
                    className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-accent/40 pr-8 transition-colors cursor-pointer"
                    value={selectedQuarter}
                    onChange={(e) => { setSelectedQuarter(Number(e.target.value)); setGenerated(false); }}
                  >
                    {QUARTERS.map((q, i) => <option key={i} value={i}>{q.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-muted-foreground mb-2">Year</label>
                <div className="relative">
                  <select
                    className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-accent/40 pr-8 transition-colors cursor-pointer"
                    value={selectedQuarterYear}
                    onChange={(e) => { setSelectedQuarterYear(Number(e.target.value)); setGenerated(false); }}
                  >
                    {YEARS.map((y) => <option key={y} value={Number(y)}>{y}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </>
          )}

          {/* Yearly: year only */}
          {reportType === 'yearly' && (
            <div className="flex-1">
              <label className="block text-sm font-semibold text-muted-foreground mb-2">Year</label>
              <div className="relative">
                <select
                  className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-accent/40 pr-8 transition-colors cursor-pointer"
                  value={selectedYearOnly}
                  onChange={(e) => { setSelectedYearOnly(Number(e.target.value)); setGenerated(false); }}
                >
                  {YEARS.map((y) => <option key={y} value={Number(y)}>{y}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          {/* Salesperson selector — only for managers/admins */}
          {canViewAllReps && (
            <div className="flex-1">
              <label className="block text-sm font-semibold text-muted-foreground mb-2">
                <span className="flex items-center gap-1"><User size={11} /> Salesperson</span>
              </label>
              <div className="relative">
                <select
                  className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-accent/40 pr-8 transition-colors cursor-pointer"
                  value={selectedRep}
                  onChange={(e) => { setSelectedRep(e.target.value); setGenerated(false); }}
                >
                  <option value="">All Reps</option>
                  {config.salespeople.map((sp) => <option key={sp.id} value={sp.label}>{sp.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          {/* Locked rep badge for Sales Officers */}
          {!canViewAllReps && (
            <div className="flex-1">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Salesperson</label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                  {currentUser.initials}
                </div>
                <span className="text-sm font-semibold text-primary">{currentUser.name}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors shadow-sm whitespace-nowrap disabled:opacity-60"
          >
            <FileText size={15} />
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>
        {loadError && <p className="mt-3 text-sm text-negative">{loadError}</p>}
      </div>

      {generated && (
        <>
          {/* Period label banner */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 border border-border rounded-lg px-4 py-2.5">
            <Calendar size={14} className="text-accent shrink-0" />
            <span>
              Showing <span className="font-semibold text-foreground">{reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report</span> for{' '}
              <span className="font-semibold text-foreground">{getPeriodLabel()}</span>
              {effectiveRep ? <> · <span className="font-semibold text-foreground">{effectiveRep}</span></> : ' · All Reps'}
            </span>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Sales', value: formatRWF(report.totalSales), icon: <DollarSign size={18} />, color: 'text-positive' },
              { label: 'Total Visits', value: report.totalVisits, icon: <Users size={18} />, color: 'text-accent' },
              { label: 'Orders Placed', value: report.ordersPlaced, icon: <ShoppingCart size={18} />, color: 'text-foreground' },
              { label: 'Conversion Rate', value: `${conversionRate}%`, icon: <TrendingUp size={18} />, color: 'text-positive' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                  <span className={`${kpi.color}`}>{kpi.icon}</span>
                </div>
                <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Ranked Rep Leaderboard (All-reps view only) */}
          {showLeaderboard && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-amber-500" />
                  <h2 className="font-semibold text-foreground text-sm">
                    Rep Leaderboard — {getPeriodLabel()}
                  </h2>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-amber-100 border-amber-300 text-amber-700"><Trophy size={10} /> Top Performer</span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-violet-100 border-violet-300 text-violet-700"><Award size={10} /> Most Improved</span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-sky-100 border-sky-300 text-sky-700"><Zap size={10} /> Fastest Closer</span>
                </div>
              </div>

              {report.repSummaries.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No sales data found for {getPeriodLabel()}.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-12">Rank</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sales Rep</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Sales (RWF)</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total (KG)</th>
                        {reportType === 'monthly' && (
                          <>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Achiev. (RWF)</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Achiev. (KG)</th>
                          </>
                        )}
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Orders</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {report.repSummaries.map((rep, idx) => {
                        const target = reportType === 'monthly' ? getRepTarget(targets, rep.name, selectedMonth, selectedYear) : 0;
                        const targetKg = reportType === 'monthly' ? getRepTargetWeight(targets, rep.name, selectedMonth, selectedYear) : 0;
                        const achievementPct = target > 0 ? Math.round((rep.totalSales / target) * 100) : 0;
                        const achievementKgPct = targetKg > 0 ? Math.round((rep.totalKg / targetKg) * 100) : 0;
                        const repBadges = badges[rep.name] ?? [];
                        const isTop = idx === 0;

                        let achievementColor = 'text-muted-foreground';
                        let achievementBg = 'bg-muted/50';
                        if (achievementPct >= 100) { achievementColor = 'text-positive'; achievementBg = 'bg-positive/10'; }
                        else if (achievementPct >= 75) { achievementColor = 'text-amber-600'; achievementBg = 'bg-amber-50'; }
                        else if (achievementPct >= 50) { achievementColor = 'text-orange-600'; achievementBg = 'bg-orange-50'; }

                        let kgColor = 'text-muted-foreground';
                        let kgBg = 'bg-muted/50';
                        if (achievementKgPct >= 100) { kgColor = 'text-positive'; kgBg = 'bg-positive/10'; }
                        else if (achievementKgPct >= 75) { kgColor = 'text-amber-600'; kgBg = 'bg-amber-50'; }
                        else if (achievementKgPct >= 50) { kgColor = 'text-orange-600'; kgBg = 'bg-orange-50'; }

                        return (
                          <tr key={rep.name} className={`hover:bg-muted/30 transition-colors ${isTop ? 'bg-amber-50/40' : ''}`}>
                            <td className="px-3 py-3 text-center">
                              {idx < 3 ? <span className="text-lg leading-none">{rankMedals[idx]}</span> : <span className="text-sm font-bold text-muted-foreground">{idx + 1}</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-foreground">{rep.name}</span>
                                {repBadges.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {repBadges.map((badge) => (
                                      <span key={badge.label} className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge.bg} ${badge.color}`}>
                                        {badge.icon}{badge.label}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-bold ${isTop ? 'text-positive' : 'text-foreground'}`}>
                                {rep.totalSales > 0 ? formatRWF(rep.totalSales) : <span className="text-muted-foreground font-normal">—</span>}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-semibold text-foreground">
                                {rep.totalKg > 0 ? `${rep.totalKg.toLocaleString()} KG` : <span className="text-muted-foreground font-normal">—</span>}
                              </span>
                            </td>
                            {reportType === 'monthly' && (
                              <>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${achievementBg} ${achievementColor}`}>{achievementPct}%</span>
                                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${achievementPct >= 100 ? 'bg-positive' : achievementPct >= 75 ? 'bg-amber-400' : achievementPct >= 50 ? 'bg-orange-400' : 'bg-muted-foreground/40'}`} style={{ width: `${Math.min(achievementPct, 100)}%` }} />
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${kgBg} ${kgColor}`}>{achievementKgPct}%</span>
                                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${achievementKgPct >= 100 ? 'bg-positive' : achievementKgPct >= 75 ? 'bg-amber-400' : achievementKgPct >= 50 ? 'bg-orange-400' : 'bg-muted-foreground/40'}`} style={{ width: `${Math.min(achievementKgPct, 100)}%` }} />
                                    </div>
                                  </div>
                                </td>
                              </>
                            )}
                            <td className="px-4 py-3 text-center"><span className="font-semibold text-foreground">{rep.ordersPlaced}</span></td>
                            <td className="px-4 py-3 text-center text-muted-foreground">{rep.totalVisits}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Payment split + Top Products */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Payment Breakdown</p>
              <div className="space-y-2">
                {[
                  { label: 'Paid', value: report.paidSales, color: 'bg-positive' },
                  { label: 'Credit', value: report.creditSales, color: 'bg-accent' },
                  { label: 'Pending', value: report.totalSales - report.paidSales - report.creditSales, color: 'bg-warning' },
                ].map((item) => {
                  const pct = report.totalSales > 0 ? Math.round((item.value / report.totalSales) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-semibold text-foreground">{formatRWF(item.value)} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Top Products</p>
              {report.productBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data for this period.</p>
              ) : (
                <div className="space-y-2">
                  {report.productBreakdown.slice(0, 5).map((p) => (
                    <div key={p.name} className="flex justify-between items-center text-sm">
                      <span className="text-foreground truncate max-w-[60%]">{p.name}</span>
                      <span className="font-semibold text-foreground shrink-0">{formatRWF(p.sales)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rep breakdown table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <BarChart2 size={16} className="text-accent" />
              <h2 className="font-semibold text-foreground text-sm">
                {canViewAllReps
                  ? `${effectiveRep ? effectiveRep + ' — ' : 'Rep Performance — '}${getPeriodLabel()}`
                  : `My Performance — ${getPeriodLabel()}`}
              </h2>
            </div>
            {report.filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No sales data found for {getPeriodLabel()}{effectiveRep ? ` · ${effectiveRep}` : ''}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sales Rep</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visits</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Orders</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Follow-ups</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Sales (RWF)</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total (KG)</th>
                      {reportType === 'monthly' && (
                        <>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Achiev. (RWF)</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Achiev. (KG)</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.repSummaries.map((rep, idx) => {
                      const tgt = reportType === 'monthly' ? getRepTarget(targets, rep.name, selectedMonth, selectedYear) : 0;
                      const tgtKg = reportType === 'monthly' ? getRepTargetWeight(targets, rep.name, selectedMonth, selectedYear) : 0;
                      const achPct = tgt > 0 ? Math.round((rep.totalSales / tgt) * 100) : 0;
                      const achKgPct = tgtKg > 0 ? Math.round((rep.totalKg / tgtKg) * 100) : 0;

                      let rwfColor = 'text-muted-foreground';
                      if (achPct >= 100) rwfColor = 'text-positive';
                      else if (achPct >= 75) rwfColor = 'text-amber-600';
                      else if (achPct > 0) rwfColor = 'text-orange-600';

                      let kgColor = 'text-muted-foreground';
                      if (achKgPct >= 100) kgColor = 'text-positive';
                      else if (achKgPct >= 75) kgColor = 'text-amber-600';
                      else if (achKgPct > 0) kgColor = 'text-orange-600';

                      return (
                        <tr key={rep.name} className={`hover:bg-muted/30 transition-colors ${idx === 0 && canViewAllReps && !effectiveRep ? 'bg-positive/5' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {idx === 0 && canViewAllReps && !effectiveRep && (
                                <span className="text-xs bg-positive/20 text-positive px-1.5 py-0.5 rounded font-semibold">Top</span>
                              )}
                              <span className="font-medium text-foreground">{rep.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{rep.totalVisits}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{rep.ordersPlaced}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{rep.followUps}</td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground">
                            {rep.totalSales > 0 ? formatRWF(rep.totalSales) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground">
                            {rep.totalKg > 0 ? `${rep.totalKg.toLocaleString()} KG` : <span className="text-muted-foreground">—</span>}
                          </td>
                          {reportType === 'monthly' && (
                            <>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-xs font-bold ${rwfColor}`}>{achPct}%</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-xs font-bold ${kgColor}`}>{achKgPct}%</span>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/60">
                      <td className="px-4 py-3 font-bold text-foreground">TOTAL</td>
                      <td className="px-4 py-3 text-center font-bold text-foreground">{report.totalVisits}</td>
                      <td className="px-4 py-3 text-center font-bold text-foreground">{report.ordersPlaced}</td>
                      <td className="px-4 py-3 text-center font-bold text-foreground">{report.followUps}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{formatRWF(report.totalSales)}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{report.totalKg.toLocaleString()} KG</td>
                      {reportType === 'monthly' && (
                        <>
                          <td className="px-4 py-3 text-center font-bold text-muted-foreground">—</td>
                          <td className="px-4 py-3 text-center font-bold text-muted-foreground">—</td>
                        </>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
