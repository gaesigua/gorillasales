import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { dateColumnToString, stringToDateColumn } from '@/lib/dates';
import { toNumber } from '@/lib/domain/money';
import { ageInDays, orderCoverage, roastYieldPct, round3 } from '@/lib/domain/inventory';
import type { Order, ProductStock, RoastRunDTO, StockBatchDTO, StockMovementDTO } from '@/lib/types';

/** Open orders still waiting for stock to leave the warehouse (not yet dispatched or delivered). */
const awaitingStock: Prisma.SalesOrderWhereInput = {
  status: { in: ['PENDING_APPROVAL', 'CONFIRMED'] },
  OR: [{ deliveryRunId: null }, { deliveryRun: { status: 'PLANNED' } }],
};

export async function listBatches(
  session: UserSession,
  today: string,
  filter: { productId?: string; warehouseId?: string; includeEmpty?: boolean } = {}
): Promise<StockBatchDTO[]> {
  const rows = await prisma.stockBatch.findMany({
    where: {
      organizationId: session.organizationId,
      warehouse: { isActive: true },
      ...(filter.productId ? { productId: filter.productId } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.includeEmpty ? {} : { quantityOnHand: { gt: 0 } }),
    },
    include: { warehouse: { select: { name: true } }, product: { select: { name: true, unitOfMeasure: true } } },
    orderBy: [{ product: { name: 'asc' } }, { roastDate: 'asc' }, { receivedOn: 'asc' }],
  });
  const todayCol = stringToDateColumn(today);
  return rows.map((b) => {
    const roastDate = b.roastDate ? dateColumnToString(b.roastDate) : '';
    const receivedOn = dateColumnToString(b.receivedOn);
    return {
      id: b.id,
      warehouseId: b.warehouseId,
      warehouseName: b.warehouse.name,
      productId: b.productId,
      productName: b.product.name,
      unitOfMeasure: b.product.unitOfMeasure,
      batchNumber: b.batchNumber,
      roastDate,
      bestBefore: b.bestBefore ? dateColumnToString(b.bestBefore) : '',
      receivedOn,
      quantity: toNumber(b.quantityOnHand),
      supplier: b.supplier ?? '',
      ageDays: ageInDays(roastDate || receivedOn, today),
      expired: !!b.bestBefore && b.bestBefore < todayCol,
    };
  });
}

/** Usable (non-expired) stock per product across active warehouses. */
export async function getUsableStock(organizationId: string, today: string): Promise<Map<string, number>> {
  const rows = await prisma.stockBatch.groupBy({
    by: ['productId'],
    where: {
      organizationId,
      warehouse: { isActive: true },
      quantityOnHand: { gt: 0 },
      OR: [{ bestBefore: null }, { bestBefore: { gte: stringToDateColumn(today) } }],
    },
    _sum: { quantityOnHand: true },
  });
  return new Map(rows.map((r) => [r.productId, toNumber(r._sum.quantityOnHand)]));
}

export async function getProductStock(session: UserSession, today: string): Promise<ProductStock[]> {
  const { organizationId } = session;
  const [products, batches, usable, reserved] = await Promise.all([
    prisma.product.findMany({ where: { organizationId, isActive: true }, orderBy: { name: 'asc' } }),
    listBatches(session, today),
    getUsableStock(organizationId, today),
    prisma.salesOrderLine.groupBy({
      by: ['productId'],
      where: { order: { organizationId, ...awaitingStock } },
      _sum: { quantity: true },
    }),
  ]);
  return products.map((p) => {
    const onHand = round3(usable.get(p.id) ?? 0);
    const res = round3(toNumber(reserved.find((r) => r.productId === p.id)?._sum.quantity));
    return {
      productId: p.id,
      productName: p.name,
      kind: p.kind,
      unitOfMeasure: p.unitOfMeasure,
      onHand,
      expired: round3(batches.filter((b) => b.productId === p.id && b.expired).reduce((s, b) => s + b.quantity, 0)),
      reserved: res,
      available: round3(onHand - res),
    };
  });
}

