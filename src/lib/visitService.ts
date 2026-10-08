import 'server-only';

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { canViewAllReps, customerScope, scopedSalespersonId } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { UserFacingError } from '@/lib/actionUtils';
import { stringToDateColumn, todayKigali } from '@/lib/dates';
import { toVisitDTO, visitInclude } from '@/lib/data/visits';
import { orderLinesSchema, placeOrder } from '@/lib/orderService';
import type { VisitLog } from '@/lib/types';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

export const createVisitSchema = z.object({
  salespersonId: z.string().optional(),
  customerId: z.string().min(1, 'Select a customer'),
  dateOfVisit: dateString,
  visitOutcome: z.string().trim().min(1, 'Select an outcome').max(120),
  nextFollowUpDate: dateString.optional().or(z.literal('')),
  remarks: z.string().trim().max(2000).optional(),
  // Products ordered during the visit; omitted or empty when no order was taken
  orderLines: orderLinesSchema.optional(),
  orderNotes: z.string().trim().max(2000).optional(),
  // Id the phone gave the visit; sending the same id again returns the visit already saved
  clientRef: z.string().uuid().optional(),
  // Set when the visit was saved on the phone while offline and is being sent later
  capturedAt: z.string().datetime().optional(),
});

export type CreateVisitInput = z.input<typeof createVisitSchema>;

/** The visit already saved under this phone id, if any. */
async function existingVisit(session: UserSession, clientRef: string): Promise<VisitLog | null> {
  const visit = await prisma.visitLog.findUnique({
    where: { organizationId_clientRef: { organizationId: session.organizationId, clientRef } },
    include: visitInclude,
  });
  if (!visit) return null;
  if (!canViewAllReps(session) && visit.salespersonId !== session.userId) {
    throw new UserFacingError('This visit was already sent by another user.');
  }
  return toVisitDTO(visit);
}

/**
 * Record a sales visit, plus the order taken during it if any. Sales officers always log as
 * themselves; managers may log on behalf of a rep in their organization. Safe to repeat with
 * the same clientRef: the second call returns the first visit (`duplicate: true`).
 */
export async function recordVisit(
  session: UserSession,
  input: CreateVisitInput
): Promise<{ visit: VisitLog; duplicate: boolean }> {
  const { organizationId } = session;
  const data = createVisitSchema.parse({ ...input, orderLines: input.orderLines?.length ? input.orderLines : undefined });

  if (data.clientRef) {
    const already = await existingVisit(session, data.clientRef);
    if (already) return { visit: already, duplicate: true };
  }
  if (data.dateOfVisit > todayKigali()) throw new UserFacingError('Visit date cannot be in the future.');

  const salespersonId = scopedSalespersonId(session, data.salespersonId) || session.userId;
  const [rep, customer] = await Promise.all([
    prisma.user.findFirst({ where: { id: salespersonId, organizationId }, select: { id: true } }),
    prisma.customer.findFirst({ where: { id: data.customerId, ...customerScope(session) }, select: { id: true } }),
  ]);
  if (!rep) throw new UserFacingError('Salesperson not found.');
  if (!customer) throw new UserFacingError('Customer not found.');

  let created: { visitId: string; order: Awaited<ReturnType<typeof placeOrder>> | null };
  try {
    created = await prisma.$transaction(async (tx) => {
      const visit = await tx.visitLog.create({
        data: {
          organizationId,
          salespersonId,
          customerId: data.customerId,
          dateOfVisit: stringToDateColumn(data.dateOfVisit),
          visitOutcome: data.visitOutcome,
          nextFollowUpDate: data.nextFollowUpDate ? stringToDateColumn(data.nextFollowUpDate) : null,
          remarks: data.remarks || null,
          clientRef: data.clientRef ?? null,
          capturedAt: data.capturedAt ? new Date(data.capturedAt) : null,
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
  } catch (error) {
    // Two copies of the same queued visit arrived at once: the other one won, return it
    if (data.clientRef && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const already = await existingVisit(session, data.clientRef);
      if (already) return { visit: already, duplicate: true };
    }
    throw error;
  }

  const { visitId, order } = created;
  await audit(session, 'CREATE_VISIT_LOG', 'VisitLog', visitId, {
    customerId: data.customerId,
    orderId: order?.id,
    ...(data.capturedAt ? { capturedOfflineAt: data.capturedAt } : {}),
  });
  if (order) {
    await audit(session, 'CREATE_ORDER', 'SalesOrder', order.id, {
      orderNumber: order.orderNumber,
      total: order.total,
      status: order.status,
      holdReason: order.holdReason,
      visitLogId: visitId,
    });
  }
  const visit = await prisma.visitLog.findUniqueOrThrow({ where: { id: visitId }, include: visitInclude });
  return { visit: toVisitDTO(visit), duplicate: false };
}
