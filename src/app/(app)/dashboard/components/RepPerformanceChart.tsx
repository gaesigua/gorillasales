'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { RepPerformanceRow } from '@/lib/types';

interface ChartPoint {
  name: string;
  achievement: number;
  sales: number;
  target: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartPoint }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-foreground px-2 py-1">
      <p className="text-xs font-semibold text-muted-foreground mb-2">{label}</p>
      <div className="flex items-center justify-between gap-6 mb-1">
        <span className="text-xs text-muted-foreground">Actual</span>
        <span className="text-xs font-semibold font-tabular">
          RWF {(d.sales / 1000000).toFixed(2)}M
        </span>
      </div>
      <div className="flex items-center justify-between gap-6 mb-1">
        <span className="text-xs text-muted-foreground">Target</span>
        <span className="text-xs font-semibold font-tabular">
          RWF {(d.target / 1000000).toFixed(1)}M
        </span>
      </div>
      <div className="flex items-center justify-between gap-6 pt-1 border-t border-border mt-1">
        <span className="text-xs text-muted-foreground">Achievement</span>
        <span
          className={`text-xs font-bold ${
            d.achievement >= 80 ? 'text-positive' : d.achievement >= 60 ? 'text-warning' : 'text-negative'
          }`}
        >
          {d.achievement}%
        </span>
      </div>
    </div>
  );
}

export default function RepPerformanceChart({ rows }: { rows: RepPerformanceRow[] }) {
  const chartData: ChartPoint[] = rows.map((t) => ({
    name: t.salesperson.split(' ')[0],
    achievement: parseFloat(t.achievementPct.toFixed(1)),
    sales: t.actualSales,
    target: t.target,
  }));

  return (
    <>
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barSize={28}>
        <CartesianGrid stroke="#e4e4e4" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          domain={[0, 110]}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)' }} isAnimationActive={false} />
        <ReferenceLine
          y={80}
          stroke="var(--positive)"
          strokeDasharray="4 3"
          strokeWidth={1.5}
          label={{ value: '80% target', position: 'insideTopRight', fill: 'var(--foreground)', fontSize: 10 }}
        />
        <Bar dataKey="achievement" isAnimationActive={false}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-rep-${index}`}
              fill={
                entry.achievement >= 80
                  ? 'var(--positive)'
                  : entry.achievement >= 60
                  ? 'var(--warning)'
                  : 'var(--negative)'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    <p className="flex flex-wrap gap-4 text-xs mt-1">
      {[
        ['var(--positive)', 'On track (80%+)'],
        ['var(--warning)', 'At risk (60–79%)'],
        ['var(--negative)', 'Behind (under 60%)'],
      ].map(([color, label]) => (
        <span key={label} className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: color }} />
          {label}
        </span>
      ))}
    </p>
    </>
  );
}