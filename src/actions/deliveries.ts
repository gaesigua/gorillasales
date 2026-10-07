'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { requireRole, requireSession } from '@/lib/tenant';
import { canManageWarehouse, WAREHOUSE_ROLES } from '@/lib/roles';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { addDaysToDate, stringToDateColumn, todayKigali } from '@/lib/dates';
import { toNumber } from '@/lib/domain/money';
import { nextDocumentNumber } from '@/lib/documentNumbers';
import { dateString } from '@/lib/orderService';
import { issueInvoiceOnDelivery, putStock, requireWarehouse, takeStockFifo, validateDelivery } from '@/lib/inventoryService';
import { deliveryRunScope, runInclude, toRunDTO } from '@/lib/data/deliveries';
import { listBatches } from '@/lib/data/inventory';
import type { ActionResult, DeliveryRunDTO } from '@/lib/types';

async function loadRun(tx: Prisma.TransactionClient, session: UserSession, runId: string) {
  const run = await tx.deliveryRun.findFirst({
    where: { id: z.string().parse(runId), ...deliveryRunScope(session) },
    include: runInclude,
  });
  if (!run) throw new UserFacingError('Delivery run not found.');
  return run;
}

async function reload(session: UserSession, runId: string): Promise<DeliveryRunDTO> {
  revalidatePath('/', 'layout');
  const today = todayKigali();
  const [run, batches] = await Promise.all([loadRun(prisma, session, runId), listBatches(session, today)]);
  return toRunDTO(run, batches.filter((b) => !b.expired), today);
}

/** Orders that may be put on a run: confirmed, not delivered, not already on another run. */
async function assertAssignable(tx: Prisma.TransactionClient, organizationId: string, orderIds: string[], runId?: string) {
  if (new Set(orderIds).size !== orderIds.length) throw new UserFacingError('An order is listed twice.');
  const orders = await tx.salesOrder.findMany({
    where: { id: { in: orderIds }, organizationId },
    select: { id: true, orderNumber: true, status: true, deliveryRunId: true },
  });
  if (orders.length !== orderIds.length) throw new UserFacingError('Order not found.');
  for (const o of orders) {
    if (o.status !== 'CONFIRMED') throw new UserFacingError(`${o.orderNumber} is not a confirmed order.`);
    if (o.deliveryRunId && o.deliveryRunId !== runId) throw new UserFacingError(`${o.orderNumber} is already on another delivery run.`);
  }
}

const runSchema = z.object({
  runDate: dateString,
  warehouseId: z.string().min(1, 'Choose a warehouse'),
  driverId: z.string().min(1, 'Choose a driver'),
  vehicle: z.string().trim().max(40).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  orderIds: z.array(z.string()).min(1, 'Add at least one order').max(60),
});

export type DeliveryRunInput = z.input<typeof runSchema>;

/** Plan a delivery run for a driver with a set of confirmed orders. */
export async function createDeliveryRun(input: DeliveryRunInput): Promise<ActionResult<DeliveryRunDTO>> {
  return runAction('createDeliveryRun', async () => {
    const session = await requireRole(WAREHOUSE_ROLES);
    const data = runSchema.parse(input);
    const today = todayKigali();
    if (data.runDate < today || data.runDate > addDaysToDate(today, 30)) {
      throw new UserFacingError('Run date must be today or within the next 30 days.');
    }

    const run = await prisma.$transaction(async (tx) => {
      await requireWarehouse(tx, session.organizationId, data.warehouseId);
      const driver = await tx.user.findFirst({
        where: { id: data.driverId, organizationId: session.organizationId, isActive: true, role: { in: ['DRIVER', 'DELIVERY_SUPPORT'] } },
      });
      if (!driver) throw new UserFacingError('Driver not found (must be an active Driver or Delivery Support user).');
      await assertAssignable(tx, session.organizationId, data.orderIds);

      const created = await tx.deliveryRun.create({
        data: {
          organizationId: session.organizationId,
          runNumber: await nextDocumentNumber(tx, session.organizationId, 'DELIVERY_RUN'),
          runDate: stringToDateColumn(data.runDate),
          warehouseId: data.warehouseId,
          driverId: driver.id,
          vehicle: data.vehicle || null,
          notes: data.notes || null,
          createdById: session.userId,
        },
      });
      // Only claim orders not already on a run (guards against two dispatchers at once)
      const claimed = await tx.salesOrder.updateMany({
        where: { id: { in: data.orderIds }, status: 'CONFIRMED', deliveryRunId: null },
        data: { deliveryRunId: created.id, deliveryFailedReason: null },
      });
      if (claimed.count !== data.orderIds.length) throw new UserFacingError('Some orders changed meanwhile. Refresh and try again.');
      return created;
    });

    await audit(session, 'CREATE_DELIVERY_RUN', 'DeliveryRun', run.id, { runNumber: run.runNumber, orders: data.orderIds.length });
    return reload(session, run.id);
  });
}

