'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast, Toaster } from 'sonner';
import { LayoutGrid, List, TrendingUp, ChevronDown, GripVertical, Calendar, User, MapPin, ArrowRight, Filter, Download, FileText } from 'lucide-react';
import { formatRWF } from '@/lib/format';
import { useConfig } from '@/context/ConfigContext';
import type { PipelineDeal, PipelineStage, RepPerformanceRow } from '@/lib/types';
import { useUser } from '@/context/UserContext';
import SalesForecastingPanel from './SalesForecastingPanel';
import { updateDealStage } from '@/actions/deals';

type StageColors = { bg: string; text: string; border: string; dot: string };

const OPEN_STAGE_COLORS: StageColors[] = [
  { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' },
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
];
const WON_COLORS: StageColors = { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' };
const LOST_COLORS: StageColors = { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-400' };

function stageColors(stages: PipelineStage[], name: string): StageColors {
  const stage = stages.find((s) => s.name === name);
  if (!stage) return OPEN_STAGE_COLORS[0];
  if (stage.probability >= 100) return WON_COLORS;
  if (stage.probability <= 0) return LOST_COLORS;
  return OPEN_STAGE_COLORS[stages.indexOf(stage) % OPEN_STAGE_COLORS.length];
}

type ViewMode = 'kanban' | 'table';

interface SalesPipelineClientProps {
  deals: PipelineDeal[];
  repRows: RepPerformanceRow[];
  today: string;
}

export default function SalesPipelineClient({ deals: initialDeals, repRows, today }: SalesPipelineClientProps) {
  const { currentUser, canViewAllReps } = useUser();
  const { config } = useConfig();
  const stages = config.pipelineStages;
  const stageNames = stages.map((s) => s.name);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [deals, setDeals] = useState<PipelineDeal[]>(initialDeals);
  // Sales officers only receive their own deals from the server; managers can filter by rep id
  const [repFilter, setRepFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState('');
  const dragSourceStage = useRef<string | null>(null);

  const repName = canViewAllReps ? config.salespeople.find((s) => s.id === repFilter)?.label ?? '' : currentUser.name;

  // Re-sync after the server re-renders with fresh data
  useEffect(() => setDeals(initialDeals), [initialDeals]);

  const filteredDeals = deals.filter((d) => {
    const matchRep = !repFilter || d.salespersonId === repFilter;
    const matchStage = !stageFilter || d.stage === stageFilter;
    return matchRep && matchStage;
  });

  // KPI aggregates
  const totalPipeline = filteredDeals.reduce((s, d) => s + d.potentialValue, 0);
  const totalWeighted = filteredDeals.reduce((s, d) => s + d.weightedValue, 0);
  const wonDeals = filteredDeals.filter((d) => d.probability >= 100);
  const wonValue = wonDeals.reduce((s, d) => s + d.potentialValue, 0);
  const activeDeals = filteredDeals.filter((d) => d.probability > 0 && d.probability < 100);

  // Drag handlers
  function handleDragStart(e: React.DragEvent, dealId: string, stage: string) {
    setDraggedId(dealId);
    dragSourceStage.current = stage;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, stage: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  }

  async function handleDrop(e: React.DragEvent, targetStage: string) {
    e.preventDefault();
    const dealId = draggedId;
    setDraggedId(null);
    setDragOverStage(null);
    dragSourceStage.current = null;

    const stage = stages.find((s) => s.name === targetStage);
    const previous = deals.find((d) => d.id === dealId);
    if (!dealId || !stage || !previous || previous.stageId === stage.id) return;

    // Optimistic move, rolled back if the server rejects it
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? {
              ...d,
              stage: stage.name,
              stageId: stage.id,
              probability: stage.probability,
              weightedValue: Math.round((d.potentialValue * stage.probability) / 100),
            }
          : d
      )
    );
    const res = await updateDealStage(dealId, stage.id);
    if (res.success && res.data) {
      setDeals((prev) => prev.map((d) => (d.id === dealId ? res.data! : d)));
    } else {
      setDeals((prev) => prev.map((d) => (d.id === dealId ? previous : d)));
      toast.error('Could not move deal', { description: res.success ? undefined : res.error });
    }
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverStage(null);
    dragSourceStage.current = null;
  }

  const dealsByStage = (stage: string) =>
    filteredDeals.filter((d) => d.stage === stage);

  const stageTotal = (stage: string) =>
    dealsByStage(stage).reduce((s, d) => s + d.potentialValue, 0);

  function handleDownloadCSV() {
    const rows = [
      ['Customer', 'Area', 'Sales Rep', 'Stage', 'Potential Value (RWF)', 'Probability %', 'Weighted Value (RWF)', 'Follow-up Date', 'Next Action'],
      ...filteredDeals.map((d) => [
        d.customer, d.area, d.salesperson, d.stage, d.potentialValue, d.probability, d.weightedValue, d.followUpDate, `"${d.nextAction || ''}"`,
      ]),
      [],
      ['TOTALS', '', '', '', totalPipeline, '', totalWeighted, '', ''],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sales_Pipeline_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg('CSV downloaded successfully.');
    setTimeout(() => setExportMsg(''), 3000);
  }

  function handleDownloadPDF() {
    const dateStr = new Date().toLocaleDateString();
    const rows = filteredDeals.map((d) => `
      <tr>
        <td>${d.customer}</td>
        <td>${d.salesperson}</td>
        <td><span style="padding:2px 8px;border-radius:12px;font-size:11px;background:#f3f4f6">${d.stage}</span></td>
        <td style="text-align:right">${d.potentialValue.toLocaleString()}</td>
        <td style="text-align:center">${d.probability}%</td>
        <td style="text-align:right">${d.weightedValue.toLocaleString()}</td>
        <td>${d.followUpDate}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sales Pipeline — ${dateStr}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      p { color: #666; font-size: 13px; margin-bottom: 16px; }
      .kpis { display: flex; gap: 16px; margin-bottom: 20px; }
      .kpi { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; flex: 1; }
      .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 4px; }
      .kpi-value { font-size: 18px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #f3f4f6; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
      td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f9fafb; }
      .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; }
    </style></head><body>
    <h1>Sales Pipeline Snapshot</h1>
    <p>Generated on ${dateStr} · GorillaSales${repName ? ' · ' + repName : ''}</p>
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Pipeline Value</div><div class="kpi-value">${totalPipeline.toLocaleString()} RWF</div></div>
      <div class="kpi"><div class="kpi-label">Weighted Value</div><div class="kpi-value">${totalWeighted.toLocaleString()} RWF</div></div>
      <div class="kpi"><div class="kpi-label">Won This Month</div><div class="kpi-value">${wonValue.toLocaleString()} RWF</div></div>
      <div class="kpi"><div class="kpi-label">Active Deals</div><div class="kpi-value">${activeDeals.length}</div></div>
    </div>
    <table>
      <thead><tr>
        <th>Customer</th><th>Rep</th><th>Stage</th>
        <th style="text-align:right">Potential (RWF)</th><th style="text-align:center">Prob %</th>
        <th style="text-align:right">Weighted (RWF)</th><th>Follow-up</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">GorillaSales · Sales Pipeline Report · ${dateStr}</div>
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
      <Toaster position="bottom-right" richColors />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canViewAllReps
              ? 'Track all deals across pipeline stages — drag to advance'
              : `Your active deals — ${currentUser.name}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid size={15} />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List size={15} />
              <span className="hidden sm:inline">Table</span>
            </button>
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
          <FileText size={15} />
          {exportMsg}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Pipeline Value</p>
          <p className="text-xl font-bold text-foreground font-tabular">{formatRWF(totalPipeline)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{filteredDeals.length} deals total</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Weighted Value</p>
          <p className="text-xl font-bold text-accent font-tabular">{formatRWF(totalWeighted)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Probability-adjusted</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Won This Month</p>
          <p className="text-xl font-bold text-green-600 font-tabular">{formatRWF(wonValue)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{wonDeals.length} deals closed</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Active Deals</p>
          <p className="text-xl font-bold text-foreground font-tabular">{activeDeals.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">In progress</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter size={14} className="text-muted-foreground" />
        {canViewAllReps && (
          <div className="relative">
            <select
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="">All Reps</option>
              {config.salespeople.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        )}
        <div className="relative">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="">All Stages</option>
            {stageNames.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        {(repFilter || stageFilter) && (
          <button
            onClick={() => { setRepFilter(''); setStageFilter(''); }}
            className="text-xs text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* KANBAN VIEW */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {stageNames.map((stage) => {
              const stageDeals = dealsByStage(stage);
              const colors = stageColors(stages, stage);
              const isOver = dragOverStage === stage;

              return (
                <div
                  key={stage}
                  className={`flex flex-col w-64 rounded-xl border transition-colors ${
                    isOver ? 'border-accent bg-accent/5' : 'border-border bg-muted/40'
                  }`}
                  onDragOver={(e) => handleDragOver(e, stage)}
                  onDrop={(e) => handleDrop(e, stage)}
                  onDragLeave={() => setDragOverStage(null)}
                >
                  {/* Column header */}
                  <div className="px-3 py-3 border-b border-border">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                        <span className="text-sm font-semibold text-foreground">{stage}</span>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {stageDeals.length}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-tabular">{formatRWF(stageTotal(stage))}</p>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 p-2 min-h-[120px]">
                    {stageDeals.map((deal) => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal.id, stage)}
                        onDragEnd={handleDragEnd}
                        className={`bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all select-none ${
                          draggedId === deal.id ? 'opacity-40 scale-95' : ''
                        }`}
                      >
                        {/* Card top */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold text-foreground leading-tight">{deal.customer}</p>
                          <GripVertical size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                        </div>

                        {/* Value + probability */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-foreground font-tabular">
                            {formatRWF(deal.potentialValue)}
                          </span>
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                            {deal.probability}%
                          </span>
                        </div>

                        {/* Weighted */}
                        <div className="flex items-center gap-1 mb-2">
                          <TrendingUp size={11} className="text-accent" />
                          <span className="text-xs text-muted-foreground">
                            Weighted: <span className="font-semibold text-accent font-tabular">{formatRWF(deal.weightedValue)}</span>
                          </span>
                        </div>

                        {/* Probability bar */}
                        <div className="w-full bg-muted rounded-full h-1 mb-2">
                          <div
                            className="h-1 rounded-full bg-accent health-bar-fill"
                            style={{ width: `${deal.probability}%` }}
                          />
                        </div>

                        {/* Meta */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <User size={11} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">{deal.salesperson}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar size={11} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Follow-up: {deal.followUpDate}</span>
                          </div>
                        </div>

                        {/* Next action */}
                        {deal.nextAction && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                              <ArrowRight size={10} className="shrink-0 mt-0.5 text-accent" />
                              {deal.nextAction}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}

                    {stageDeals.length === 0 && (
                      <div className="flex-1 flex items-center justify-center py-6">
                        <p className="text-xs text-muted-foreground/60 text-center">
                          Drop deals here
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stage</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Potential</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prob %</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Weighted</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Follow-up</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Next Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                      No deals match the current filters.
                    </td>
                  </tr>
                )}
                {filteredDeals.map((deal, idx) => {
                  const colors = stageColors(stages, deal.stage);
                  return (
                    <tr
                      key={deal.id}
                      className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                        idx % 2 === 0 ? '' : 'bg-muted/10'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{deal.customer}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin size={10} />
                          {deal.area}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">
                            {deal.salesperson.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <span className="text-foreground text-xs">{deal.salesperson}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                          {deal.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-tabular font-semibold text-foreground">
                        {formatRWF(deal.potentialValue)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-muted rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-accent"
                              style={{ width: `${deal.probability}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-foreground font-tabular w-8 text-right">
                            {deal.probability}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-tabular font-bold text-accent">
                        {formatRWF(deal.weightedValue)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{deal.followUpDate}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate">
                        {deal.nextAction}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredDeals.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td colSpan={3} className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      Totals ({filteredDeals.length} deals)
                    </td>
                    <td className="px-4 py-3 text-right font-tabular font-bold text-foreground">
                      {formatRWF(totalPipeline)}
                    </td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right font-tabular font-bold text-accent">
                      {formatRWF(totalWeighted)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* FORECASTING SECTION */}
      <div className="border-t border-border pt-6">
        <SalesForecastingPanel deals={deals} repRows={repRows} today={today} />
      </div>
    </div>
  );
}
