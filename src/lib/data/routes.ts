import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { UserSession } from '@/lib/auth';
import { scopedSalespersonId } from '@/lib/tenant';
import { dateColumnToString, stringToDateColumn } from '@/lib/dates';
import { plannedStops, routeCompliance } from '@/lib/domain/routes';
import type { RepCompliance, RouteDTO, RoutePlanStop } from '@/lib/types';

const routeInclude = {
  salesperson: { select: { name: true } },
  stops: { include: { customer: { select: { id: true, name: true, area: true } } }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.RouteInclude;

/** Active routes; sales officers see only their own. */
export async function listRoutes(session: UserSession, salespersonId?: string): Promise<RouteDTO[]> {
  const repId = scopedSalespersonId(session, salespersonId);
  const rows = await prisma.route.findMany({
    where: { organizationId: session.organizationId, isActive: true, ...(repId ? { salespersonId: repId } : {}) },
    include: routeInclude,
    orderBy: [{ salesperson: { name: 'asc' } }, { weekday: 'asc' }, { name: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    salespersonId: r.salespersonId,
    salesperson: r.salesperson.name,
    weekday: r.weekday,
    frequency: r.frequency,
    startDate: dateColumnToString(r.startDate),
    notes: r.notes ?? '',
    customers: r.stops.map((s) => s.customer),
  }));
}

function toSchedules(routes: RouteDTO[]) {
  return routes.map((r) => ({ ...r, customerIds: r.customers.map((c) => c.id) }));
}

/**
 * Customers planned for a date and whether each has been visited by its rep. Sales officers get
 * their own plan; managers get every rep's (or one rep's when salespersonId is given).
 */
export async function getRoutePlan(session: UserSession, date: string, salespersonId?: string): Promise<RoutePlanStop[]> {
  const repId = scopedSalespersonId(session, salespersonId);
  const routes = await listRoutes(session, repId);
  const plan = plannedStops(toSchedules(routes), date, date);
  if (plan.length === 0) return [];
  const visits = await prisma.visitLog.findMany({
    where: { organizationId: session.organizationId, dateOfVisit: stringToDateColumn(date), ...(repId ? { salespersonId: repId } : {}) },
    select: { customerId: true, salespersonId: true },
  });
  const visited = new Set(visits.map((v) => `${v.salespersonId}|${v.customerId}`));
  const customers = new Map(routes.flatMap((r) => r.customers.map((c) => [c.id, c] as const)));
  const reps = new Map(routes.map((r) => [r.salespersonId, r.salesperson]));
  return plan.map((p) => ({
    salespersonId: p.salespersonId,
    salesperson: reps.get(p.salespersonId) ?? '',
    customerId: p.customerId,
    customerName: customers.get(p.customerId)?.name ?? '',
    area: customers.get(p.customerId)?.area ?? '',
    routeName: p.routeName,
    visited: visited.has(`${p.salespersonId}|${p.customerId}`),
  }));
}

/** Planned vs actual visits per rep over [from, to]. */
export async function getRouteCompliance(session: UserSession, from: string, to: string): Promise<RepCompliance[]> {
  const routes = await listRoutes(session);
  const plan = plannedStops(toSchedules(routes), from, to);
  const repId = scopedSalespersonId(session);
  const visits = await prisma.visitLog.findMany({
    where: {
      organizationId: session.organizationId,
      dateOfVisit: { gte: stringToDateColumn(from), lte: stringToDateColumn(to) },
      ...(repId ? { salespersonId: repId } : {}),
    },
    select: { dateOfVisit: true, salespersonId: true, customerId: true },
  });
  const visitRefs = visits.map((v) => ({ date: dateColumnToString(v.dateOfVisit), salespersonId: v.salespersonId, customerId: v.customerId }));
  const customers = new Map(routes.flatMap((r) => r.customers.map((c) => [c.id, c.name] as const)));
  const reps = new Map(routes.map((r) => [r.salespersonId, r.salesperson]));

  return [...reps.entries()].map(([salespersonId, salesperson]) => {
    const c = routeCompliance(
      plan.filter((p) => p.salespersonId === salespersonId),
      visitRefs.filter((v) => v.salespersonId === salespersonId)
    );
    return {
      salespersonId,
      salesperson,
      planned: c.planned,
      visited: c.visited,
      offRoute: c.offRoute,
      pct: c.pct,
      missed: c.missed.map((m) => ({ date: m.date, customerName: customers.get(m.customerId) ?? '', routeName: m.routeName })),
    };
  });
}
