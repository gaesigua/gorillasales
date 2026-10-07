'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { clearSessionCookie, setSessionCookie, UserSession } from '@/lib/auth';

const INVALID_CREDENTIALS = 'Invalid email or password.';

/**
 * Login Server Action
 */
export async function loginAction(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return { success: false, error: INVALID_CREDENTIALS };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { organization: true },
    });

    // Same error for unknown user, missing password and wrong password to avoid account enumeration
    if (!user || !user.isActive || !user.passwordHash) {
      return { success: false, error: INVALID_CREDENTIALS };
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return { success: false, error: INVALID_CREDENTIALS };
    }

    const session: UserSession = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      initials: user.initials,
      sessionVersion: user.sessionVersion,
    };

    await setSessionCookie(session);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { success: true };
  } catch (error) {
    console.error('Error in loginAction:', error);
    return { success: false, error: 'Authentication failed. Please try again.' };
  }
}

/**
 * Logout Server Action
 */
export async function logoutAction(): Promise<{ success: boolean }> {
  await clearSessionCookie();
  return { success: true };
}
