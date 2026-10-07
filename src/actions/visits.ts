'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canViewAllReps, customerScope, requireSession, scopedSalespersonId } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { stringToDateColumn, todayKigali } from '@/lib/dates';
import { listVisits, toVisitDTO, visitInclude } from '@/lib/data/visits';
import { orderLinesSchema, placeOrder } from '@/lib/orderService';
import type { ActionResult, VisitLog } from '@/lib/types';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

const createVisitSchema = z.object({
  salespersonId: z.string().optional(),
  customerId: z.string().min(1, 'Select a customer'),
  dateOfVisit: dateString,
  visitOutcome: z.string().trim().min(1, 'Select an outcome').max(120),
  nextFollowUpDate: dateString.optional().or(z.literal('')),
  remarks: z.string().trim().max(2000).optional(),
  // Products ordered during the visit; omitted or empty when no order was taken
  orderLines: orderLinesSchema.optional(),
  orderNotes: z.string().trim().max(2000).optional(),
});

export type CreateVisitInput = z.input<typeof createVisitSchema>;

/**
 * Record a sales visit, plus the order taken during it if any. Sales officers always log as
 * themselves; managers may log on behalf of a rep in their organization.
 */
export async function createVisitLog(input: CreateVisitInput): Promise<ActionResult<VisitLog>> {
  return runAction('createVisitLog', async () => {
    const session = await requireSession();
    const { organizationId } = session;
    const data = createVisitSchema.parse({ ...input, orderLines: input.orderLines?.length ? input.orderLines : undefined });
    if (data.dateOfVisit > todayKigali()) throw new UserFacingError('Visit date cannot be in the future.');

    const salespersonId = scopedSalespersonId(session, data.salespersonId) || session.userId;
    const [rep, customer] = await Promise.all([
      prisma.user.findFirst({ where: { id: salespersonId, organizationId }, select: { id: true } }),
      prisma.customer.findFirst({ where: { id: data.customerId, ...customerScope(session) }, select: { id: true } }),
    ]);
    if (!rep) throw new UserFacingError('Salesperson not found.');
    if (!customer) throw new UserFacingError('Customer not found.');

    const { visitId, order } = await prisma.$transaction(async (tx) => {
      const visit = await tx.visitLog.create({
        data: {
          organizationId,
          salespersonId,
          customerId: data.customerId,
          dateOfVisit: stringToDateColumn(data.dateOfVisit),
          visitOutcome: data.visitOutcome,
          nextFollowUpDate: data.nextFollowUpDate ? stringToDateColumn(data.nextFollowUpDate) : null,
          remarks: data.remarks || null,
        },
      });
      const placed = data.orderLines
        ? await placeOrder(
            tx,
            session,
            {
              customerId: data.customerId,
              salespersonId,
              orderDate: data.dateOfVisit,
              lines: data.orderLines,
              notes: data.orderNotes,
            },
            visit.id
          )
        : null;
      return { visitId: visit.id, order: placed };
    });

    await audit(session, 'CREATE_VISIT_LOG', 'VisitLog', visitId, { customerId: data.customerId, orderId: order?.id });
    if (order) {
      await audit(session, 'CREATE_ORDER', 'SalesOrder', order.id, {
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        holdReason: order.holdReason,
        visitLogId: visitId,
      });
    }
    revalidatePath('/', 'layout');
    const visit = await prisma.visitLog.findUniqueOrThrow({ where: { id: visitId }, include: visitInclude });
    return toVisitDTO(visit);
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
