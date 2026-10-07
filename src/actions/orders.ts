'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { MANAGER_ROLES, canViewAllReps, orderScope, requireRole, requireSession } from '@/lib/tenant';
import type { UserSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { stringToDateColumn, todayKigali } from '@/lib/dates';
import { toNumber } from '@/lib/domain/money';
import { dateString, placeOrderTx, type PlaceOrderInput } from '@/lib/orderService';
import {
  getDefaultWarehouse,
  issueInvoiceOnDelivery,
  requireWarehouse,
  takeStockFifo,
  validateDelivery,
} from '@/lib/inventoryService';
import { listOrders, orderInclude, toOrderDTO } from '@/lib/data/orders';
import type { ActionResult, Order } from '@/lib/types';

/** Roles that hand goods over to customers and so may mark orders delivered. */
const DELIVERY_ROLES = [...MANAGER_ROLES, 'DELIVERY_SUPPORT', 'DRIVER'] as const;

async function loadOrder(session: UserSession, orderId: string) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: z.string().parse(orderId), ...orderScope(session) },
    include: orderInclude,
  });
  if (!order) throw new UserFacingError('Order not found.');
  return order;
}

async function reload(session: UserSession, orderId: string): Promise<Order> {
  revalidatePath('/', 'layout');
  return toOrderDTO(await loadOrder(session, orderId));
}

/** Place an order. It is confirmed immediately unless the credit check puts it on hold. */
export async function createOrder(input: PlaceOrderInput): Promise<ActionResult<Order>> {
  return runAction('createOrder', async () => {
    const session = await requireSession();
    const placed = await placeOrderTx(session, input);
    await audit(session, 'CREATE_ORDER', 'SalesOrder', placed.id, {
      orderNumber: placed.orderNumber,
      total: placed.total,
      status: placed.status,
      holdReason: placed.holdReason,
    });
    return reload(session, placed.id);
  });
}

/** Release an order from credit hold (managers only). */
export async function approveOrder(orderId: string): Promise<ActionResult<Order>> {
  return runAction('approveOrder', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const order = await loadOrder(session, orderId);
    if (order.status !== 'PENDING_APPROVAL') throw new UserFacingError('Only orders on credit hold need approval.');

    await prisma.salesOrder.update({
      where: { id: order.id },
      data: { status: 'CONFIRMED', approvedById: session.userId, approvedAt: new Date() },
    });
    await audit(session, 'APPROVE_ORDER', 'SalesOrder', order.id, { holdReason: order.holdReason });
    return reload(session, order.id);
  });
}

/** Cancel an order that has not been delivered. Sales officers may cancel their own orders. */
export async function cancelOrder(orderId: string, reason: string): Promise<ActionResult<Order>> {
  return runAction('cancelOrder', async () => {
    const session = await requireSession();
    const order = await loadOrder(session, orderId);
    const cancelReason = z.string().trim().min(3, 'Give a reason for cancelling').max(500).parse(reason);
    if (order.status === 'DELIVERED') throw new UserFacingError('Delivered orders cannot be cancelled.');
    if (order.status === 'CANCELLED') throw new UserFacingError('Order is already cancelled.');
    if (!canViewAllReps(session) && order.salespersonId !== session.userId) {
      throw new UserFacingError('You can only cancel your own orders.');
    }
    if (order.deliveryRun && order.deliveryRun.status === 'DISPATCHED') {
      throw new UserFacingError(
        `This order is out for delivery on ${order.deliveryRun.runNumber}. Mark the stop as failed first.`
      );
    }

    // Cancelling also takes the order off a planned delivery run
    await prisma.salesOrder.update({
      where: { id: order.id },
      data: { status: 'CANCELLED', cancelledById: session.userId, cancelledAt: new Date(), cancelReason, deliveryRunId: null },
    });
    await audit(session, 'CANCEL_ORDER', 'SalesOrder', order.id, { reason: cancelReason });
    return reload(session, order.id);
  });
}

const deliverSchema = z.object({
  deliveredOn: dateString.optional(),
  warehouseId: z.string().optional(),
  payment: z
    .object({
      amount: z.coerce.number().positive(),
      method: z.enum(['CASH', 'MTN_MOMO', 'AIRTEL_MONEY', 'BANK_TRANSFER', 'CHEQUE']),
      reference: z.string().trim().max(100).optional(),
    })
    .optional(),
});

export type DeliverOrderInput = z.input<typeof deliverSchema>;

/**
 * Deliver a confirmed order directly from a warehouse (not on a delivery run): takes the
 * stock oldest-batch-first, issues the invoice and optionally records payment collected.
 * Refused when there is not enough usable stock.
 */
export async function deliverOrder(orderId: string, input: DeliverOrderInput = {}): Promise<ActionResult<Order>> {
  return runAction('deliverOrder', async () => {
    const session = await requireRole([...DELIVERY_ROLES]);
    const order = await loadOrder(session, orderId);
    const data = deliverSchema.parse(input);
    if (order.status === 'PENDING_APPROVAL') throw new UserFacingError('This order is on credit hold and must be approved first.');
    if (order.status !== 'CONFIRMED') throw new UserFacingError('Only confirmed orders can be delivered.');
    if (order.deliveryRunId) {
      throw new UserFacingError(`This order is on delivery run ${order.deliveryRun?.runNumber}. Deliver it from the run.`);
    }
    const deliveredOn = data.deliveredOn ?? todayKigali();
    validateDelivery(order, deliveredOn, data.payment);

    const invoice = await prisma.$transaction(async (tx) => {
      const warehouse = data.warehouseId
        ? await requireWarehouse(tx, session.organizationId, data.warehouseId)
        : await getDefaultWarehouse(tx, session.organizationId);
      for (const line of order.lines) {
        await takeStockFifo(tx, session, {
          warehouseId: warehouse.id,
          productId: line.productId,
          productName: line.product.name,
          quantity: toNumber(line.quantity),
          onDate: deliveredOn,
          type: 'DELIVERY',
          orderId: order.id,
        });
      }
      return issueInvoiceOnDelivery(tx, session, order, deliveredOn, data.payment);
    });

    await audit(session, 'DELIVER_ORDER', 'SalesOrder', order.id, {
      invoiceNumber: invoice.invoiceNumber,
      paymentCollected: data.payment?.amount ?? 0,
    });
    return reload(session, order.id);
  });
}

const MAX_REPORT_DAYS = 366;

/** Non-cancelled orders in a date range (inclusive), for on-demand reports. */
export async function getOrdersForPeriod(from: string, to: string): Promise<ActionResult<Order[]>> {
  return runAction('getOrdersForPeriod', async () => {
    const session = await requireSession();
    const start = stringToDateColumn(dateString.parse(from));
    const end = stringToDateColumn(dateString.parse(to));
    const days = (end.getTime() - start.getTime()) / 86400000;
    if (days < 0 || days > MAX_REPORT_DAYS) throw new UserFacingError('Choose a period of at most one year.');
    return listOrders(session, { from, to, excludeCancelled: true });
  });
}