/** Replace the stops of a planned run. */
export async function setRunStops(runId: string, orderIds: string[]): Promise<ActionResult<DeliveryRunDTO>> {
  return runAction('setRunStops', async () => {
    const session = await requireRole(WAREHOUSE_ROLES);
    const ids = z.array(z.string()).min(1, 'A run needs at least one order').max(60).parse(orderIds);
    await prisma.$transaction(async (tx) => {
      const run = await loadRun(tx, session, runId);
      if (run.status !== 'PLANNED') throw new UserFacingError('Only planned runs can be changed.');
      await assertAssignable(tx, session.organizationId, ids, run.id);
      await tx.salesOrder.updateMany({ where: { deliveryRunId: run.id, id: { notIn: ids } }, data: { deliveryRunId: null } });
      const claimed = await tx.salesOrder.updateMany({
        where: { id: { in: ids }, status: 'CONFIRMED', OR: [{ deliveryRunId: null }, { deliveryRunId: run.id }] },
        data: { deliveryRunId: run.id },
      });
      if (claimed.count !== ids.length) throw new UserFacingError('Some orders changed meanwhile. Refresh and try again.');
    });
    await audit(session, 'UPDATE_DELIVERY_RUN', 'DeliveryRun', runId, { orders: ids.length });
    return reload(session, runId);
  });
}

/** Load the run: takes every stop's goods out of the warehouse (oldest batches first). */
export async function dispatchRun(runId: string): Promise<ActionResult<DeliveryRunDTO>> {
  return runAction('dispatchRun', async () => {
    const session = await requireRole(WAREHOUSE_ROLES);
    const today = todayKigali();
    const run = await prisma.$transaction(async (tx) => {
      const run = await loadRun(tx, session, runId);
      if (run.status !== 'PLANNED') throw new UserFacingError('Only planned runs can be dispatched.');
      if (run.stops.length === 0) throw new UserFacingError('Add orders to the run first.');
      const notConfirmed = run.stops.find((s) => s.status !== 'CONFIRMED');
      if (notConfirmed) throw new UserFacingError(`${notConfirmed.orderNumber} is no longer confirmed. Remove it from the run.`);

      for (const stop of run.stops) {
        for (const line of stop.lines) {
          await takeStockFifo(tx, session, {
            warehouseId: run.warehouseId,
            productId: line.productId,
            productName: line.product.name,
            quantity: toNumber(line.quantity),
            onDate: today,
            type: 'DISPATCH',
            orderId: stop.id,
            deliveryRunId: run.id,
          });
        }
      }
      const updated = await tx.deliveryRun.updateMany({
        where: { id: run.id, status: 'PLANNED' },
        data: { status: 'DISPATCHED', dispatchedAt: new Date() },
      });
      if (updated.count !== 1) throw new UserFacingError('Run was changed by someone else. Refresh and try again.');
      return run;
    });
    await audit(session, 'DISPATCH_DELIVERY_RUN', 'DeliveryRun', run.id, { runNumber: run.runNumber, stops: run.stops.length });
    return reload(session, run.id);
  });
}

/** Stop actions are for the run's driver or warehouse staff. */
async function loadStop(tx: Prisma.TransactionClient, session: UserSession, orderId: string) {
  const order = await tx.salesOrder.findFirst({
    where: { id: z.string().parse(orderId), organizationId: session.organizationId },
    include: { deliveryRun: true },
  });
  if (!order || !order.deliveryRun) throw new UserFacingError('Delivery stop not found.');
  if (!canManageWarehouse(session.role) && order.deliveryRun.driverId !== session.userId) {
    throw new UserFacingError('This stop is on another driver’s run.');
  }
  if (order.deliveryRun.status !== 'DISPATCHED') throw new UserFacingError('The run has not been dispatched.');
  if (order.status !== 'CONFIRMED') throw new UserFacingError('This stop has already been delivered.');
  return { order, run: order.deliveryRun };
}

const stopDeliverySchema = z.object({
  deliveredOn: dateString.optional(),
  payment: z
    .object({
      amount: z.coerce.number().positive(),
      method: z.enum(['CASH', 'MTN_MOMO', 'AIRTEL_MONEY', 'BANK_TRANSFER', 'CHEQUE']),
      reference: z.string().trim().max(100).optional(),
    })
    .optional(),
});

