'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canViewAllReps, customerScope, requireSession } from '@/lib/tenant';
import { stringToDateColumn } from '@/lib/dates';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { listVisits, toVisitDTO, visitInclude } from '@/lib/data/visits';
import { recordVisit, type CreateVisitInput } from '@/lib/visitService';
import type { ActionResult, VisitLog } from '@/lib/types';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

export type { CreateVisitInput } from '@/lib/visitService';

/**
 * Record a sales visit, plus the order taken during it if any. See recordVisit; offline
 * visits are sent through /api/visits/sync instead, which uses the same service.
 */
export async function createVisitLog(input: CreateVisitInput): Promise<ActionResult<VisitLog>> {
  return runAction('createVisitLog', async () => {
    const session = await requireSession();
    const { visit } = await recordVisit(session, input);
    revalidatePath('/', 'layout');
    return visit;
  });
}

/** Delete a visit log. Managers may delete any; sales officers only their own. */
export async function deleteVisitLog(visitId: string): Promise<ActionResult> {
  return runAction('deleteVisitLog', async () => {
    const session = await requireSession();
    const visit = await prisma.visitLog.findFirst({
      where: {
        id: z.string().parse(visitId),
        organizationId: session.organizationId,
        ...(canViewAllReps(session) ? {} : { salespersonId: session.userId }),
      },
      include: { order: { select: { id: true, orderNumber: true, status: true } } },
    });
    if (!visit) throw new UserFacingError('Visit not found.');
    if (visit.order && visit.order.status !== 'CANCELLED') {
      throw new UserFacingError(`This visit has order ${visit.order.orderNumber}. Cancel the order before deleting the visit.`);
    }

    await prisma.visitLog.delete({ where: { id: visit.id } });
    await audit(session, 'DELETE_VISIT_LOG', 'VisitLog', visit.id, {
      customerId: visit.customerId,
      dateOfVisit: visit.dateOfVisit,
      orderId: visit.order?.id,
    });
    revalidatePath('/', 'layout');
    return undefined;
  });
}

/** Most recent visits to one customer (for the customer detail drawer). */
export async function getCustomerVisits(customerId: string): Promise<ActionResult<VisitLog[]>> {
  return runAction('getCustomerVisits', async () => {
    const session = await requireSession();
    const customer = await prisma.customer.findFirst({
      where: { id: z.string().parse(customerId), ...customerScope(session) },
      select: { id: true },
    });
    if (!customer) throw new UserFacingError('Customer not found.');
    return listVisits(session, { customerId: customer.id, limit: 50 });
  });
}

const MAX_REPORT_DAYS = 366;

/** Visits in a date range (inclusive), for on-demand reports. Scoped like listVisits. */
export async function getVisitsForPeriod(from: string, to: string): Promise<ActionResult<VisitLog[]>> {
  return runAction('getVisitsForPeriod', async () => {
    const session = await requireSession();
    const start = stringToDateColumn(dateString.parse(from));
    const end = stringToDateColumn(dateString.parse(to));
    const days = (end.getTime() - start.getTime()) / 86400000;
    if (days < 0 || days > MAX_REPORT_DAYS) throw new UserFacingError('Choose a period of at most one year.');
    return listVisits(session, { from, to });
  });
}
