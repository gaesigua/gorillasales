'use client';

import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { TrendingUp, ChevronDown, Info } from 'lucide-react';
import { formatRWF } from '@/lib/format';
import { MONTH_SHORT } from '@/lib/dates';
import { useUser } from '@/context/UserContext';
import { useConfig } from '@/context/ConfigContext';
import type { PipelineDeal, RepPerformanceRow } from '@/lib/types';

// Forecast categories, in the standard sales-forecasting sense:
//   Commit    = open deals at >= 80% probability (expected to close)
//   Weighted  = sum of deal value × stage probability
//   Best case = full value of every open deal
const COMMIT_THRESHOLD = 80;
const FALLBACK_COLORS = ['#94a3b8', '#60a5fa', '#a78bfa', '#fbbf24', '#f97316', '#22c55e'];

interface ForecastPoint {
  period: string;
  commit: number;
  weighted: number;
  bestCase: number;
}

interface SalesForecastingPanelProps {
  deals: PipelineDeal[];
  repRows: RepPerformanceRow[];
  today: string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </span>
          <span className="font-semibold text-foreground font-tabular">{formatRWF(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

/** Next 6 months starting with the current one, keyed YYYY-MM. */
function forecastMonths(today: string): { key: string; label: string }[] {
  const [y, m] = today.split('-').map(Number);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    return {
      key: d.toISOString().slice(0, 7),
      label: `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    };
  });
}

export default function SalesForecastingPanel({ deals, repRows, today }: SalesForecastingPanelProps) {
  const { canViewAllReps } = useUser();
  const { config } = useConfig();
  const [repFilter, setRepFilter] = useState<string>('');

  const openDeals = useMemo(
    () =>
      deals.filter(
        (d) => d.probability > 0 && d.probability < 100 && (!repFilter || d.salespersonId === repFilter)
      ),
    [deals, repFilter]
  );

  // Bucket deals by expected close month (their follow-up date); overdue dates count as this month
  const { chartData, unscheduled } = useMemo(() => {
    const months = forecastMonths(today);
    const points: ForecastPoint[] = months.map((m) => ({ period: m.label, commit: 0, weighted: 0, bestCase: 0 }));
    let unscheduledValue = 0;
    for (const d of openDeals) {
      const key = d.followUpDate ? (d.followUpDate < today ? today : d.followUpDate).slice(0, 7) : '';
      const idx = months.findIndex((m) => m.key === key);
      if (idx === -1) {
        unscheduledValue += d.weightedValue;
        continue;
      }
      points[idx].bestCase += d.potentialValue;
      points[idx].weighted += d.weightedValue;
      if (d.probability >= COMMIT_THRESHOLD) points[idx].commit += d.potentialValue;
    }
    return { chartData: points, unscheduled: unscheduledValue };
  }, [openDeals, today]);

  const totals = {
    commit: openDeals.filter((d) => d.probability >= COMMIT_THRESHOLD).reduce((s, d) => s + d.potentialValue, 0),
    weighted: openDeals.reduce((s, d) => s + d.weightedValue, 0),
    bestCase: openDeals.reduce((s, d) => s + d.potentialValue, 0),
  };

  const stageBreakdown = config.pipelineStages
    .filter((s) => s.probability > 0 && s.probability < 100)
    .map((stage, i) => {
      const stageDeals = openDeals.filter((d) => d.stageId === stage.id);
      const pipelineValue = stageDeals.reduce((s, d) => s + d.potentialValue, 0);
      return {
        stage: stage.name,
        color: stage.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
        probability: stage.probability,
        pipelineValue,
        expectedRevenue: Math.round((pipelineValue * stage.probability) / 100),
        dealCount: stageDeals.length,
      };
    });

  const repForecasts = repRows
    .filter((r) => !repFilter || r.salespersonId === repFilter)
    .map((r) => {
      const repDeals = openDeals.filter((d) => d.salespersonId === r.salespersonId);
      return {
        id: r.salespersonId,
        rep: r.salesperson,
        pipelineValue: repDeals.reduce((s, d) => s + d.potentialValue, 0),
        weightedForecast: repDeals.reduce((s, d) => s + d.weightedValue, 0),
        achievementPct: r.achievementPct,
        hasTarget: r.target > 0,
      };
    })
    .sort((a, b) => b.weightedForecast - a.weightedForecast);

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-accent" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Sales Forecast</h2>
            <p className="text-xs text-muted-foreground">
              Open deals by expected close month (follow-up date), weighted by stage probability
            </p>
          </div>
        </div>
        {canViewAllReps && (
          <div className="relative">
            <select
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-xs bg-card text-foreground appearance-none pr-7 focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="">All Reps</option>
              {config.salespeople.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        )}
      </div>

      {/* Summary KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Commit</p>
          <p className="text-xl font-bold text-foreground font-tabular">{formatRWF(totals.commit)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Deals at ≥{COMMIT_THRESHOLD}% probability</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Weighted</p>
          <p className="text-xl font-bold text-accent font-tabular">{formatRWF(totals.weighted)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Value × stage probability</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Best Case</p>
          <p className="text-xl font-bold text-foreground font-tabular">{formatRWF(totals.bestCase)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">All open deals close</p>
        </div>
      </div>

      {/* Forecast chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Revenue Projection — next 6 months</h3>
            {unscheduled > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatRWF(unscheduled)} weighted value has no follow-up date and is not shown
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
            <Info size={11} />
            <span>Based on {openDeals.length} open deals</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatRWF(v)}
              width={72}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
            <Bar dataKey="commit" name="Commit" fill="#57534e" />
            <Bar dataKey="weighted" name="Weighted" fill="var(--accent)" />
            <Bar dataKey="bestCase" name="Best case" fill="#d6d3d1" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Stage breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Expected Revenue by Stage</h3>
          <p className="text-xs text-muted-foreground mb-4">Pipeline value × stage probability</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stageBreakdown} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="stage" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatRWF(v)}
                width={68}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="expectedRevenue" name="Expected">
                {stageBreakdown.map((entry) => (
                  <Cell key={entry.stage} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {stageBreakdown.map((s) => (
              <div key={s.stage} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-muted-foreground">{s.stage}</span>
                  <span className="text-muted-foreground/60">({s.dealCount} deals)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{s.probability}% probability</span>
                  <span className="font-semibold text-foreground font-tabular">{formatRWF(s.expectedRevenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rep forecasts */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Rep Pipeline & Target Achievement</h3>
          <p className="text-xs text-muted-foreground mb-4">Weighted open pipeline, with this month's target achievement</p>
          {repForecasts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sales officers yet.</p>
          ) : (
            <div className="space-y-3">
              {repForecasts.map((rep) => {
                const barColor =
                  rep.achievementPct >= 85
                    ? 'bg-green-500'
                    : rep.achievementPct >= 70
                      ? 'bg-accent'
                      : rep.achievementPct >= 55
                        ? 'bg-amber-500'
                        : 'bg-red-400';
                return (
                  <div key={rep.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">
                          {rep.rep.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <span className="text-xs font-semibold text-foreground">{rep.rep}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-tabular">
                        {formatRWF(rep.weightedForecast)} weighted
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${barColor}`}
                          style={{ width: `${Math.min(100, rep.achievementPct)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-tabular w-16 text-right">
                        {rep.hasTarget ? `${rep.achievementPct}%` : 'no target'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
