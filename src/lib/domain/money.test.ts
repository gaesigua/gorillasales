import { describe, expect, it } from 'vitest';
import { computeOrderTotals, round2, vatBreakdown } from './money';

describe('vatBreakdown', () => {
  it('backs VAT out of VAT-inclusive amounts without changing the total', () => {
    expect(vatBreakdown(26000, 18, true)).toEqual({ subtotal: 22033.9, vatAmount: 3966.1, total: 26000 });
  });

  it('adds VAT on top of VAT-exclusive amounts', () => {
    expect(vatBreakdown(10000, 18, false)).toEqual({ subtotal: 10000, vatAmount: 1800, total: 11800 });
  });

  it('handles a 0% rate', () => {
    expect(vatBreakdown(5000, 0, true)).toEqual({ subtotal: 5000, vatAmount: 0, total: 5000 });
  });

  it('subtotal + VAT always equals total', () => {
    for (const amount of [1, 99.99, 2600, 13000, 123456.78]) {
      const b = vatBreakdown(amount, 18, true);
      expect(round2(b.subtotal + b.vatAmount)).toBe(b.total);
    }
  });
});

describe('computeOrderTotals', () => {
  it('sums line totals and splits VAT once at order level', () => {
    const t = computeOrderTotals(
      [
        { quantity: 10, unitPrice: 2600 },
        { quantity: 3, unitPrice: 9000 },
      ],
      18,
      true
    );
    expect(t.lineTotals).toEqual([26000, 27000]);
    expect(t.total).toBe(53000);
    expect(round2(t.subtotal + t.vatAmount)).toBe(53000);
  });

  it('supports fractional quantities (e.g. 2.5 KG)', () => {
    expect(computeOrderTotals([{ quantity: 2.5, unitPrice: 7500 }], 18, true).total).toBe(18750);
  });
});
