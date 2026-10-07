'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { MANAGER_ROLES, requireRole } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { getAppConfig, listCommissionRules, listMonthlyTargets, listPriceLists, listWarehouses } from '@/lib/data/config';
import { toNumber } from '@/lib/domain/money';
import type {
  WarehouseDTO,
  ActionResult,
  CommissionRule,
  LookupItem,
  OrganizationSettings,
  PriceListDTO,
  PipelineStage,
  ProductItem,
  RepMonthlyTarget,
} from '@/lib/types';

const label = z.string().trim().min(1, 'Name cannot be empty').max(120);

function uniqueBy<T>(items: T[], key: (t: T) => string, message: string) {
  const seen = new Set<string>();
  for (const item of items) {
    const k = key(item).toLowerCase();
    if (seen.has(k)) throw new UserFacingError(message);
    seen.add(k);
  }
}

// ---------------------------------------------------------------------------
// Lookup lists (customer categories, visit outcomes)
// ---------------------------------------------------------------------------

const lookupListSchema = z.array(z.object({ id: z.string(), label }));

export async function saveLookupList(
  type: 'CUSTOMER_CATEGORY' | 'VISIT_OUTCOME',
  input: { id: string; label: string }[]
): Promise<ActionResult<LookupItem[]>> {
  return runAction('saveLookupList', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const { organizationId } = session;
    z.enum(['CUSTOMER_CATEGORY', 'VISIT_OUTCOME']).parse(type);
    const items = lookupListSchema.parse(input);
    uniqueBy(items, (i) => i.label, 'Each name must be unique.');

    await prisma.$transaction(async (tx) => {
      const existing = await tx.lookupValue.findMany({ where: { organizationId, type } });
      const byId = new Map(existing.map((e) => [e.id, e]));
      const keep = new Set(items.filter((i) => byId.has(i.id)).map((i) => i.id));

      await tx.lookupValue.deleteMany({ where: { organizationId, type, id: { notIn: [...keep] } } });

      for (const [index, item] of items.entries()) {
        const prev = byId.get(item.id);
        if (!prev) {
          await tx.lookupValue.create({ data: { organizationId, type, label: item.label, sortOrder: index + 1 } });
          continue;
        }
        if (prev.label === item.label && prev.sortOrder === index + 1) continue;
        await tx.lookupValue.update({ where: { id: prev.id }, data: { label: item.label, sortOrder: index + 1 } });
        // Renames carry through to existing records, which store the label as text
        if (prev.label !== item.label) {
          if (type === 'CUSTOMER_CATEGORY') {
            await tx.customer.updateMany({ where: { organizationId, category: prev.label }, data: { category: item.label } });
          } else {
            await tx.visitLog.updateMany({
              where: { organizationId, visitOutcome: prev.label },
              data: { visitOutcome: item.label },
            });
          }
        }
      }
    });

    await audit(session, 'UPDATE_LOOKUP_LIST', 'LookupValue', null, { type, labels: items.map((i) => i.label) });
    revalidatePath('/', 'layout');
    const config = await getAppConfig(session);
    return type === 'CUSTOMER_CATEGORY' ? config.customerCategories : config.visitOutcomes;
  });
}

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

const stageListSchema = z.array(
  z.object({
    id: z.string(),
    name: label,
    probability: z.coerce.number().min(0).max(100),
    color: z.string().max(20).optional(),
  })
);

export async function savePipelineStages(
  input: { id: string; name: string; probability: number; color?: string }[]
): Promise<ActionResult<PipelineStage[]>> {
  return runAction('savePipelineStages', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const { organizationId } = session;
    const items = stageListSchema.parse(input);
    uniqueBy(items, (i) => i.name, 'Each stage name must be unique.');

    await prisma.$transaction(async (tx) => {
      const existing = await tx.pipelineStage.findMany({
        where: { organizationId },
        include: { _count: { select: { deals: true } } },
      });
      const byId = new Map(existing.map((e) => [e.id, e]));
      const keep = new Set(items.filter((i) => byId.has(i.id)).map((i) => i.id));

      const removed = existing.filter((e) => !keep.has(e.id));
      const inUse = removed.find((e) => e._count.deals > 0);
      if (inUse) {
        throw new UserFacingError(
          `Stage "${inUse.name}" still has ${inUse._count.deals} deal(s). Move them to another stage first.`
        );
      }
      await tx.pipelineStage.deleteMany({ where: { organizationId, id: { in: removed.map((r) => r.id) } } });

      for (const [index, item] of items.entries()) {
        const data = { name: item.name, probability: item.probability, sortOrder: index + 1, color: item.color };
        if (byId.has(item.id)) await tx.pipelineStage.update({ where: { id: item.id }, data });
        else await tx.pipelineStage.create({ data: { organizationId, ...data } });
      }
    });

    await audit(session, 'UPDATE_PIPELINE_STAGES', 'PipelineStage', null, { stages: items });
    revalidatePath('/', 'layout');
    return (await getAppConfig(session)).pipelineStages;
  });
}

