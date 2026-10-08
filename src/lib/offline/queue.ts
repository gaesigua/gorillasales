import type { CreateVisitInput } from '@/lib/visitService';

/** A visit saved on the phone, waiting to be sent to the server. */
export interface QueuedVisit {
  clientRef: string;
  /** Who entered it; only that user's session may send it. */
  userId: string;
  capturedAt: string; // ISO timestamp
  input: CreateVisitInput;
  /** What to show in the waiting list without decoding the input. */
  label: { customerName: string; dateOfVisit: string; visitOutcome: string; lineCount: number; estimatedTotal: number };
  /** waiting: will be sent; rejected: the server refused it and the user must act. */
  status: 'waiting' | 'rejected';
  error?: string;
  attempts: number;
}

export interface QueueStore {
  list(userId: string): Promise<QueuedVisit[]>;
  put(item: QueuedVisit): Promise<void>;
  remove(clientRef: string): Promise<void>;
}

/** Outcome of sending one visit. */
export type SendResult =
  | { kind: 'sent'; orderNumber: string | null; onHold: boolean }
  | { kind: 'rejected'; error: string } // the server refused it; retrying will not help
  | { kind: 'signin' } // session expired: stop until the user signs in again
  | { kind: 'retry' }; // offline or server trouble: stop and try again later

export interface SyncSummary {
  sent: number;
  onHold: number;
  rejected: number;
  stoppedBecause: 'signin' | 'retry' | null;
}

/** Sends the user's waiting visits oldest first, stopping at the first connection problem. */
export async function sendQueued(
  store: QueueStore,
  userId: string,
  send: (item: QueuedVisit) => Promise<SendResult>
): Promise<SyncSummary> {
  const summary: SyncSummary = { sent: 0, onHold: 0, rejected: 0, stoppedBecause: null };
  const waiting = (await store.list(userId))
    .filter((v) => v.status === 'waiting')
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  for (const item of waiting) {
    const result = await send(item);
    if (result.kind === 'sent') {
      await store.remove(item.clientRef);
      summary.sent++;
      if (result.onHold) summary.onHold++;
    } else if (result.kind === 'rejected') {
      await store.put({ ...item, status: 'rejected', error: result.error, attempts: item.attempts + 1 });
      summary.rejected++;
    } else {
      await store.put({ ...item, attempts: item.attempts + 1 });
      summary.stoppedBecause = result.kind;
      break;
    }
  }
  return summary;
}

/** Sends one visit to /api/visits/sync. */
export async function sendOverHttp(item: QueuedVisit): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch('/api/visits/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ ...item.input, clientRef: item.clientRef, capturedAt: item.capturedAt }),
    });
  } catch {
    return { kind: 'retry' };
  }
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    visit?: { orderNumber: string | null; orderStatus: string | null };
  };
  if (res.ok) {
    return { kind: 'sent', orderNumber: body.visit?.orderNumber ?? null, onHold: body.visit?.orderStatus === 'PENDING_APPROVAL' };
  }
  if (res.status === 401) return { kind: 'signin' };
  if (res.status === 422) return { kind: 'rejected', error: body.error ?? 'The server refused this visit.' };
  return { kind: 'retry' };
}

/** RFC 4122 version 4 id (crypto.randomUUID needs a secure context; this does not). */
export function newVisitRef(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
