import 'server-only';

import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { toNumber } from '@/lib/domain/money';
import { customerScope } from '@/lib/tenant';
import type { AppConfig, CommissionRule, CustomerOption, PriceBook, PriceListDTO, RepMonthlyTarget } from '@/lib/types';

export async function getAppConfig(session: UserSession): Promise<AppConfig> {
  const { organizationId } = session;
  const [org, priceLists, reps, lookups, products, stages] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.priceList.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      where: { organizationId, role: 'SALES_OFFICER', isActive: true },
      select: { id: true, name: true, initials: true },
      orderBy: { name: 'asc' },
    }),
    prisma.lookupValue.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    }),
    prisma.product.findMany({ where: { organizationId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.pipelineStage.findMany({ where: { organizationId }, orderBy: { sortOrder: 'asc' } }),
  ]);

  const lookup = (type: 'CUSTOMER_CATEGORY' | 'VISIT_OUTCOME') =>
    lookups.filter((l) => l.type === type).map((l) => ({ id: l.id, label: l.label, sortOrder: l.sortOrder }));

  return {
    settings: {
      name: org.name,
      tin: org.tin ?? '',
      vatRate: toNumber(org.vatRate),
      pricesIncludeVat: org.pricesIncludeVat,
    },
    priceLists,
    salespeople: reps.map((r) => ({ id: r.id, label: r.name, initials: r.initials })),
    customerCategories: lookup('CUSTOMER_CATEGORY'),
    visitOutcomes: lookup('VISIT_OUTCOME'),
    products: products.map((p) => ({
      id: p.id,
      label: p.name,
      sku: p.sku ?? '',
      category: p.category,
      unitPrice: toNumber(p.unitPrice),
      unitOfMeasure: p.unitOfMeasure,
      weightKg: p.weightKg,
    })),
    pipelineStages: stages.map((s) => ({
      id: s.id,
      name: s.name,
      probability: s.probability,
      sortOrder: s.sortOrder,
      color: s.color ?? undefined,
    })),
  };
}

export async function listMonthlyTargets(session: UserSession, filter: { year?: number } = {}): Promise<RepMonthlyTarget[]> {
  const targets = await prisma.monthlyTarget.findMany({
    where: { organizationId: session.organizationId, ...(filter.year !== undefined ? { year: filter.year } : {}) },
    include: { salesperson: { select: { name: true } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
  return targets.map((t) => ({
    id: t.id,
    salespersonId: t.salespersonId,
    repName: t.salesperson.name,
    month: t.month,
    year: t.year,
    targetAmount: toNumber(t.targetAmount),
    targetWeightKg: t.targetWeightKg,
  }));
}

export async function listCommissionRules(session: UserSession): Promise<CommissionRule[]> {
  const rules = await prisma.commissionRule.findMany({
    where: { organizationId: session.organizationId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  return rules.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.ruleType === 'flat' ? 'flat' : 'percentage',
    value: toNumber(r.value),
    thresholdPct: r.thresholdPct,
    description: r.description ?? '',
    sortOrder: r.sortOrder,
  }));
}

export async function listPriceLists(session: UserSession): Promise<PriceListDTO[]> {
  const lists = await prisma.priceList.findMany({
    where: { organizationId: session.organizationId, isActive: true },
    include: { items: true, _count: { select: { customers: true } } },
    orderBy: { name: 'asc' },
  });
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description ?? '',
    items: l.items.map((i) => ({ productId: i.productId, unitPrice: toNumber(i.unitPrice) })),
    customerCount: l._count.customers,
  }));
}

/** Price lists as a lookup table for client-side price previews (the server re-prices on save). */
export async function getPriceBook(session: UserSession): Promise<PriceBook> {
  const lists = await listPriceLists(session);
  return Object.fromEntries(lists.map((l) => [l.id, Object.fromEntries(l.items.map((i) => [i.productId, i.unitPrice]))]));
}

/** Customers the session can sell to, for order and visit forms. */
export async function listCustomerOptions(session: UserSession): Promise<CustomerOption[]> {
  return prisma.customer.findMany({
    where: { ...customerScope(session), status: { not: 'INACTIVE' } },
    select: { id: true, name: true, area: true, category: true, customerType: true, priceListId: true, paymentTermsDays: true },
    orderBy: { name: 'asc' },
  });
}