// ---------------------------------------------------------------------------
// Products (removing a product deactivates it; past visits keep their product)
// ---------------------------------------------------------------------------

const productListSchema = z.array(
  z.object({
    id: z.string(),
    label,
    sku: z.string().trim().max(60).default(''),
    category: z.string().trim().max(60).default(''),
    unitPrice: z.coerce.number().min(0),
    unitOfMeasure: z.string().trim().min(1).max(20),
    weightKg: z.coerce.number().min(0),
    kind: z.enum(['FINISHED', 'GREEN']).default('FINISHED'),
    shelfLifeDays: z.coerce.number().int().min(1).max(3650).nullable().default(null),
  })
);

export async function saveProducts(input: ProductItem[]): Promise<ActionResult<ProductItem[]>> {
  return runAction('saveProducts', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const { organizationId } = session;
    const items = productListSchema.parse(input);
    uniqueBy(items, (i) => i.label, 'Each product name must be unique.');

    await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findMany({ where: { organizationId, isActive: true }, select: { id: true } });
      const existingIds = new Set(existing.map((e) => e.id));
      const keep = new Set(items.filter((i) => existingIds.has(i.id)).map((i) => i.id));

      await tx.product.updateMany({
        where: { organizationId, isActive: true, id: { notIn: [...keep] } },
        data: { isActive: false },
      });
      for (const item of items) {
        const data = {
          name: item.label,
          sku: item.sku || null,
          category: item.category || 'Coffee',
          unitPrice: item.unitPrice,
          unitOfMeasure: item.unitOfMeasure,
          weightKg: item.weightKg,
          kind: item.kind,
          shelfLifeDays: item.shelfLifeDays,
        };
        if (keep.has(item.id)) await tx.product.update({ where: { id: item.id }, data });
        else await tx.product.create({ data: { organizationId, ...data } });
      }
    });

    await audit(session, 'UPDATE_PRODUCTS', 'Product', null, { products: items.map((i) => i.label) });
    revalidatePath('/', 'layout');
    return (await getAppConfig(session)).products;
  });
}

// ---------------------------------------------------------------------------
// Warehouses (removing one deactivates it; it must be empty first)
// ---------------------------------------------------------------------------

const warehouseListSchema = z
  .array(
    z.object({
      id: z.string(),
      name: label,
      address: z.string().trim().max(200).default(''),
      isDefault: z.boolean().default(false),
    })
  )
  .min(1, 'Keep at least one warehouse.');

export async function saveWarehouses(input: WarehouseDTO[]): Promise<ActionResult<WarehouseDTO[]>> {
  return runAction('saveWarehouses', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const { organizationId } = session;
    const items = warehouseListSchema.parse(input);
    uniqueBy(items, (i) => i.name, 'Each warehouse name must be unique.');
    if (items.filter((i) => i.isDefault).length !== 1) throw new UserFacingError('Choose exactly one default warehouse.');

    await prisma.$transaction(async (tx) => {
      const existing = await tx.warehouse.findMany({ where: { organizationId, isActive: true } });
      const keep = new Set(items.filter((i) => existing.some((e) => e.id === i.id)).map((i) => i.id));
      const removed = existing.filter((e) => !keep.has(e.id));
      for (const w of removed) {
        const stock = await tx.stockBatch.aggregate({ where: { warehouseId: w.id }, _sum: { quantityOnHand: true } });
        if (toNumber(stock._sum.quantityOnHand) > 0) {
          throw new UserFacingError(`"${w.name}" still holds stock. Move or adjust it to zero before removing the warehouse.`);
        }
        const openRuns = await tx.deliveryRun.count({ where: { warehouseId: w.id, status: { in: ['PLANNED', 'DISPATCHED'] } } });
        if (openRuns) throw new UserFacingError(`"${w.name}" has open delivery runs.`);
        // Free the name for reuse
        await tx.warehouse.update({ where: { id: w.id }, data: { isActive: false, isDefault: false, name: `${w.name} (closed ${w.id})` } });
      }
      // Clear the default first so the new default never coexists with the old one
      await tx.warehouse.updateMany({ where: { organizationId }, data: { isDefault: false } });
      for (const item of items) {
        const data = { name: item.name, address: item.address || null, isDefault: item.isDefault };
        if (keep.has(item.id)) await tx.warehouse.update({ where: { id: item.id }, data });
        else await tx.warehouse.create({ data: { organizationId, ...data } });
      }
    });

    await audit(session, 'UPDATE_WAREHOUSES', 'Warehouse', null, { warehouses: items.map((i) => i.name) });
    revalidatePath('/', 'layout');
    return listWarehouses(session);
  });
}

