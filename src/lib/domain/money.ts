// Money helpers. Amounts are RWF with 2 decimal places, rounded half away from zero.

export function round2(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value) * 100 + Number.EPSILON) / 100;
}

/** Converts a Prisma Decimal (or number/string/null) to a JS number for display and DTOs. */
export function toNumber(value: { toString(): string } | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value.toString());
}

export interface VatBreakdown {
  subtotal: number; // excluding VAT
  vatAmount: number;
  total: number; // including VAT
}

/**
 * Splits an amount into net + VAT. With VAT-inclusive prices the VAT is backed out of the
 * amount (total stays exactly as charged); otherwise VAT is added on top.
 */
export function vatBreakdown(amount: number, vatRatePct: number, pricesIncludeVat: boolean): VatBreakdown {
  const rate = vatRatePct / 100;
  if (pricesIncludeVat) {
    const total = round2(amount);
    const subtotal = round2(total / (1 + rate));
    return { subtotal, vatAmount: round2(total - subtotal), total };
  }
  const subtotal = round2(amount);
  const vatAmount = round2(subtotal * rate);
  return { subtotal, vatAmount, total: round2(subtotal + vatAmount) };
}

export interface OrderLineInput {
  quantity: number;
  unitPrice: number;
}

export interface OrderTotals extends VatBreakdown {
  lineTotals: number[];
}

/** Line totals (quantity x price, as charged) and order-level VAT breakdown. */
export function computeOrderTotals(
  lines: OrderLineInput[],
  vatRatePct: number,
  pricesIncludeVat: boolean
): OrderTotals {
  const lineTotals = lines.map((l) => round2(l.quantity * l.unitPrice));
  const sum = round2(lineTotals.reduce((s, t) => s + t, 0));
  return { lineTotals, ...vatBreakdown(sum, vatRatePct, pricesIncludeVat) };
}
