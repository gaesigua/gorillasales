import 'server-only';

import type { OrderStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from './prisma';
import type { UserSession } from './auth';
import { canViewAllReps, customerScope, scopedSalespersonId } from './tenant';
import { UserFacingError } from './actionUtils';
import { stringToDateColumn, todayKigali } from './dates';
import { computeOrderTotals, toNumber } from './domain/money';
import { evaluateCredit } from './domain/credit';
import { getCustomerBalance } from './data/balances';
import { resolveUnitPrices } from './pricing';
import { nextDocumentNumber } from './documentNumbers';

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

export const orderLinesSchema = z
  .array(
    z.object({
      productId: z.string().min(1, 'Select a product'),
      quantity: z.coerce.number().positive('Quantity must be more than 0').max(1_000_000),
      unitPrice: z.coerce.number().min(0).optional(), // honoured for managers only
    })
  )
  .min(1, 'Add at least one product')
  .max(50);

export const placeOrderSchema = z.object({
  customerId: z.string().min(1, 'Select a customer'),
  salespersonId: z.string().optional().or(z.literal('')),
  orderDate: dateString,
  lines: orderLinesSchema,
  notes: z.string().trim().max(2000).optional(),
});

export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

export interface PlacedOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  holdReason: string | null;
  total: number;
}

/**
 * Validates and creates an order inside `tx`. Prices come from the customer's price list
 * (managers may override them); the order is put on credit hold when the credit check fails.
 */
export async function placeOrder(
  tx: Prisma.TransactionClient,
  session: UserSession,
  rawInput: PlaceOrderInput,
  visitLogId?: string
): Promise<PlacedOrder> {
  const input = placeOrderSchema.parse(rawInput);
  const { organizationId } = session;
  if (input.orderDate > todayKigali()) throw new UserFacingError('Order date cannot be in the future.');

  const customer = await tx.customer.findFirst({ where: { id: input.customerId, ...customerScope(session) } });
  if (!customer) throw new UserFacingError('Customer not found.');
  // Serialize orders per customer so two simultaneous orders cannot both pass the credit check
  await tx.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${customer.id} FOR UPDATE`;
  if (customer.status === 'INACTIVE') throw new UserFacingError('This customer is inactive. Reactivate them first.');

  // Officers always sell as themselves; managers default to the customer's assigned rep
  const salespersonId =
    scopedSalespersonId(session, input.salespersonId || undefined) || customer.salespersonId || session.userId;
  const rep = await tx.user.findFirst({ where: { id: salespersonId, organizationId }, select: { id: true } });
  if (!rep) throw new UserFacingError('Salesperson not found.');

  const productIds = input.lines.map((l) => l.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new UserFacingError('Each product can only appear once per order. Adjust the quantity instead.');
  }
  const products = await tx.product.findMany({
    where: { organizationId, id: { in: productIds }, isActive: true },
    select: { id: true, weightKg: true },
  });
  if (products.length !== productIds.length) throw new UserFacingError('One of the products is not available.');

  const listPrices = await resolveUnitPrices(organizationId, customer.priceListId, productIds);
  const mayOverridePrice = canViewAllReps(session);
  const lines = input.lines.map((l) => ({
    productId: l.productId,
    quantity: l.quantity,
    unitPrice: mayOverridePrice && l.unitPrice !== undefined ? l.unitPrice : listPrices.get(l.productId)!,
    unitWeightKg: products.find((p) => p.id === l.productId)!.weightKg,
  }));

  const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const totals = computeOrderTotals(lines, toNumber(org.vatRate), org.pricesIncludeVat);
  if (totals.total <= 0) throw new UserFacingError('Order total must be more than zero.');

  const balance = await getCustomerBalance(organizationId, todayKigali(), customer.id);
  const decision = evaluateCredit({
    creditLimit: toNumber(customer.creditLimit),
    paymentTermsDays: customer.paymentTermsDays,
    outstandingBalance: balance.outstanding,
    overdueBalance: balance.overdue,
    openOrdersTotal: balance.openOrders,
    orderTotal: totals.total,
  });

  const order = await tx.salesOrder.create({
    data: {
      organizationId,
      orderNumber: await nextDocumentNumber(tx, organizationId, 'SALES_ORDER'),
      customerId: customer.id,
      salespersonId,
      visitLogId,
      orderDate: stringToDateColumn(input.orderDate),
      status: decision.approved ? 'CONFIRMED' : 'PENDING_APPROVAL',
      holdReason: decision.approved ? null : decision.reason,
      paymentTermsDays: customer.paymentTermsDays,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      notes: input.notes || null,
      createdById: session.userId,
      lines: {
        create: lines.map((l, i) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          unitWeightKg: l.unitWeightKg,
          lineTotal: totals.lineTotals[i],
        })),
      },
    },
  });

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    holdReason: order.holdReason,
    total: totals.total,
  };
}

/** Runs placeOrder in its own transaction. */
export function placeOrderTx(session: UserSession, input: PlaceOrderInput): Promise<PlacedOrder> {
  return prisma.$transaction((tx) => placeOrder(tx, session, input));
}
