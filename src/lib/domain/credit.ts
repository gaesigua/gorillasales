// Credit control applied when an order is placed.

export interface CreditCheckInput {
  creditLimit: number; // maximum allowed exposure; 0 = no credit
  paymentTermsDays: number; // 0 = cash on delivery
  outstandingBalance: number; // unpaid amount on issued invoices
  overdueBalance: number; // unpaid amount on invoices past their due date
  openOrdersTotal: number; // confirmed/held orders not yet invoiced
  orderTotal: number; // the new order
}

export type CreditDecision = { approved: true } | { approved: false; reason: string };

/**
 * - Any overdue balance puts new orders on hold, whatever the terms.
 * - Cash-on-delivery customers (0 days) are otherwise always approved: they pay on delivery.
 * - Credit customers are held when outstanding invoices + open orders + this order exceed
 *   their credit limit.
 */
export function evaluateCredit(input: CreditCheckInput): CreditDecision {
  if (input.overdueBalance > 0) {
    return { approved: false, reason: `Customer has ${fmt(input.overdueBalance)} overdue` };
  }
  if (input.paymentTermsDays <= 0) return { approved: true };

  const exposure = input.outstandingBalance + input.openOrdersTotal + input.orderTotal;
  if (exposure > input.creditLimit) {
    return {
      approved: false,
      reason: `Credit limit exceeded: exposure ${fmt(exposure)} > limit ${fmt(input.creditLimit)}`,
    };
  }
  return { approved: true };
}

function fmt(n: number): string {
  return `RWF ${Math.round(n).toLocaleString('en-US')}`;
}
