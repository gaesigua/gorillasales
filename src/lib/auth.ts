import 'server-only';

import { cookies } from 'next/headers';
import { COOKIE_NAME, SESSION_MAX_AGE_SECONDS, UserSession, decryptSession, encryptSession } from './session';

// Server-only helpers. This file must NOT be marked 'use server': every export of a
// 'use server' module becomes a publicly callable endpoint. Client-callable actions
// live in src/actions/auth.ts.

export type { UserSession } from './session';

/**
 * Get current authenticated user session from HTTP-only cookie
 */
export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await decryptSession(token);
}

/**
 * Set HTTP-only session cookie
 */
export async function setSessionCookie(session: UserSession) {
  const token = await encryptSession(session);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
