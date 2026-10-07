import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { canManageWarehouse } from '@/lib/roles';
import { dateColumnToString, stringToDateColumn } from '@/lib/dates';
import { toNumber } from '@/lib/domain/money';
import { allocateFifo, round3 } from '@/lib/domain/inventory';
import type { DeliveryRunDTO, PaymentMethodValue, StockBatchDTO } from '@/lib/types';
import { orderInclude, toOrderDTO } from './orders';
import { listBatches } from './inventory';

/** Drivers see only their own runs; warehouse staff and managers see all. */
export function deliveryRunScope(session: UserSession): Prisma.DeliveryRunWhereInput {
  return {
    organizationId: session.organizationId,
    ...(canManageWarehouse(session.role) ? {} : { driverId: session.userId }),
  };
}

export const runInclude = {
  warehouse: { select: { name: true } },
  driver: { select: { name: true } },
  stops: { include: orderInclude, orderBy: { orderNumber: 'asc' } },
  movements: {
    where: { type: { in: ['DISPATCH', 'RETURN'] } },
    include: { batch: { select: { batchNumber: true, product: { select: { name: true } } } } },
  },
  payments: { select: { method: true, amount: true } },
} satisfies Prisma.DeliveryRunInclude;

type RunRow = Prisma.DeliveryRunGetPayload<{ include: typeof runInclude }>;

/**
 * @param batches usable stock, needed to suggest picking for PLANNED runs
 */
export function toRunDTO(run: RunRow, batches: StockBatchDTO[], onDate: string): DeliveryRunDTO {
  const stops = run.stops.map(toOrderDTO);
  let picking: DeliveryRunDTO['picking'];

  if (run.status === 'PLANNED') {
    const need = new Map<string, { productName: string; quantity: number }>();
    stops.forEach((o) =>
      o.lines.forEach((l) => {
        const n = need.get(l.productId) ?? { productName: l.productName, quantity: 0 };
        n.quantity = round3(n.quantity + l.quantity);
        need.set(l.productId, n);
      })
    );
    picking = [...need.entries()].map(([productId, n]) => {
      const candidates = batches.filter((b) => b.productId === productId && b.warehouseId === run.warehouseId);
      const { allocations, shortfall } = allocateFifo(
        candidates.map((b) => ({ id: b.id, quantity: b.quantity, roastDate: b.roastDate || null, bestBefore: b.bestBefore || null, receivedOn: b.receivedOn })),
        n.quantity,
        onDate
      );
      return {
        productName: n.productName,
        quantity: n.quantity,
        batches: allocations.map((a) => ({
          batchNumber: candidates.find((b) => b.id === a.batchId)?.batchNumber ?? '',
          quantity: a.quantity,
        })),
        short: shortfall,
      };
    });
  } else {
    // What actually left (and came back to) the warehouse, per batch
    const byBatch = new Map<string, { productName: string; batchNumber: string; quantity: number }>();
    run.movements.forEach((m) => {
      const key = `${m.batch.product.name}|${m.batch.batchNumber}`;
      const e = byBatch.get(key) ?? { productName: m.batch.product.name, batchNumber: m.batch.batchNumber, quantity: 0 };
      e.quantity = round3(e.quantity - toNumber(m.quantity));
      byBatch.set(key, e);
    });
    const byProduct = new Map<string, DeliveryRunDTO['picking'][number]>();
    byBatch.forEach((b) => {
      const p = byProduct.get(b.productName) ?? { productName: b.productName, quantity: 0, batches: [], short: 0 };
      p.quantity = round3(p.quantity + b.quantity);
      p.batches.push({ batchNumber: b.batchNumber, quantity: b.quantity });
      byProduct.set(b.productName, p);
    });
    picking = [...byProduct.values()];
  }

  const collections = new Map<PaymentMethodValue, number>();
  run.payments.forEach((p) => collections.set(p.method, (collections.get(p.method) ?? 0) + toNumber(p.amount)));

  return {
    id: run.id,
    runNumber: run.runNumber,
    runDate: dateColumnToString(run.runDate),
    status: run.status,
    warehouseId: run.warehouseId,
    warehouseName: run.warehouse.name,
    driverId: run.driverId,
    driverName: run.driver.name,
    vehicle: run.vehicle ?? '',
    notes: run.notes ?? '',
    stops,
    picking: picking.sort((a, b) => a.productName.localeCompare(b.productName)),
    collections: [...collections.entries()].map(([method, amount]) => ({ method, amount: Math.round(amount * 100) / 100 })),
  };
}

export async function listDeliveryRuns(session: UserSession, today: string, filter: { from?: string } = {}): Promise<DeliveryRunDTO[]> {
  const [rows, batches] = await Promise.all([
    prisma.deliveryRun.findMany({
      where: {
        ...deliveryRunScope(session),
        ...(filter.from ? { OR: [{ runDate: { gte: stringToDateColumn(filter.from) } }, { status: { in: ['PLANNED', 'DISPATCHED'] } }] } : {}),
      },
      include: runInclude,
      orderBy: [{ runDate: 'desc' }, { createdAt: 'desc' }],
    }),
    listBatches(session, today),
  ]);
  const usable = batches.filter((b) => !b.expired);
  return rows.map((r) => toRunDTO(r, usable, today));
}
