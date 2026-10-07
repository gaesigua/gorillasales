'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession, scopedSalespersonId } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { dealInclude, toDealDTO } from '@/lib/data/deals';
import type { ActionResult, PipelineDeal } from '@/lib/types';

/** Move a deal to another stage. Sales officers may only move their own deals. */
export async function updateDealStage(dealId: string, stageId: string): Promise<ActionResult<PipelineDeal>> {
  return runAction('updateDealStage', async () => {
    const session = await requireSession();
    const { organizationId } = session;
    z.string().parse(dealId);
    z.string().parse(stageId);

    const [stage, deal] = await Promise.all([
      prisma.pipelineStage.findFirst({ where: { id: stageId, organizationId } }),
      prisma.pipelineDeal.findFirst({
        where: { id: dealId, organizationId, salespersonId: scopedSalespersonId(session) },
      }),
    ]);
    if (!stage) throw new UserFacingError('Stage not found.');
    if (!deal) throw new UserFacingError('Deal not found.');

    const updated = await prisma.pipelineDeal.update({
      where: { id: deal.id },
      data: { stageId: stage.id, lastContact: new Date() },
      include: dealInclude,
    });

    await audit(session, 'UPDATE_DEAL_STAGE', 'PipelineDeal', deal.id, { from: deal.stageId, to: stage.id });
    revalidatePath('/', 'layout');
    return toDealDTO(updated);
  });
}