/** Driver hands the goods over: issues the invoice and records any payment collected. */
export async function deliverStop(orderId: string, input: z.input<typeof stopDeliverySchema> = {}): Promise<ActionResult<DeliveryRunDTO>> {
  return runAction('deliverStop', async () => {
    const session = await requireSession();
    const data = stopDeliverySchema.parse(input);
    const deliveredOn = data.deliveredOn ?? todayKigali();
    const { order, run, invoiceNumber } = await prisma.$transaction(async (tx) => {
      const { order, run } = await loadStop(tx, session, orderId);
      validateDelivery(order, deliveredOn, data.payment);
      const invoice = await issueInvoiceOnDelivery(tx, session, order, deliveredOn, data.payment, run.id);
      return { order, run, invoiceNumber: invoice.invoiceNumber };
    });
    await audit(session, 'DELIVER_STOP', 'SalesOrder', order.id, {
      runNumber: run.runNumber,
      invoiceNumber,
      paymentCollected: data.payment?.amount ?? 0,
    });
    return reload(session, run.id);
  });
}

/** Customer could not take delivery: the goods stay on the truck and return at run completion. */
export async function failStop(orderId: string, reason: string): Promise<ActionResult<DeliveryRunDTO>> {
  return runAction('failStop', async () => {
    const session = await requireSession();
    const why = z.string().trim().min(3, 'Say why the delivery failed').max(300).parse(reason);
    const { order, run } = await prisma.$transaction(async (tx) => {
      const stop = await loadStop(tx, session, orderId);
      await tx.salesOrder.update({ where: { id: stop.order.id }, data: { deliveryFailedReason: why } });
      return stop;
    });
    await audit(session, 'FAIL_STOP', 'SalesOrder', order.id, { runNumber: run.runNumber, reason: why });
    return reload(session, run.id);
  });
}

/**
 * Close a dispatched run once every stop is delivered or failed. Failed stops' goods go back
 * into the batches they came from and the orders return to the queue for another run.
 */
export async function completeRun(runId: string): Promise<ActionResult<DeliveryRunDTO>> {
  return runAction('completeRun', async () => {
    const session = await requireRole(WAREHOUSE_ROLES);
    const result = await prisma.$transaction(async (tx) => {
      const run = await loadRun(tx, session, runId);
      if (run.status !== 'DISPATCHED') throw new UserFacingError('Only runs out for delivery can be completed.');
      const open = run.stops.filter((s) => s.status === 'CONFIRMED' && !s.deliveryFailedReason);
      if (open.length) {
        throw new UserFacingError(`Mark these stops delivered or failed first: ${open.map((s) => s.orderNumber).join(', ')}.`);
      }

      const failed = run.stops.filter((s) => s.status === 'CONFIRMED');
      for (const stop of failed) {
        const dispatched = await tx.stockMovement.findMany({
          where: { orderId: stop.id, deliveryRunId: run.id, type: 'DISPATCH' },
        });
        for (const m of dispatched) {
          await putStock(tx, session, {
            batchId: m.batchId,
            quantity: -toNumber(m.quantity),
            type: 'RETURN',
            orderId: stop.id,
            deliveryRunId: run.id,
            reason: stop.deliveryFailedReason ?? 'Delivery failed',
          });
        }
        await tx.salesOrder.update({ where: { id: stop.id }, data: { deliveryRunId: null } });
      }
      await tx.deliveryRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
      return { run, failed: failed.length };
    });
    await audit(session, 'COMPLETE_DELIVERY_RUN', 'DeliveryRun', result.run.id, {
      runNumber: result.run.runNumber,
      delivered: result.run.stops.length - result.failed,
      failed: result.failed,
    });
    return reload(session, result.run.id);
  });
}

/** Cancel a run that has not left the warehouse; its orders go back to the queue. */
export async function cancelRun(runId: string): Promise<ActionResult<DeliveryRunDTO>> {
  return runAction('cancelRun', async () => {
    const session = await requireRole(WAREHOUSE_ROLES);
    const run = await prisma.$transaction(async (tx) => {
      const run = await loadRun(tx, session, runId);
      if (run.status !== 'PLANNED') {
        throw new UserFacingError('Only planned runs can be cancelled. For a dispatched run, fail the stops and complete it.');
      }
      await tx.salesOrder.updateMany({ where: { deliveryRunId: run.id }, data: { deliveryRunId: null } });
      await tx.deliveryRun.update({ where: { id: run.id }, data: { status: 'CANCELLED' } });
      return run;
    });
    await audit(session, 'CANCEL_DELIVERY_RUN', 'DeliveryRun', run.id, { runNumber: run.runNumber });
    return reload(session, run.id);
  });
}
