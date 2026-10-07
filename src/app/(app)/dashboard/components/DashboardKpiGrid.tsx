'use client';

import React from 'react';
import Link from 'next/link';
import { formatRWFFull } from '@/lib/format';
import { MONTH_LONG } from '@/lib/dates';
import { useUser } from '@/context/UserContext';
import type { DashboardData } from '@/lib/types';

// Server data is already scoped: sales officers only receive their own rows and deals.
function computeKpis(data: DashboardData) {
  const rows = data.repRows;
  const totalTarget = rows.reduce((s, t) => s + t.target, 0);
  const totalActual = rows.reduce((s, t) => s + t.actualSales, 0);
  const achievementPct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
  const newCustomers = rows.reduce((s, t) => s + t.newCustomers, 0);
  const totalVisits = rows.reduce((s, t) => s + t.customerVisits, 0);
  const totalOrders = rows.reduce((s, t) => s + t.orders, 0);
  const outstandingFollowUps = data.overdue.length;
  const pipelinePotential = data.openDeals.reduce((s, d) => s + d.potentialValue, 0);
  const weightedPipeline = data.openDeals.reduce((s, d) => s + d.weightedValue, 0);
  const topRep = [...rows].sort((a, b) => b.actualSales - a.actualSales)[0];
  return { totalTarget, totalActual, achievementPct, newCustomers, totalVisits, totalOrders, outstandingFollowUps, pipelinePotential, weightedPipeline, topRep };
}

/** The month's key figures as a plain label/value table. */
export default function DashboardKpiGrid({ data }: { data: DashboardData }) {
  const { canViewAllReps } = useUser();
  const k = computeKpis(data);
  const alert = 'text-negative font-bold';

  const cells: [React.ReactNode, React.ReactNode, boolean?][] = [
    ['Net sales', <>{formatRWFFull(Math.round(k.totalActual))}</>],
    ['Target', <>{formatRWFFull(k.totalTarget)}</>],
    ['Achievement', <>{k.achievementPct.toFixed(1)}%</>, k.totalTarget > 0 && k.achievementPct < 60],
    ['Visits', <>{k.totalVisits}</>],
    ['Orders', <>{k.totalOrders} ({k.totalVisits ? Math.round((k.totalOrders / k.totalVisits) * 100) : 0}% of visits)</>],
    ['New customers', <>{k.newCustomers}</>],
    [<Link key="f" href="/customer-management">Overdue follow-ups</Link>, <>{k.outstandingFollowUps}</>, k.outstandingFollowUps > 0],
    ['Weighted pipeline', <>{formatRWFFull(Math.round(k.weightedPipeline))} of {formatRWFFull(Math.round(k.pipelinePotential))}</>],
    [<Link key="r" href="/receivables">Outstanding receivables</Link>, <>{formatRWFFull(Math.round(data.receivables.total))}</>],
    [<Link key="o" href="/receivables">Overdue receivables</Link>, <>{formatRWFFull(Math.round(data.receivables.overdue))}</>, data.receivables.overdue > 0],
    [<Link key="h" href="/orders">Orders on credit hold</Link>, <>{data.ordersOnHold}</>, data.ordersOnHold > 0],
    [<Link key="d" href="/orders">Orders to deliver</Link>, <>{data.ordersToDeliver}</>],
  ];
  if (canViewAllReps && k.topRep) {
    cells.push(['Top seller', <>{k.topRep.salesperson} ({formatRWFFull(Math.round(k.topRep.actualSales))})</>]);
  }

  // Lay the pairs out four to a row: label | value | label | value ...
  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));

  return (
    <table className="w-full text-sm">
      <caption className="text-left font-bold pb-1">
        {MONTH_LONG[data.month]} {data.year} at a glance
      </caption>
      <tbody>
        {rows.map((pair, i) => (
          <tr key={i}>
            {pair.map(([label, value, isAlert], j) => (
              <React.Fragment key={j}>
                <th scope="row" className="text-left font-normal bg-muted w-1/5 px-2 py-1">
                  {label}
                </th>
                <td className={`px-2 py-1 font-tabular ${isAlert ? alert : ''}`}>{value}</td>
              </React.Fragment>
            ))}
            {pair.length === 1 && <td colSpan={2} />}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
