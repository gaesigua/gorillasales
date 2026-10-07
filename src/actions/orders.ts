'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { MANAGER_ROLES, canViewAllReps, orderScope, requireRole, requireSession } from '@/lib/tenant';
import type { UserSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { addDaysToDate, stringToDateColumn, todayKigali } from '@/lib/dates';
import { toNumber } from '@/lib/domain/money';
import { nextDocumentNumber } from '@/lib/documentNumbers';
import { dateString, placeOrderTx, type PlaceOrderInput } from '@/lib/orderService';
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

    await prisma.salesOrder.update({
      where: { id: order.id },
      data: { status: 'CANCELLED', cancelledById: session.userId, cancelledAt: new Date(), cancelReason },
    });
    await audit(session, 'CANCEL_ORDER', 'SalesOrder', order.id, { reason: cancelReason });
    return reload(session, order.id);
  });
}

const deliverSchema = z.object({
  deliveredOn: dateString.optional(),
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
 * Mark a confirmed order delivered: issues the invoice (due after the customer's payment
 * terms) and, optionally, records payment collected on delivery.
 */
export async function deliverOrder(orderId: string, input: DeliverOrderInput = {}): Promise<ActionResult<Order>> {
  return runAction('deliverOrder', async () => {
    const session = await requireRole([...DELIVERY_ROLES]);
    const order = await loadOrder(session, orderId);
    const data = deliverSchema.parse(input);
    if (order.status === 'PENDING_APPROVAL') throw new UserFacingError('This order is on credit hold and must be approved first.');
    if (order.status !== 'CONFIRMED') throw new UserFacingError('Only confirmed orders can be delivered.');

    const today = todayKigali();
    const deliveredOn = data.deliveredOn ?? today;
    const orderDate = order.orderDate.toISOString().slice(0, 10);
    if (deliveredOn > today) throw new UserFacingError('Delivery date cannot be in the future.');
    if (deliveredOn < orderDate) throw new UserFacingError('Delivery date cannot be before the order date.');
    const total = toNumber(order.total);
    if (data.payment && data.payment.amount > total) throw new UserFacingError('Payment is more than the invoice total.');
    if (data.payment && data.payment.method !== 'CASH' && !data.payment.reference) {
      throw new UserFacingError('Enter the transaction reference for non-cash payments.');
    }

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: session.organizationId } });
    const invoice = await prisma.$transaction(async (tx) => {
      // Guard against two people delivering the same order at once
      const updated = await tx.salesOrder.updateMany({
        where: { id: order.id, status: 'CONFIRMED' },
        data: { status: 'DELIVERED', deliveredById: session.userId, deliveredAt: new Date() },
      });
      if (updated.count !== 1) throw new UserFacingError('Order was changed by someone else. Refresh and try again.');

      const inv = await tx.invoice.create({
        data: {
          organizationId: session.organizationId,
          invoiceNumber: await nextDocumentNumber(tx, session.organizationId, 'INVOICE'),
          orderId: order.id,
          customerId: order.customerId,
          issueDate: stringToDateColumn(deliveredOn),
          dueDate: stringToDateColumn(addDaysToDate(deliveredOn, order.paymentTermsDays)),
          vatRate: org.vatRate,
          subtotal: order.subtotal,
          vatAmount: order.vatAmount,
          total: order.total,
        },
      });
      if (data.payment) {
        await tx.payment.create({
          data: {
            organizationId: session.organizationId,
            paymentNumber: await nextDocumentNumber(tx, session.organizationId, 'PAYMENT'),
            invoiceId: inv.id,
            customerId: order.customerId,
            amount: data.payment.amount,
            method: data.payment.method,
            reference: data.payment.reference || null,
            paidOn: stringToDateColumn(deliveredOn),
            receivedById: session.userId,
            notes: 'Collected on delivery',
          },
        });
      }
      return inv;
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
