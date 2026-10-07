import 'server-only';

import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AuthError } from './tenant';
import type { ActionResult } from './types';

/** An error whose message is safe to show to the user. */
export class UserFacingError extends Error {}

/**
 * Runs a server action body and converts failures into a safe ActionResult. Internal
 * error details are logged server-side and never sent to the browser.
 */
export async function runAction<T>(name: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: 'You are not allowed to do that.' };
    if (error instanceof UserFacingError) return { success: false, error: error.message };
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      const field = issue?.path.join('.');
      return { success: false, error: field ? `${field}: ${issue.message}` : issue?.message ?? 'Invalid input' };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: 'A record with the same value already exists.' };
    }
    console.error(`Server action ${name} failed:`, error);
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}
