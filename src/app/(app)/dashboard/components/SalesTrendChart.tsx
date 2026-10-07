'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TrendPoint } from '@/lib/types';

// Validated categorical pair (light surface): actual = blue, target = ochre
const ACTUAL = '#2f6fb7';
const TARGET = '#b36a2e';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const target = payload.find((p) => p.dataKey === 'target')?.value ?? 0;
  const actual = payload.find((p) => p.dataKey === 'actual')?.value ?? 0;
  return (
    <div className="bg-card border border-foreground px-2 py-1 text-xs min-w-[170px]">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={`tt-${entry.name}`} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="font-tabular">RWF {(entry.value / 1000000).toFixed(2)}M</span>
        </div>
      ))}
      {target > 0 && (
        <div className="flex justify-between border-t border-border mt-1 pt-1">
          <span>Achievement</span>
          <span className="font-bold">{((actual / target) * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

export default function SalesTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e4e4e4" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)' }} isAnimationActive={false} />
        <Legend
          iconType="plainline"
          iconSize={14}
          wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
          formatter={(value) => <span className="text-foreground">{value}</span>}
        />
        <Line
          type="linear"
          dataKey="target"
          name="Target"
          stroke={TARGET}
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="actual"
          name="Actual"
          stroke={ACTUAL}
          strokeWidth={2}
          dot={{ fill: ACTUAL, stroke: '#fff', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 5, fill: ACTUAL, stroke: '#fff', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
