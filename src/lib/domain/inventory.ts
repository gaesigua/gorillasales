// Inventory rules: FIFO batch allocation, order coverage and roast yield.
// Dates are YYYY-MM-DD calendar strings; quantities are rounded to 3 decimals.

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export interface BatchStock {
  id: string;
  quantity: number; // on hand
  roastDate: string | null;
  bestBefore: string | null;
  receivedOn: string;
}

export interface Allocation {
  batchId: string;
  quantity: number;
}

/** Oldest coffee first: by roast date (or receipt date when not roasted), then receipt date. */
export function compareFifo(a: BatchStock, b: BatchStock): number {
  const ageA = a.roastDate ?? a.receivedOn;
  const ageB = b.roastDate ?? b.receivedOn;
  if (ageA !== ageB) return ageA < ageB ? -1 : 1;
  if (a.receivedOn !== b.receivedOn) return a.receivedOn < b.receivedOn ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function isExpired(batch: Pick<BatchStock, 'bestBefore'>, onDate: string): boolean {
  return !!batch.bestBefore && batch.bestBefore < onDate;
}

/**
 * Takes `quantity` from the oldest usable batches. Expired batches are never used.
 * Returns the allocations and any quantity that could not be covered.
 */
export function allocateFifo(
  batches: BatchStock[],
  quantity: number,
  onDate: string
): { allocations: Allocation[]; shortfall: number } {
  let remaining = round3(quantity);
  const allocations: Allocation[] = [];
  const usable = batches.filter((b) => b.quantity > 0 && !isExpired(b, onDate)).sort(compareFifo);
  for (const batch of usable) {
    if (remaining <= 0) break;
    const take = round3(Math.min(batch.quantity, remaining));
    allocations.push({ batchId: batch.id, quantity: take });
    remaining = round3(remaining - take);
  }
  return { allocations, shortfall: Math.max(0, remaining) };
}

export interface CoverageOrder {
  id: string;
  lines: { productId: string; quantity: number }[];
}

export interface Coverage {
  covered: boolean;
  short: { productId: string; missing: number }[];
}

/**
 * Which open orders current stock can fully cover, serving orders in the given priority
 * (oldest first). An order that cannot be fully covered reserves nothing, so smaller later
 * orders can still be served.
 */
export function orderCoverage(orders: CoverageOrder[], available: Map<string, number>): Map<string, Coverage> {
  const left = new Map(available);
  const result = new Map<string, Coverage>();
  for (const order of orders) {
    const need = new Map<string, number>();
    order.lines.forEach((l) => need.set(l.productId, round3((need.get(l.productId) ?? 0) + l.quantity)));
    const short = [...need.entries()]
      .map(([productId, qty]) => ({ productId, missing: round3(qty - (left.get(productId) ?? 0)) }))
      .filter((s) => s.missing > 0);
    if (short.length === 0) {
      need.forEach((qty, productId) => left.set(productId, round3((left.get(productId) ?? 0) - qty)));
    }
    result.set(order.id, { covered: short.length === 0, short });
  }
  return result;
}

/** Roast yield: roasted output weight as a % of green input weight. */
export function roastYieldPct(greenInputKg: number, outputKg: number): number {
  return greenInputKg > 0 ? Math.round((outputKg / greenInputKg) * 1000) / 10 : 0;
}

/** Typical roasting loses 12-25% of weight; outside 60-95% yield is almost certainly a data error. */
export const MIN_ROAST_YIELD_PCT = 60;
export const MAX_ROAST_YIELD_PCT = 95;

export function validateRoast(greenInputKg: number, outputKg: number): string | null {
  if (!(greenInputKg > 0)) return 'Enter the green coffee used.';
  if (!(outputKg > 0)) return 'Enter the roasted products produced.';
  const yieldPct = roastYieldPct(greenInputKg, outputKg);
  if (yieldPct > MAX_ROAST_YIELD_PCT) {
    return `Output (${outputKg} KG) is ${yieldPct}% of the green input (${greenInputKg} KG). Roasting loses weight; check the quantities.`;
  }
  if (yieldPct < MIN_ROAST_YIELD_PCT) {
    return `Yield of ${yieldPct}% is unusually low. Check the quantities, or record the loss as a stock adjustment.`;
  }
  return null;
}

/** Days since roasting (or receipt), for freshness display. */
export function ageInDays(fromDate: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86400000);
}

export function bestBeforeFrom(date: string, shelfLifeDays: number | null | undefined): string | null {
  if (!shelfLifeDays) return null;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + shelfLifeDays);
  return d.toISOString().slice(0, 10);
}
