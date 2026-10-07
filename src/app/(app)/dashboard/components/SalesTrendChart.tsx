'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,  } from 'recharts';
import type { TrendPoint } from '@/lib/types';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-4 py-3 min-w-[180px]">
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
        {label}
      </p>
      {payload.map((entry) => (
        <div key={`tt-${entry.name}`} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-muted-foreground capitalize">
              {entry.name}
            </span>
          </div>
          <span className="text-xs font-semibold text-foreground font-tabular">
            RWF {(entry.value / 1000000).toFixed(2)}M
          </span>
        </div>
      ))}
      {payload.length === 2 && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Achievement</span>
            <span
              className={`text-[11px] font-bold ${
                (payload[1]?.value / payload[0]?.value) * 100 >= 80
                  ? 'text-positive' :'text-negative'
              }`}
            >
              {payload[0]?.value
                ? `${((payload[1].value / payload[0].value) * 100).toFixed(1)}%`
                : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradTarget" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--border)" stopOpacity={0.6} />
            <stop offset="95%" stopColor="var(--border)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)', paddingTop: 8 }}
        />
        <Area
          type="monotone"
          dataKey="target"
          name="Target"
          stroke="var(--border)"
          strokeWidth={2}
          strokeDasharray="5 3"
          fill="url(#gradTarget)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="actual"
          name="Actual"
          stroke="var(--accent)"
          strokeWidth={2.5}
          fill="url(#gradActual)"
          dot={{ fill: 'var(--accent)', strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, fill: 'var(--accent)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}