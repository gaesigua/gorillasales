import 'server-only';

import { Prisma, type StockMovementType } from '@prisma/client';
import type { UserSession } from './auth';
import { UserFacingError } from './actionUtils';
import { addDaysToDate, dateColumnToString, stringToDateColumn, todayKigali } from './dates';
import { toNumber } from './domain/money';
import { allocateFifo, round3, type Allocation } from './domain/inventory';
import { nextDocumentNumber } from './documentNumbers';

type Tx = Prisma.TransactionClient;

export interface MovementRefs {
  orderId?: string;
  deliveryRunId?: string;
  roastRunId?: string;
  reason?: string;
}

/** The organization's default warehouse (used for direct deliveries). */
export async function getDefaultWarehouse(tx: Tx, organizationId: string) {
  const warehouse =
    (await tx.warehouse.findFirst({ where: { organizationId, isActive: true, isDefault: true } })) ??
    (await tx.warehouse.findFirst({ where: { organizationId, isActive: true }, orderBy: { createdAt: 'asc' } }));
  if (!warehouse) throw new UserFacingError('Set up a warehouse first (Config → Warehouses).');
  return warehouse;
}

export async function requireWarehouse(tx: Tx, organizationId: string, warehouseId: string) {
  const warehouse = await tx.warehouse.findFirst({ where: { id: warehouseId, organizationId, isActive: true } });
  if (!warehouse) throw new UserFacingError('Warehouse not found.');
  return warehouse;
}

/**
 * Takes stock of one product out of a warehouse, oldest usable batches first (FIFO,
 * expired batches excluded). Throws if there is not enough stock.
 */
export async function takeStockFifo(
  tx: Tx,
  session: UserSession,
  args: { warehouseId: string; productId: string; productName: string; quantity: number; onDate: string; type: StockMovementType } & MovementRefs
): Promise<Allocation[]> {
  // Lock this product's batches in the warehouse so concurrent takes queue up
  await tx.$queryRaw`SELECT "id" FROM "stock_batches"
    WHERE "warehouseId" = ${args.warehouseId} AND "productId" = ${args.productId} FOR UPDATE`;
  const batches = await tx.stockBatch.findMany({
    where: { organizationId: session.organizationId, warehouseId: args.warehouseId, productId: args.productId },
  });
  const { allocations, shortfall } = allocateFifo(
    batches.map((b) => ({
      id: b.id,
      quantity: toNumber(b.quantityOnHand),
      roastDate: b.roastDate ? dateColumnToString(b.roastDate) : null,
      bestBefore: b.bestBefore ? dateColumnToString(b.bestBefore) : null,
      receivedOn: dateColumnToString(b.receivedOn),
    })),
    args.quantity,
    args.onDate
  );
  if (shortfall > 0) {
    const available = round3(args.quantity - shortfall);
    throw new UserFacingError(
      `Not enough ${args.productName} in stock: need ${args.quantity}, ${available} usable (expired batches excluded).`
    );
  }

  for (const a of allocations) {
    // Conditional decrement: stock can never go below zero
    const updated = await tx.stockBatch.updateMany({
      where: { id: a.batchId, quantityOnHand: { gte: a.quantity } },
      data: { quantityOnHand: { decrement: a.quantity } },
    });
    if (updated.count !== 1) throw new UserFacingError('Stock changed while saving. Please try again.');
    await tx.stockMovement.create({
      data: {
        organizationId: session.organizationId,
        batchId: a.batchId,
        type: args.type,
        quantity: -a.quantity,
        orderId: args.orderId,
        deliveryRunId: args.deliveryRunId,
        roastRunId: args.roastRunId,
        reason: args.reason,
        createdById: session.userId,
      },
    });
  }
  return allocations;
}

/** Puts stock back into a specific batch (e.g. goods returned from a failed delivery). */
export async function putStock(
  tx: Tx,
  session: UserSession,
  args: { batchId: string; quantity: number; type: StockMovementType } & MovementRefs
) {
  await tx.stockBatch.update({ where: { id: args.batchId }, data: { quantityOnHand: { increment: args.quantity } } });
  await tx.stockMovement.create({
    data: {
      organizationId: session.organizationId,
      batchId: args.batchId,
      type: args.type,
      quantity: args.quantity,
      orderId: args.orderId,
      deliveryRunId: args.deliveryRunId,
      roastRunId: args.roastRunId,
      reason: args.reason,
      createdById: session.userId,
    },
  });
}

