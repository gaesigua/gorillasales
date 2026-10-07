import 'server-only';

import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import type { AppConfig, CommissionRule, RepMonthlyTarget } from '@/lib/types';

export async function getAppConfig(session: UserSession): Promise<AppConfig> {
  const { organizationId } = session;
  const [reps, lookups, products, stages] = await Promise.all([
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
    salespeople: reps.map((r) => ({ id: r.id, label: r.name, initials: r.initials })),
    customerCategories: lookup('CUSTOMER_CATEGORY'),
    visitOutcomes: lookup('VISIT_OUTCOME'),
    products: products.map((p) => ({
      id: p.id,
      label: p.name,
      sku: p.sku ?? '',
      category: p.category,
      unitPrice: p.unitPrice,
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
    targetAmount: t.targetAmount,
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
    value: r.value,
    thresholdPct: r.thresholdPct,
    description: r.description ?? '',
    sortOrder: r.sortOrder,
  }));
}