// ---------------------------------------------------------------------------
// Monthly targets
// ---------------------------------------------------------------------------

const targetListSchema = z.array(
  z.object({
    id: z.string(),
    salespersonId: z.string().min(1, 'Select a rep'),
    month: z.coerce.number().int().min(0).max(11),
    year: z.coerce.number().int().min(2000).max(2100),
    targetAmount: z.coerce.number().positive(),
    targetWeightKg: z.coerce.number().min(0),
  })
);

export async function saveMonthlyTargets(input: RepMonthlyTarget[]): Promise<ActionResult<RepMonthlyTarget[]>> {
  return runAction('saveMonthlyTargets', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const { organizationId } = session;
    const items = targetListSchema.parse(input);
    uniqueBy(items, (i) => `${i.salespersonId}:${i.year}:${i.month}`, 'A rep can only have one target per month.');

    const repIds = [...new Set(items.map((i) => i.salespersonId))];
    const repCount = await prisma.user.count({ where: { organizationId, id: { in: repIds } } });
    if (repCount !== repIds.length) throw new UserFacingError('Unknown salesperson.');

    await prisma.$transaction(async (tx) => {
      const existing = await tx.monthlyTarget.findMany({ where: { organizationId }, select: { id: true } });
      const existingIds = new Set(existing.map((e) => e.id));
      const keep = new Set(items.filter((i) => existingIds.has(i.id)).map((i) => i.id));

      await tx.monthlyTarget.deleteMany({ where: { organizationId, id: { notIn: [...keep] } } });
      for (const item of items) {
        const data = {
          salespersonId: item.salespersonId,
          month: item.month,
          year: item.year,
          targetAmount: item.targetAmount,
          targetWeightKg: item.targetWeightKg,
        };
        if (keep.has(item.id)) await tx.monthlyTarget.update({ where: { id: item.id }, data });
        else await tx.monthlyTarget.create({ data: { organizationId, ...data } });
      }
    });

    await audit(session, 'UPDATE_MONTHLY_TARGETS', 'MonthlyTarget', null, { count: items.length });
    revalidatePath('/', 'layout');
    return listMonthlyTargets(session);
  });
}

// ---------------------------------------------------------------------------
// Commission rules (removed rules are deactivated, not deleted)
// ---------------------------------------------------------------------------

const ruleListSchema = z.array(
  z.object({
    id: z.string(),
    name: label,
    type: z.enum(['percentage', 'flat']),
    value: z.coerce.number().min(0),
    thresholdPct: z.coerce.number().min(0).max(1000),
    description: z.string().trim().max(500).default(''),
  })
);

export async function saveCommissionRules(input: CommissionRule[]): Promise<ActionResult<CommissionRule[]>> {
  return runAction('saveCommissionRules', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const { organizationId } = session;
    const items = ruleListSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.commissionRule.findMany({
        where: { organizationId, isActive: true },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((e) => e.id));
      const keep = new Set(items.filter((i) => existingIds.has(i.id)).map((i) => i.id));

      await tx.commissionRule.updateMany({
        where: { organizationId, isActive: true, id: { notIn: [...keep] } },
        data: { isActive: false },
      });
      for (const [index, item] of items.entries()) {
        const data = {
          name: item.name,
          ruleType: item.type,
          value: item.value,
          thresholdPct: item.thresholdPct,
          description: item.description || null,
          sortOrder: index + 1,
        };
        if (keep.has(item.id)) await tx.commissionRule.update({ where: { id: item.id }, data });
        else await tx.commissionRule.create({ data: { organizationId, ...data } });
      }
    });

    await audit(session, 'UPDATE_COMMISSION_RULES', 'CommissionRule', null, { rules: items });
    revalidatePath('/', 'layout');
    return listCommissionRules(session);
  });
}

