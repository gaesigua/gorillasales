import 'server-only';

import { cache } from 'react';
import type { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';
import { getSession, UserSession } from './auth';
import { MANAGER_ROLES, Role } from './roles';

export { MANAGER_ROLES } from './roles';

export class AuthError extends Error {}

/**
 * Validates the session cookie against the database (once per request): the user must
 * still exist and be active, and the token's sessionVersion must be current. Role and
 * organization are taken from the database, so role changes apply immediately.
 */
const loadActiveSession = cache(async (): Promise<UserSession | null> => {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      initials: true,
      isActive: true,
      sessionVersion: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
  });
  if (!user || !user.isActive || user.sessionVersion !== (session.sessionVersion ?? 0)) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    initials: user.initials,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
    sessionVersion: user.sessionVersion,
  };
});

/**
 * Resolves the authenticated session for Server Actions and data loaders. Throws if
 * unauthenticated — there is deliberately no fallback tenant.
 */
export async function requireSession(): Promise<UserSession> {
  const session = await loadActiveSession();
  if (!session) throw new AuthError('Not authenticated');
  return session;
}

export async function requireRole(roles: Role[]): Promise<UserSession> {
  const session = await requireSession();
  if (!roles.includes(session.role)) throw new AuthError('Not authorized');
  return session;
}

/** For server components: redirect to /login instead of throwing. */
export async function requirePageSession(roles?: Role[]): Promise<UserSession> {
  const session = await loadActiveSession();
  if (!session) redirect('/login');
  if (roles && !roles.includes(session.role)) redirect('/dashboard');
  return session;
}

export function canViewAllReps(session: UserSession): boolean {
  return MANAGER_ROLES.includes(session.role);
}

/**
 * Sales officers may only see/act on their own records; managers may optionally filter by rep.
 */
export function scopedSalespersonId(session: UserSession, requested?: string): string | undefined {
  return canViewAllReps(session) ? requested : session.userId;
}

/** Customers a session may see: managers see all; sales officers see their own and unassigned ones. */
export function customerScope(session: UserSession): Prisma.CustomerWhereInput {
  const base: Prisma.CustomerWhereInput = { organizationId: session.organizationId };
  if (canViewAllReps(session)) return base;
  return { ...base, OR: [{ salespersonId: session.userId }, { salespersonId: null }] };
}