/**
 * Marks which open orders current stock cannot cover, serving the oldest orders first.
 * Orders already loaded on a dispatched run have their stock and are skipped.
 */
export async function attachStockCoverage(organizationId: string, today: string, orders: Order[]): Promise<Order[]> {
  if (!orders.some((o) => o.status === 'CONFIRMED' || o.status === 'PENDING_APPROVAL')) return orders;

  // Priority is across every open order in the organization (not just those shown), oldest first
  const [open, usable] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { organizationId, ...awaitingStock },
      select: { id: true, lines: { select: { productId: true, quantity: true } } },
      orderBy: [{ orderDate: 'asc' }, { orderNumber: 'asc' }],
    }),
    getUsableStock(organizationId, today),
  ]);
  const coverage = orderCoverage(
    open.map((o) => ({ id: o.id, lines: o.lines.map((l) => ({ productId: l.productId, quantity: toNumber(l.quantity) })) })),
    usable
  );
  const names = new Map(orders.flatMap((o) => o.lines.map((l) => [l.productId, l.productName] as const)));
  return orders.map((o) => {
    const c = coverage.get(o.id);
    return c ? { ...o, stockShort: c.short.map((s) => ({ productName: names.get(s.productId) ?? '', missing: s.missing })) } : o;
  });
}

export async function listMovements(session: UserSession, limit = 300): Promise<StockMovementDTO[]> {
  const rows = await prisma.stockMovement.findMany({
    where: { organizationId: session.organizationId },
    include: {
      batch: { select: { batchNumber: true, product: { select: { name: true } }, warehouse: { select: { name: true } } } },
      order: { select: { orderNumber: true } },
      deliveryRun: { select: { runNumber: true } },
      roastRun: { select: { runNumber: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((m) => ({
    id: m.id,
    createdAt: m.createdAt.toISOString(),
    type: m.type,
    quantity: toNumber(m.quantity),
    productName: m.batch.product.name,
    batchNumber: m.batch.batchNumber,
    warehouseName: m.batch.warehouse.name,
    reference: [m.order?.orderNumber, m.deliveryRun?.runNumber, m.roastRun?.runNumber].filter(Boolean).join(' · '),
    reason: m.reason ?? '',
    by: m.createdBy.name,
  }));
}

export async function listRoastRuns(session: UserSession, limit = 100): Promise<RoastRunDTO[]> {
  const rows = await prisma.roastRun.findMany({
    where: { organizationId: session.organizationId },
    include: {
      warehouse: { select: { name: true } },
      outputs: { include: { product: { select: { name: true } }, movements: { where: { type: 'ROAST_OUTPUT' } } } },
      movements: {
        where: { type: 'ROAST_INPUT' },
        include: { batch: { select: { batchNumber: true, product: { select: { name: true } } } } },
      },
    },
    orderBy: [{ roastDate: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
    select: { id: true, name: true },
  });
  return rows.map((r) => {
    const greenInputKg = toNumber(r.greenInputKg);
    const outputKg = toNumber(r.outputKg);
    return {
      id: r.id,
      runNumber: r.runNumber,
      roastDate: dateColumnToString(r.roastDate),
      warehouseName: r.warehouse.name,
      greenInputKg,
      outputKg,
      yieldPct: roastYieldPct(greenInputKg, outputKg),
      outputs: r.outputs.map((b) => ({
        productName: b.product.name,
        quantity: round3(b.movements.reduce((s, m) => s + toNumber(m.quantity), 0)),
      })),
      inputs: r.movements.map((m) => ({
        productName: m.batch.product.name,
        batchNumber: m.batch.batchNumber,
        quantity: -toNumber(m.quantity),
      })),
      notes: r.notes ?? '',
      by: users.find((u) => u.id === r.createdById)?.name ?? '',
    };
  });
}
