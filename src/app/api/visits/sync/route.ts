import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { AuthError, requireSession } from '@/lib/tenant';
import { UserFacingError } from '@/lib/actionUtils';
import { recordVisit } from '@/lib/visitService';

/**
 * Receives one visit that a phone saved while offline. Unlike a Server Action this URL does
 * not change between deployments, so a phone holding an old copy of the page can still send.
 *
 *   200 saved (or already saved: `duplicate: true`)   401 sign in again
 *   422 rejected, with a message to show the user      500 try again later
 */
export async function POST(request: NextRequest) {
  // Cookie-authenticated POST: only accept it from our own pages
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: 'Cross-site request refused.' }, { status: 403 });
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 415 });
  }

  try {
    const session = await requireSession();
    const body = await request.json();
    const { visit, duplicate } = await recordVisit(session, body);
    if (!duplicate) revalidatePath('/', 'layout');
    return NextResponse.json({
      ok: true,
      duplicate,
      visit: {
        id: visit.id,
        customerName: visit.customerName,
        orderNumber: visit.orderNumber ?? null,
        orderStatus: visit.orderStatus ?? null,
        salesValue: visit.salesValue,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'Sign in again to send this visit.' }, { status: 401 });
    if (error instanceof UserFacingError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof ZodError || error instanceof SyntaxError) {
      const issue = error instanceof ZodError ? error.issues[0] : undefined;
      return NextResponse.json({ error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid visit data.' }, { status: 422 });
    }
    console.error('Visit sync failed:', error);
    return NextResponse.json({ error: 'Server error. It will be retried.' }, { status: 500 });
  }
}
