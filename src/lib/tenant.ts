import 'server-only';

import { getSession, UserSession } from './auth';

export class AuthError extends Error {}

export const MANAGER_ROLES: UserSession['role'][] = ['ADMIN', 'MANAGER'];

/**
 * Resolves the authenticated session for Server Actions. Throws if unauthenticated —
 * there is deliberately no fallback tenant.
 */
export async function requireSession(): Promise<UserSession> {
  const session = await getSession();
  if (!session) throw new AuthError('Not authenticated');
  return session;
}

export async function requireRole(roles: UserSession['role'][]): Promise<UserSession> {
  const session = await requireSession();
  if (!roles.includes(session.role)) throw new AuthError('Not authorized');
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
