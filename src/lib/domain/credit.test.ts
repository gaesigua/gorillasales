import { describe, expect, it } from 'vitest';
import { evaluateCredit, type CreditCheckInput } from './credit';

const base: CreditCheckInput = {
  creditLimit: 1_000_000,
  paymentTermsDays: 30,
  outstandingBalance: 0,
  overdueBalance: 0,
  openOrdersTotal: 0,
  orderTotal: 100_000,
};

describe('evaluateCredit', () => {
  it('approves orders within the credit limit', () => {
    expect(evaluateCredit(base)).toEqual({ approved: true });
  });

  it('counts outstanding invoices and open orders towards the limit', () => {
    const d = evaluateCredit({ ...base, outstandingBalance: 600_000, openOrdersTotal: 350_000 });
    expect(d.approved).toBe(false);
  });

  it('approves an order that lands exactly on the limit', () => {
    expect(evaluateCredit({ ...base, outstandingBalance: 900_000 }).approved).toBe(true);
  });

  it('holds any order when the customer has overdue invoices', () => {
    const d = evaluateCredit({ ...base, overdueBalance: 1 });
    expect(d).toEqual({ approved: false, reason: expect.stringContaining('overdue') });
  });

  it('approves cash-on-delivery orders regardless of credit limit', () => {
    expect(evaluateCredit({ ...base, paymentTermsDays: 0, creditLimit: 0, orderTotal: 5_000_000 }).approved).toBe(true);
  });

  it('still holds cash-on-delivery orders when there is an overdue balance', () => {
    expect(evaluateCredit({ ...base, paymentTermsDays: 0, overdueBalance: 50_000 }).approved).toBe(false);
  });

  it('holds credit orders for customers with no credit limit', () => {
    expect(evaluateCredit({ ...base, creditLimit: 0 }).approved).toBe(false);
  });
});
