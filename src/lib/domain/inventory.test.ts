import { describe, expect, it } from 'vitest';
import {
  allocateFifo,
  bestBeforeFrom,
  orderCoverage,
  roastYieldPct,
  validateRoast,
  type BatchStock,
} from './inventory';

const batch = (id: string, quantity: number, roastDate: string | null, bestBefore: string | null = null, receivedOn = roastDate ?? '2026-01-01'): BatchStock => ({
  id,
  quantity,
  roastDate,
  bestBefore,
  receivedOn,
});

describe('allocateFifo', () => {
  it('takes from the oldest roast first', () => {
    const r = allocateFifo([batch('new', 10, '2026-10-01'), batch('old', 4, '2026-09-01')], 6, '2026-10-07');
    expect(r).toEqual({
      allocations: [
        { batchId: 'old', quantity: 4 },
        { batchId: 'new', quantity: 2 },
      ],
      shortfall: 0,
    });
  });

  it('never uses expired batches', () => {
    const r = allocateFifo([batch('expired', 50, '2026-01-01', '2026-10-06'), batch('ok', 5, '2026-09-01')], 8, '2026-10-07');
    expect(r.allocations).toEqual([{ batchId: 'ok', quantity: 5 }]);
    expect(r.shortfall).toBe(3);
  });

  it('can use a batch on its best-before date', () => {
    expect(allocateFifo([batch('b', 5, '2026-01-01', '2026-10-07')], 5, '2026-10-07').shortfall).toBe(0);
  });

  it('skips empty batches and handles fractional quantities', () => {
    const r = allocateFifo([batch('empty', 0, '2026-01-01'), batch('a', 2.5, '2026-02-01'), batch('b', 1.25, '2026-03-01')], 3, '2026-10-07');
    expect(r).toEqual({
      allocations: [
        { batchId: 'a', quantity: 2.5 },
        { batchId: 'b', quantity: 0.5 },
      ],
      shortfall: 0,
    });
  });

  it('uses receipt date for unroasted (green) stock', () => {
    const r = allocateFifo([batch('g2', 10, null, null, '2026-05-01'), batch('g1', 10, null, null, '2026-04-01')], 5, '2026-10-07');
    expect(r.allocations[0].batchId).toBe('g1');
  });
});

describe('orderCoverage', () => {
  const stock = new Map([
    ['coffee', 10],
    ['pods', 2],
  ]);

  it('serves older orders first', () => {
    const r = orderCoverage(
      [
        { id: 'o1', lines: [{ productId: 'coffee', quantity: 8 }] },
        { id: 'o2', lines: [{ productId: 'coffee', quantity: 5 }] },
      ],
      stock
    );
    expect(r.get('o1')?.covered).toBe(true);
    expect(r.get('o2')).toEqual({ covered: false, short: [{ productId: 'coffee', missing: 3 }] });
  });

  it('a short order reserves nothing, so a later smaller order can still be covered', () => {
    const r = orderCoverage(
      [
        { id: 'big', lines: [{ productId: 'coffee', quantity: 5 }, { productId: 'pods', quantity: 3 }] },
        { id: 'small', lines: [{ productId: 'coffee', quantity: 10 }] },
      ],
      stock
    );
    expect(r.get('big')?.covered).toBe(false);
    expect(r.get('small')?.covered).toBe(true);
  });

  it('treats unknown products as out of stock', () => {
    expect(orderCoverage([{ id: 'o', lines: [{ productId: 'tea', quantity: 1 }] }], stock).get('o')?.covered).toBe(false);
  });
});

describe('roasting', () => {
  it('computes yield', () => {
    expect(roastYieldPct(100, 82)).toBe(82);
  });
  it('accepts normal yields', () => {
    expect(validateRoast(100, 83)).toBeNull();
  });
  it('rejects output heavier than plausible', () => {
    expect(validateRoast(100, 100)).toMatch(/loses weight/);
  });
  it('flags implausibly low yields', () => {
    expect(validateRoast(100, 40)).toMatch(/unusually low/);
  });
  it('requires both sides', () => {
    expect(validateRoast(0, 10)).not.toBeNull();
    expect(validateRoast(10, 0)).not.toBeNull();
  });
});

describe('bestBeforeFrom', () => {
  it('adds shelf life days', () => {
    expect(bestBeforeFrom('2026-10-07', 180)).toBe('2027-04-05');
  });
  it('returns null without a shelf life', () => {
    expect(bestBeforeFrom('2026-10-07', null)).toBeNull();
  });
});
