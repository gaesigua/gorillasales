'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canViewAllReps, customerScope, requireSession, scopedSalespersonId } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { stringToDateColumn } from '@/lib/dates';
import { listVisits, toVisitDTO, visitInclude } from '@/lib/data/visits';
import type { ActionResult, PaymentStatusValue, VisitLog } from '@/lib/types';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

const createVisitSchema = z.object({
  salespersonId: z.string().optional(),
  customerId: z.string().min(1, 'Select a customer'),
  dateOfVisit: dateString,
  visitOutcome: z.string().trim().min(1, 'Select an outcome').max(120),
  productId: z.string().optional(),
  quantity: z.coerce.number().min(0).default(0),
  unitPrice: z.coerce.number().min(0).default(0),
  paymentStatus: z.enum(['PAID', 'CREDIT', 'PENDING', 'OVERDUE', 'PARTIAL']).default('PENDING'),
  nextFollowUpDate: dateString.optional().or(z.literal('')),
  remarks: z.string().trim().max(2000).optional(),
});

export interface CreateVisitInput {
  salespersonId?: string;
  customerId: string;
  dateOfVisit: string;
  visitOutcome: string;
  productId?: string;
  quantity: number;
  unitPrice: number;
  paymentStatus: PaymentStatusValue;
  nextFollowUpDate?: string;
  remarks?: string;
}

/**
 * Record a new sales visit. Sales officers always log as themselves; managers may log
 * on behalf of a rep in their organization.
 */
export async function createVisitLog(input: CreateVisitInput): Promise<ActionResult<VisitLog>> {
  return runAction('createVisitLog', async () => {
    const session = await requireSession();
    const { organizationId } = session;
    const data = createVisitSchema.parse(input);

    const salespersonId = scopedSalespersonId(session, data.salespersonId) || session.userId;
    const productId = data.productId || undefined;
    const [rep, customer, product] = await Promise.all([
      prisma.user.findFirst({ where: { id: salespersonId, organizationId }, select: { id: true } }),
      prisma.customer.findFirst({ where: { id: data.customerId, ...customerScope(session) }, select: { id: true } }),
      productId
        ? prisma.product.findFirst({ where: { id: productId, organizationId }, select: { id: true } })
        : Promise.resolve(null),
    ]);
    if (!rep) throw new UserFacingError('Salesperson not found.');
    if (!customer) throw new UserFacingError('Customer not found.');
    if (productId && !product) throw new UserFacingError('Product not found.');
    if (data.quantity > 0 && !productId) throw new UserFacingError('Select the product sold.');

    const visit = await prisma.visitLog.create({
      data: {
        organizationId,
        salespersonId,
        customerId: data.customerId,
        dateOfVisit: stringToDateColumn(data.dateOfVisit),
        visitOutcome: data.visitOutcome,
        productId,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        salesValue: data.quantity * data.unitPrice,
        paymentStatus: data.paymentStatus,
        nextFollowUpDate: data.nextFollowUpDate ? stringToDateColumn(data.nextFollowUpDate) : null,
        remarks: data.remarks || null,
      },
      include: visitInclude,
    });

    await audit(session, 'CREATE_VISIT_LOG', 'VisitLog', visit.id, {
      customerId: visit.customerId,
      salesValue: visit.salesValue,
    });
    revalidatePath('/', 'layout');
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
    });
    if (!visit) throw new UserFacingError('Visit not found.');

    await prisma.visitLog.delete({ where: { id: visit.id } });
    await audit(session, 'DELETE_VISIT_LOG', 'VisitLog', visit.id, {
      customerId: visit.customerId,
      dateOfVisit: visit.dateOfVisit,
      salesValue: visit.salesValue,
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