// ---------------------------------------------------------------------------
// Price lists
// ---------------------------------------------------------------------------

const priceListSchema = z.object({
  id: z.string().optional(),
  name: label,
  description: z.string().trim().max(300).default(''),
  items: z.array(z.object({ productId: z.string().min(1), unitPrice: z.coerce.number().min(0) })).max(500),
});

export type PriceListInput = z.input<typeof priceListSchema>;

/** Create or update a price list and replace its product prices. */
export async function savePriceList(input: PriceListInput): Promise<ActionResult<PriceListDTO[]>> {
  return runAction('savePriceList', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const { organizationId } = session;
    const data = priceListSchema.parse(input);
    uniqueBy(data.items, (i) => i.productId, 'Each product can only be priced once per list.');

    const productCount = await prisma.product.count({
      where: { organizationId, id: { in: data.items.map((i) => i.productId) } },
    });
    if (productCount !== data.items.length) throw new UserFacingError('Unknown product in price list.');

    const id = await prisma.$transaction(async (tx) => {
      const existing = data.id
        ? await tx.priceList.findFirst({ where: { id: data.id, organizationId, isActive: true } })
        : null;
      if (data.id && !existing) throw new UserFacingError('Price list not found.');
      const list = existing
        ? await tx.priceList.update({ where: { id: existing.id }, data: { name: data.name, description: data.description || null } })
        : await tx.priceList.create({ data: { organizationId, name: data.name, description: data.description || null } });
      await tx.priceListItem.deleteMany({ where: { priceListId: list.id } });
      await tx.priceListItem.createMany({
        data: data.items.map((i) => ({ priceListId: list.id, productId: i.productId, unitPrice: i.unitPrice })),
      });
      return list.id;
    });

    await audit(session, data.id ? 'UPDATE_PRICE_LIST' : 'CREATE_PRICE_LIST', 'PriceList', id, {
      name: data.name,
      items: data.items,
    });
    revalidatePath('/', 'layout');
    return listPriceLists(session);
  });
}

/** Retire a price list; its customers fall back to product list prices. */
export async function deletePriceList(priceListId: string): Promise<ActionResult<PriceListDTO[]>> {
  return runAction('deletePriceList', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const list = await prisma.priceList.findFirst({
      where: { id: z.string().parse(priceListId), organizationId: session.organizationId, isActive: true },
    });
    if (!list) throw new UserFacingError('Price list not found.');

    // Free the name so a new list can reuse it
    await prisma.$transaction([
      prisma.customer.updateMany({ where: { priceListId: list.id }, data: { priceListId: null } }),
      prisma.priceList.update({ where: { id: list.id }, data: { isActive: false, name: `${list.name} (retired ${list.id})` } }),
    ]);
    await audit(session, 'DELETE_PRICE_LIST', 'PriceList', list.id, { name: list.name });
    revalidatePath('/', 'layout');
    return listPriceLists(session);
  });
}

// ---------------------------------------------------------------------------
// Organization tax settings (admins only)
// ---------------------------------------------------------------------------

const orgSettingsSchema = z.object({
  tin: z
    .string()
    .trim()
    .regex(/^\d{9}$/, 'TIN must be 9 digits')
    .or(z.literal('')),
  vatRate: z.coerce.number().min(0).max(100),
  pricesIncludeVat: z.boolean(),
});

export async function saveOrganizationSettings(
  input: z.input<typeof orgSettingsSchema>
): Promise<ActionResult<OrganizationSettings>> {
  return runAction('saveOrganizationSettings', async () => {
    const session = await requireRole(['ADMIN']);
    const data = orgSettingsSchema.parse(input);
    const before = await prisma.organization.findUniqueOrThrow({ where: { id: session.organizationId } });
    await prisma.organization.update({
      where: { id: session.organizationId },
      data: { tin: data.tin || null, vatRate: data.vatRate, pricesIncludeVat: data.pricesIncludeVat },
    });
    await audit(session, 'UPDATE_ORG_SETTINGS', 'Organization', session.organizationId, {
      before: { tin: before.tin, vatRate: before.vatRate.toString(), pricesIncludeVat: before.pricesIncludeVat },
      after: data,
    });
    revalidatePath('/', 'layout');
    return (await getAppConfig(session)).settings;
  });
}
