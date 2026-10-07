// Invoice status and aging. Dates are YYYY-MM-DD calendar strings.

export type InvoiceStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'VOID';
export type AgingBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';

export const AGING_LABELS: Record<AgingBucket, string> = {
  current: 'Not yet due',
  d1_30: '1–30 days',
  d31_60: '31–60 days',
  d61_90: '61–90 days',
  d90_plus: '90+ days',
};

export interface InvoiceAmounts {
  total: number;
  paid: number;
  dueDate: string;
  voided?: boolean;
}

export function invoiceBalance(inv: InvoiceAmounts): number {
  if (inv.voided) return 0;
  return Math.max(0, Math.round((inv.total - inv.paid) * 100) / 100);
}

export function invoiceStatus(inv: InvoiceAmounts, today: string): InvoiceStatus {
  if (inv.voided) return 'VOID';
  const balance = invoiceBalance(inv);
  if (balance <= 0) return 'PAID';
  if (inv.dueDate < today) return 'OVERDUE';
  return inv.paid > 0 ? 'PARTIAL' : 'UNPAID';
}

function daysPastDue(dueDate: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86400000);
}

export function agingBucket(dueDate: string, today: string): AgingBucket {
  const days = daysPastDue(dueDate, today);
  if (days <= 0) return 'current';
  if (days <= 30) return 'd1_30';
  if (days <= 60) return 'd31_60';
  if (days <= 90) return 'd61_90';
  return 'd90_plus';
}

export type AgingSummary = Record<AgingBucket, number> & { total: number; overdue: number };

/** Sums unpaid balances into aging buckets by days past due. */
export function summarizeAging(invoices: InvoiceAmounts[], today: string): AgingSummary {
  const summary: AgingSummary = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0, overdue: 0 };
  for (const inv of invoices) {
    const balance = invoiceBalance(inv);
    if (balance <= 0) continue;
    const bucket = agingBucket(inv.dueDate, today);
    summary[bucket] += balance;
    summary.total += balance;
    if (bucket !== 'current') summary.overdue += balance;
  }
  for (const key of Object.keys(summary) as (keyof AgingSummary)[]) {
    summary[key] = Math.round(summary[key] * 100) / 100;
  }
  return summary;
}
