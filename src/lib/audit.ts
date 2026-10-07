import 'server-only';

import { headers } from 'next/headers';
import { prisma } from './prisma';
import type { UserSession } from './auth';

/**
 * Records a mutation in the audit trail. Never throws: a failed audit write is logged
 * but does not fail the user's action.
 */
export async function audit(
  session: UserSession,
  action: string,
  entityType: string,
  entityId: string | null,
  payload?: Record<string, unknown>
): Promise<void> {
  try {
    const h = await headers();
    const ipAddress = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action,
        entityType,
        entityId,
        payload: payload ? JSON.parse(JSON.stringify(payload)) : undefined,
        ipAddress,
      },
    });
  } catch (error) {
    console.error('Audit log write failed:', action, entityType, entityId, error);
  }
}
