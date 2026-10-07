import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { scopedSalespersonId } from '@/lib/tenant';
import { dateColumnToString } from '@/lib/dates';
import type { PipelineDeal } from '@/lib/types';

export const dealInclude = {
  customer: { select: { name: true, area: true, contactPerson: true } },
  salesperson: { select: { name: true } },
  stage: { select: { name: true, probability: true } },
} satisfies Prisma.PipelineDealInclude;

type DealRow = Prisma.PipelineDealGetPayload<{ include: typeof dealInclude }>;

export function toDealDTO(d: DealRow): PipelineDeal {
  return {
    id: d.id,
    title: d.title,
    customerId: d.customerId,
    customer: d.customer.name,
    area: d.customer.area,
    contactPerson: d.customer.contactPerson ?? '',
    potentialValue: d.potentialValue,
    salespersonId: d.salespersonId,
    salesperson: d.salesperson.name,
    stageId: d.stageId,
    stage: d.stage.name,
    lastContact: d.lastContact.toISOString().slice(0, 10),
    nextAction: d.nextAction ?? '',
    followUpDate: dateColumnToString(d.followUpDate),
    probability: d.stage.probability,
    weightedValue: Math.round((d.potentialValue * d.stage.probability) / 100),
    remarks: d.remarks ?? '',
  };
}

/** Pipeline deals visible to the session (sales officers only see their own). */
export async function listDeals(session: UserSession): Promise<PipelineDeal[]> {
  const where: Prisma.PipelineDealWhereInput = { organizationId: session.organizationId };
  const repId = scopedSalespersonId(session);
  if (repId) where.salespersonId = repId;

  const rows = await prisma.pipelineDeal.findMany({ where, include: dealInclude, orderBy: { updatedAt: 'desc' } });
  return rows.map(toDealDTO);
}
