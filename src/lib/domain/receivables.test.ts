import { describe, expect, it } from 'vitest';
import { agingBucket, invoiceBalance, invoiceStatus, refundDue, summarizeAging } from './receivables';

const today = '2026-10-07';

describe('invoiceStatus', () => {
  it('is PAID when fully paid, even after the due date', () => {
    expect(invoiceStatus({ total: 1000, paid: 1000, dueDate: '2026-01-01' }, today)).toBe('PAID');
  });
  it('is UNPAID before the due date with no payments', () => {
    expect(invoiceStatus({ total: 1000, paid: 0, dueDate: '2026-10-07' }, today)).toBe('UNPAID');
  });
  it('is PARTIAL before the due date with some payment', () => {
    expect(invoiceStatus({ total: 1000, paid: 400, dueDate: '2026-10-20' }, today)).toBe('PARTIAL');
  });
  it('is OVERDUE once the due date has passed with a balance', () => {
    expect(invoiceStatus({ total: 1000, paid: 400, dueDate: '2026-10-06' }, today)).toBe('OVERDUE');
  });
  it('is VOID for voided invoices, which carry no balance', () => {
    const inv = { total: 1000, paid: 0, dueDate: '2026-01-01', voided: true };
    expect(invoiceStatus(inv, today)).toBe('VOID');
    expect(invoiceBalance(inv)).toBe(0);
  });
});

describe('agingBucket', () => {
  it.each([
    ['2026-10-07', 'current'],
    ['2026-10-30', 'current'],
    ['2026-10-06', 'd1_30'],
    ['2026-09-07', 'd1_30'],
    ['2026-09-06', 'd31_60'],
    ['2026-08-08', 'd31_60'],
    ['2026-08-07', 'd61_90'],
    ['2026-07-09', 'd61_90'],
    ['2026-07-08', 'd90_plus'],
  ])('due %s -> %s', (due, bucket) => {
    expect(agingBucket(due, today)).toBe(bucket);
  });
});

describe('summarizeAging', () => {
  it('buckets unpaid balances and ignores paid invoices', () => {
    const s = summarizeAging(
      [
        { total: 1000, paid: 0, dueDate: '2026-10-10' },
        { total: 500, paid: 200, dueDate: '2026-09-20' },
        { total: 800, paid: 800, dueDate: '2026-01-01' },
        { total: 300, paid: 0, dueDate: '2026-05-01' },
      ],
      today
    );
    expect(s).toEqual({ current: 1000, d1_30: 300, d31_60: 0, d61_90: 0, d90_plus: 300, total: 1600, overdue: 600 });
  });
});

describe('credit notes and refunds', () => {
  it('credit reduces the balance', () => {
    const inv = { total: 1000, paid: 0, credited: 300, dueDate: '2026-10-20' };
    expect(invoiceBalance(inv)).toBe(700);
    expect(invoiceStatus(inv, today)).toBe('PARTIAL');
  });
  it('fully credited and unpaid is CREDITED', () => {
    expect(invoiceStatus({ total: 1000, paid: 0, credited: 1000, dueDate: '2026-01-01' }, today)).toBe('CREDITED');
  });
  it('paid then credited means a refund is due', () => {
    const inv = { total: 1000, paid: 1000, credited: 400, dueDate: '2026-01-01' };
    expect(refundDue(inv)).toBe(400);
    expect(invoiceBalance(inv)).toBe(0);
    expect(invoiceStatus(inv, today)).toBe('REFUND_DUE');
  });
  it('after the refund the invoice is settled', () => {
    expect(invoiceStatus({ total: 1000, paid: 600, credited: 400, dueDate: '2026-01-01' }, today)).toBe('PAID');
  });
  it('credited balances are excluded from aging', () => {
    expect(summarizeAging([{ total: 1000, paid: 0, credited: 1000, dueDate: '2026-01-01' }], today).total).toBe(0);
  });
});
