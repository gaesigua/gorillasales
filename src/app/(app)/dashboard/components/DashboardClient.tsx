'use client';

import React from 'react';
import Link from 'next/link';
import DashboardKpiGrid from '@/app/(app)/dashboard/components/DashboardKpiGrid';
import RepTargetsTable from '@/app/(app)/dashboard/components/RepTargetsTable';
import OverdueFollowUpsFeed from '@/app/(app)/dashboard/components/OverdueFollowUpsFeed';
import { useUser } from '@/context/UserContext';
import { formatRWF } from '@/lib/format';
import { monthLabel, MONTH_SHORT } from '@/lib/dates';
import type { DashboardData } from '@/lib/types';
import dynamic from 'next/dynamic';

const SalesTrendChart = dynamic(() => import('@/app/(app)/dashboard/components/SalesTrendChart'), {
  ssr: false,
  loading: () => (
    <div className="skeleton-pulse rounded-lg h-[260px] w-full" />
  ),
});

const RepPerformanceChart = dynamic(() => import('@/app/(app)/dashboard/components/RepPerformanceChart'), {
  ssr: false,
  loading: () => (
    <div className="skeleton-pulse rounded-lg h-[220px] w-full" />
  ),
});

export default function DashboardClient({ data }: { data: DashboardData }) {
  const { currentUser, canViewAllReps } = useUser();

  // Server already scopes deals to the signed-in rep for sales officers
  const visibleDeals = data.openDeals;
  const period = monthLabel(data.year, data.month);
  const trendRange = data.trend.length ? `${data.trend[0].month} – ${data.trend[data.trend.length - 1].month}` : '';

  return (
    <>
      <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Sales Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {canViewAllReps ? `${period} · All Reps` : `${period} · ${currentUser.name}`}
            </p>
          </div>
        </div>

        {/* KPI Bento Grid */}
        <DashboardKpiGrid data={data} />


        {/* Charts + Overdue Feed row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 2xl:grid-cols-3 gap-4">
          {/* Sales Trend Chart */}
          <div className="xl:col-span-2 bg-card border border-border p-3">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Monthly Sales vs Target
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {trendRange}
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                RWF millions
              </span>
            </div>
            <SalesTrendChart data={data.trend} />
          </div>

          {/* Overdue Follow-ups Feed */}
          <div className="xl:col-span-1">
            <OverdueFollowUpsFeed items={data.overdue} today={data.today} />
          </div>
        </div>

        {/* Rep performance row — only for managers/admins */}
        {canViewAllReps && (
          <div className="grid grid-cols-1 xl:grid-cols-3 2xl:grid-cols-3 gap-4">
            <div className="xl:col-span-1 bg-card border border-border p-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Achievement by Rep
                </h3>
                <span className="text-[11px] text-muted-foreground">{MONTH_SHORT[data.month]} {data.year}</span>
              </div>
              <RepPerformanceChart rows={data.repRows} />
            </div>

            <div className="xl:col-span-2">
              <RepTargetsTable rows={data.repRows} period={period} />
            </div>
          </div>
        )}

        {/* Personal performance card — only for Sales Officers */}
        {!canViewAllReps && (() => {
          const myTarget = data.repRows.find((r) => r.salespersonId === currentUser.id);
          if (!myTarget) return null;
          const achievementColor =
            myTarget?.achievementPct >= 80
              ? 'text-positive'
              : myTarget?.achievementPct >= 60
              ? 'text-warning' :'text-negative';
          const barColor =
            myTarget?.achievementPct >= 80
              ? 'bg-positive'
              : myTarget?.achievementPct >= 60
              ? 'bg-accent' :'bg-negative';
          return (
            <div className="bg-card border border-border p-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">My Performance — {period}</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-muted/40 rounded-lg p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Target</p>
                  <p className="text-xl font-bold text-foreground font-tabular">{formatRWF(myTarget?.target)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Actual Sales</p>
                  <p className="text-xl font-bold text-foreground font-tabular">{formatRWF(myTarget?.actualSales)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Visits</p>
                  <p className="text-xl font-bold text-foreground font-tabular">{myTarget?.customerVisits}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Orders</p>
                  <p className="text-xl font-bold text-foreground font-tabular">{myTarget?.orders}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Achievement</span>
                  <span className={`text-sm font-bold font-tabular ${achievementColor}`}>
                    {myTarget?.achievementPct?.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full health-bar-fill ${barColor}`}
                    style={{ width: `${Math.min(myTarget?.achievementPct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        {/* Pipeline summary */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {canViewAllReps ? 'Active Pipeline Deals' : 'My Pipeline Deals'}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {visibleDeals?.length} open deal{visibleDeals?.length !== 1 ? 's' : ''}
            </span>
          </div>
          {visibleDeals?.length === 0 ? (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">
              No active pipeline deals assigned to you.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</th>
                    {canViewAllReps && (
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Salesperson</th>
                    )}
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stage</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Potential</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Probability</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Weighted</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Follow-up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleDeals?.map((deal) => {
                    const stageVariant =
                      deal.probability >= 80 ? 'success'
                        : deal.probability >= 40 ? 'accent'
                        : deal.probability >= 20 ? 'info' : 'neutral';
                    return (
                      <tr key={`pipeline-${deal?.id}`} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{deal?.customer}</td>
                        {canViewAllReps && (
                          <td className="px-4 py-3 text-muted-foreground">{deal?.salesperson?.split(' ')?.[0]}</td>
                        )}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                              stageVariant === 'success' ? 'bg-positive/10 text-positive border-positive/20'
                                : stageVariant === 'accent' ? 'bg-accent/10 text-accent border-accent/20'
                                : stageVariant === 'info' ? 'bg-info/10 text-info border-info/20' : 'bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            {deal?.stage}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-tabular text-foreground">
                          {deal?.potentialValue >= 1000000
                            ? `RWF ${(deal?.potentialValue / 1000000)?.toFixed(1)}M`
                            : `RWF ${(deal?.potentialValue / 1000)?.toFixed(0)}K`}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-semibold text-foreground font-tabular">{deal?.probability}%</span>
                            <div className="w-16 bg-muted rounded-full h-1">
                              <div
                                className="h-1 rounded-full bg-primary health-bar-fill"
                                style={{ width: `${deal?.probability}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-foreground font-tabular">
                          {deal?.weightedValue >= 1000000
                            ? `RWF ${(deal?.weightedValue / 1000000)?.toFixed(2)}M`
                            : `RWF ${(deal?.weightedValue / 1000)?.toFixed(0)}K`}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{deal?.followUpDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
