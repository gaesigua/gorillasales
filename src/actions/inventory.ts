'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { MANAGER_ROLES, requireRole } from '@/lib/tenant';
import { WAREHOUSE_ROLES } from '@/lib/roles';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { todayKigali } from '@/lib/dates';
import { toNumber } from '@/lib/domain/money';
import { bestBeforeFrom, round3, validateRoast } from '@/lib/domain/inventory';
import { nextDocumentNumber } from '@/lib/documentNumbers';
import { dateString } from '@/lib/orderService';
import { receiveIntoBatch, requireWarehouse, takeStockFifo } from '@/lib/inventoryService';
import type { ActionResult } from '@/lib/types';

const qty = z.coerce.number().positive('Quantity must be more than 0').max(10_000_000);

function notFuture(date: string, label: string) {
  if (date > todayKigali()) throw new UserFacingError(`${label} cannot be in the future.`);
}

// ---------------------------------------------------------------------------
// Receive stock (purchases, opening balances)
// ---------------------------------------------------------------------------

const receiveSchema = z.object({
  warehouseId: z.string().min(1, 'Choose a warehouse'),
  productId: z.string().min(1, 'Choose a product'),
  quantity: qty,
  batchNumber: z.string().trim().min(1, 'Enter a batch/lot number').max(60),
  receivedOn: dateString,
  roastDate: dateString.optional().or(z.literal('')),
  bestBefore: dateString.optional().or(z.literal('')),
  supplier: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export type ReceiveStockInput = z.input<typeof receiveSchema>;

/** Receive goods into a warehouse batch. Best-before defaults from the product's shelf life. */
export async function receiveStock(input: ReceiveStockInput): Promise<ActionResult> {
  return runAction('receiveStock', async () => {
    const session = await requireRole(WAREHOUSE_ROLES);
    const data = receiveSchema.parse(input);
    notFuture(data.receivedOn, 'Receipt date');
    if (data.roastDate) notFuture(data.roastDate, 'Roast date');

    const product = await prisma.product.findFirst({ where: { id: data.productId, organizationId: session.organizationId } });
    if (!product) throw new UserFacingError('Product not found.');
    const bestBefore = data.bestBefore || bestBeforeFrom(data.roastDate || data.receivedOn, product.shelfLifeDays);

    const batch = await prisma.$transaction(async (tx) => {
      await requireWarehouse(tx, session.organizationId, data.warehouseId);
      return receiveIntoBatch(tx, session, {
        warehouseId: data.warehouseId,
        productId: product.id,
        batchNumber: data.batchNumber,
        quantity: data.quantity,
        receivedOn: data.receivedOn,
        roastDate: data.roastDate || null,
        bestBefore,
        supplier: data.supplier,
        notes: data.notes,
        type: 'RECEIPT',
        reason: data.notes || 'Stock received',
      });
    });

    await audit(session, 'RECEIVE_STOCK', 'StockBatch', batch.id, {
      product: product.name,
      batchNumber: data.batchNumber,
      quantity: data.quantity,
    });
    revalidatePath('/', 'layout');
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Stock adjustments (count corrections, damage, samples) — managers only
// ---------------------------------------------------------------------------

const adjustSchema = z.object({
  batchId: z.string().min(1),
  countedQuantity: z.coerce.number().min(0, 'Counted quantity cannot be negative'),
  reason: z.string().trim().min(3, 'Give a reason for the adjustment').max(300),
});

/** Set a batch to the physically counted quantity; the difference is logged with the reason. */
export async function adjustStock(input: z.input<typeof adjustSchema>): Promise<ActionResult> {
  return runAction('adjustStock', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const data = adjustSchema.parse(input);

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "stock_batches" WHERE "id" = ${data.batchId} FOR UPDATE`;
      const batch = await tx.stockBatch.findFirst({
        where: { id: data.batchId, organizationId: session.organizationId },
        include: { product: { select: { name: true } } },
      });
      if (!batch) throw new UserFacingError('Batch not found.');
      const before = toNumber(batch.quantityOnHand);
      const delta = round3(data.countedQuantity - before);
      if (delta === 0) throw new UserFacingError('The counted quantity matches the system; nothing to adjust.');

      await tx.stockBatch.update({ where: { id: batch.id }, data: { quantityOnHand: data.countedQuantity } });
      await tx.stockMovement.create({
        data: {
          organizationId: session.organizationId,
          batchId: batch.id,
          type: 'ADJUSTMENT',
          quantity: delta,
          reason: data.reason,
          createdById: session.userId,
        },
      });
      return { batch, before, delta };
    });

    await audit(session, 'ADJUST_STOCK', 'StockBatch', data.batchId, {
      product: result.batch.product.name,
      batchNumber: result.batch.batchNumber,
      before: result.before,
      after: data.countedQuantity,
      reason: data.reason,
    });
    revalidatePath('/', 'layout');
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Roast runs
// ---------------------------------------------------------------------------

const roastSchema = z.object({
  warehouseId: z.string().min(1, 'Choose a warehouse'),
  roastDate: dateString,
  inputs: z.array(z.object({ productId: z.string().min(1), quantity: qty })).min(1, 'Add the green coffee used').max(10),
  outputs: z.array(z.object({ productId: z.string().min(1), quantity: qty })).min(1, 'Add what was produced').max(20),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export type RoastRunInput = z.input<typeof roastSchema>;

/**
 * Record a roast: consumes green coffee from the oldest batches and creates one new batch per
 * finished product, numbered with the run number and dated with the roast date.
 */
export async function recordRoastRun(input: RoastRunInput): Promise<ActionResult<{ runNumber: string }>> {
  return runAction('recordRoastRun', async () => {
    const session = await requireRole(WAREHOUSE_ROLES);
    const data = roastSchema.parse(input);
    notFuture(data.roastDate, 'Roast date');
    for (const list of [data.inputs, data.outputs]) {
      if (new Set(list.map((l) => l.productId)).size !== list.length) throw new UserFacingError('List each product once.');
    }

    const products = await prisma.product.findMany({
      where: { organizationId: session.organizationId, id: { in: [...data.inputs, ...data.outputs].map((l) => l.productId) } },
    });
    const product = (id: string) => {
      const p = products.find((x) => x.id === id);
      if (!p) throw new UserFacingError('Product not found.');
      return p;
    };
    data.inputs.forEach((l) => {
      if (product(l.productId).kind !== 'GREEN') throw new UserFacingError(`${product(l.productId).name} is not green coffee.`);
    });
    data.outputs.forEach((l) => {
      if (product(l.productId).kind !== 'FINISHED') throw new UserFacingError(`${product(l.productId).name} is not a finished product.`);
      if (!(product(l.productId).weightKg > 0)) throw new UserFacingError(`Set the weight per unit of ${product(l.productId).name} first.`);
    });
    const greenInputKg = round3(data.inputs.reduce((s, l) => s + l.quantity * (product(l.productId).weightKg || 1), 0));
    const outputKg = round3(data.outputs.reduce((s, l) => s + l.quantity * product(l.productId).weightKg, 0));
    const problem = validateRoast(greenInputKg, outputKg);
    if (problem) throw new UserFacingError(problem);

    const run = await prisma.$transaction(async (tx) => {
      await requireWarehouse(tx, session.organizationId, data.warehouseId);
      const runNumber = await nextDocumentNumber(tx, session.organizationId, 'ROAST_RUN');
      const created = await tx.roastRun.create({
        data: {
          organizationId: session.organizationId,
          runNumber,
          warehouseId: data.warehouseId,
          roastDate: new Date(`${data.roastDate}T00:00:00.000Z`),
          greenInputKg,
          outputKg,
          notes: data.notes || null,
          createdById: session.userId,
        },
      });
      for (const l of data.inputs) {
        await takeStockFifo(tx, session, {
          warehouseId: data.warehouseId,
          productId: l.productId,
          productName: product(l.productId).name,
          quantity: l.quantity,
          onDate: data.roastDate,
          type: 'ROAST_INPUT',
          roastRunId: created.id,
        });
      }
      for (const l of data.outputs) {
        await receiveIntoBatch(tx, session, {
          warehouseId: data.warehouseId,
          productId: l.productId,
          batchNumber: runNumber,
          quantity: l.quantity,
          receivedOn: data.roastDate,
          roastDate: data.roastDate,
          bestBefore: bestBeforeFrom(data.roastDate, product(l.productId).shelfLifeDays),
          type: 'ROAST_OUTPUT',
          roastRunId: created.id,
        });
      }
      return created;
    });

    await audit(session, 'RECORD_ROAST_RUN', 'RoastRun', run.id, { runNumber: run.runNumber, greenInputKg, outputKg });
    revalidatePath('/', 'layout');
    return { runNumber: run.runNumber };
  });
}
