'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { MANAGER_ROLES, requireRole } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { stringToDateColumn } from '@/lib/dates';
import { dateString } from '@/lib/orderService';
import { listRoutes } from '@/lib/data/routes';
import type { ActionResult, RouteDTO } from '@/lib/types';

const routeSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'Give the route a name').max(80),
  salespersonId: z.string().min(1, 'Choose a rep'),
  weekday: z.coerce.number().int().min(1).max(7),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY']),
  startDate: dateString,
  notes: z.string().trim().max(300).optional().or(z.literal('')),
  customerIds: z.array(z.string()).min(1, 'Add at least one customer').max(80),
});

export type RouteInput = z.input<typeof routeSchema>;

/** Create or update a route and its customer order (managers only). */
export async function saveRoute(input: RouteInput): Promise<ActionResult<RouteDTO[]>> {
  return runAction('saveRoute', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const { organizationId } = session;
    const data = routeSchema.parse(input);
    if (new Set(data.customerIds).size !== data.customerIds.length) throw new UserFacingError('A customer is listed twice.');

    const rep = await prisma.user.findFirst({
      where: { id: data.salespersonId, organizationId, isActive: true, role: 'SALES_OFFICER' },
    });
    if (!rep) throw new UserFacingError('Choose an active sales officer.');
    // Reps can only log visits to their own (or unassigned) customers
    const customers = await prisma.customer.findMany({
      where: { organizationId, id: { in: data.customerIds } },
      select: { id: true, name: true, salespersonId: true },
    });
    if (customers.length !== data.customerIds.length) throw new UserFacingError('Customer not found.');
    const foreign = customers.find((c) => c.salespersonId && c.salespersonId !== rep.id);
    if (foreign) throw new UserFacingError(`${foreign.name} is assigned to another rep.`);

    const route = await prisma.$transaction(async (tx) => {
      const fields = {
        name: data.name,
        salespersonId: rep.id,
        weekday: data.weekday,
        frequency: data.frequency,
        startDate: stringToDateColumn(data.startDate),
        notes: data.notes || null,
      };
      let route;
      if (data.id) {
        const existing = await tx.route.findFirst({ where: { id: data.id, organizationId, isActive: true } });
        if (!existing) throw new UserFacingError('Route not found.');
        route = await tx.route.update({ where: { id: existing.id }, data: fields });
        await tx.routeStop.deleteMany({ where: { routeId: route.id } });
      } else {
        route = await tx.route.create({ data: { organizationId, ...fields } });
      }
      await tx.routeStop.createMany({
        data: data.customerIds.map((customerId, i) => ({ routeId: route.id, customerId, sortOrder: i + 1 })),
      });
      return route;
    });

    await audit(session, data.id ? 'UPDATE_ROUTE' : 'CREATE_ROUTE', 'Route', route.id, {
      name: data.name,
      weekday: data.weekday,
      customers: data.customerIds.length,
    });
    revalidatePath('/', 'layout');
    return listRoutes(session);
  });
}

/** Retire a route (kept for history; its name is freed for reuse). */
export async function deleteRoute(routeId: string): Promise<ActionResult<RouteDTO[]>> {
  return runAction('deleteRoute', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const route = await prisma.route.findFirst({
      where: { id: z.string().parse(routeId), organizationId: session.organizationId, isActive: true },
    });
    if (!route) throw new UserFacingError('Route not found.');
    await prisma.route.update({ where: { id: route.id }, data: { isActive: false, name: `${route.name} (retired ${route.id})` } });
    await audit(session, 'DELETE_ROUTE', 'Route', route.id, { name: route.name });
    revalidatePath('/', 'layout');
    return listRoutes(session);
  });
}