export interface IncomingStock extends MovementRefs {
  warehouseId: string;
  productId: string;
  batchNumber: string;
  quantity: number;
  receivedOn: string;
  roastDate?: string | null;
  bestBefore?: string | null;
  supplier?: string | null;
  notes?: string | null;
  type: StockMovementType;
}

/** Adds stock to a batch, creating the batch the first time its number is seen. */
export async function receiveIntoBatch(tx: Tx, session: UserSession, input: IncomingStock) {
  const existing = await tx.stockBatch.findUnique({
    where: {
      warehouseId_productId_batchNumber: {
        warehouseId: input.warehouseId,
        productId: input.productId,
        batchNumber: input.batchNumber,
      },
    },
  });
  const batch =
    existing ??
    (await tx.stockBatch.create({
      data: {
        organizationId: session.organizationId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        batchNumber: input.batchNumber,
        receivedOn: stringToDateColumn(input.receivedOn),
        roastDate: input.roastDate ? stringToDateColumn(input.roastDate) : null,
        bestBefore: input.bestBefore ? stringToDateColumn(input.bestBefore) : null,
        supplier: input.supplier || null,
        notes: input.notes || null,
        roastRunId: input.roastRunId,
        quantityOnHand: 0,
      },
    }));
  await putStock(tx, session, { batchId: batch.id, quantity: input.quantity, type: input.type, reason: input.reason, roastRunId: input.roastRunId });
  return batch;
}

// ---------------------------------------------------------------------------
// Delivery: invoice issuing shared by direct deliveries and delivery-run stops
// ---------------------------------------------------------------------------

export interface DeliveryPaymentInput {
  amount: number;
  method: 'CASH' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'BANK_TRANSFER' | 'CHEQUE';
  reference?: string;
}

interface DeliverableOrder {
  id: string;
  customerId: string;
  orderDate: Date;
  paymentTermsDays: number;
  subtotal: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  total: Prisma.Decimal;
}

/** Checks a delivery date and optional on-the-spot payment against an order. */
export function validateDelivery(order: DeliverableOrder, deliveredOn: string, payment?: DeliveryPaymentInput) {
  const today = todayKigali();
  if (deliveredOn > today) throw new UserFacingError('Delivery date cannot be in the future.');
  if (deliveredOn < dateColumnToString(order.orderDate)) throw new UserFacingError('Delivery date cannot be before the order date.');
  if (payment && payment.amount > toNumber(order.total)) throw new UserFacingError('Payment is more than the invoice total.');
  if (payment && payment.method !== 'CASH' && !payment.reference) {
    throw new UserFacingError('Enter the transaction reference for non-cash payments.');
  }
}

/**
 * Marks a CONFIRMED order delivered and issues its invoice (due after the customer's payment
 * terms), recording any payment collected on delivery. Stock must already have been taken.
 */
export async function issueInvoiceOnDelivery(
  tx: Tx,
  session: UserSession,
  order: DeliverableOrder,
  deliveredOn: string,
  payment?: DeliveryPaymentInput,
  deliveryRunId?: string
) {
  // Guard against two people delivering the same order at once
  const updated = await tx.salesOrder.updateMany({
    where: { id: order.id, status: 'CONFIRMED' },
    data: { status: 'DELIVERED', deliveredById: session.userId, deliveredAt: new Date(), deliveryFailedReason: null },
  });
  if (updated.count !== 1) throw new UserFacingError('Order was changed by someone else. Refresh and try again.');

  const org = await tx.organization.findUniqueOrThrow({ where: { id: session.organizationId } });
  const invoice = await tx.invoice.create({
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
  if (payment) {
    await tx.payment.create({
      data: {
        organizationId: session.organizationId,
        paymentNumber: await nextDocumentNumber(tx, session.organizationId, 'PAYMENT'),
        invoiceId: invoice.id,
        customerId: order.customerId,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference || null,
        paidOn: stringToDateColumn(deliveredOn),
        receivedById: session.userId,
        deliveryRunId,
        notes: 'Collected on delivery',
      },
    });
  }
  return invoice;
}
