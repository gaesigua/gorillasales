import { SignJWT, jwtVerify } from 'jose';

// Edge-safe session primitives (no Prisma, no next/headers) so middleware can share them.

export const COOKIE_NAME = 'gorillasales_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type SessionRole = 'ADMIN' | 'MANAGER' | 'SALES_OFFICER' | 'DELIVERY_SUPPORT' | 'DRIVER';

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  role: SessionRole;
  organizationId: string;
  organizationName: string;
  initials: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET env var is missing or shorter than 32 characters.');
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: UserSession): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function decryptSession(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}
