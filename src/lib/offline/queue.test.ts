import { describe, expect, it } from 'vitest';
import { newVisitRef, sendQueued, type QueuedVisit, type QueueStore, type SendResult } from './queue';

function memoryStore(items: QueuedVisit[]): QueueStore & { items: Map<string, QueuedVisit> } {
  const map = new Map(items.map((i) => [i.clientRef, i]));
  return {
    items: map,
    list: async (userId) => [...map.values()].filter((v) => v.userId === userId),
    put: async (item) => void map.set(item.clientRef, item),
    remove: async (ref) => void map.delete(ref),
  };
}

const visit = (clientRef: string, capturedAt: string, extra: Partial<QueuedVisit> = {}): QueuedVisit => ({
  clientRef,
  userId: 'u1',
  capturedAt,
  input: { customerId: 'c1', dateOfVisit: '2026-10-08', visitOutcome: 'Visit Only' },
  label: { customerName: 'Shop', dateOfVisit: '2026-10-08', visitOutcome: 'Visit Only', lineCount: 0, estimatedTotal: 0 },
  status: 'waiting',
  attempts: 0,
  ...extra,
});

const scripted = (results: Record<string, SendResult>) => {
  const order: string[] = [];
  return { order, send: async (v: QueuedVisit) => (order.push(v.clientRef), results[v.clientRef]) };
};

describe('sendQueued', () => {
  it('sends oldest first and removes what was sent', async () => {
    const store = memoryStore([visit('b', '2026-10-08T09:00:00Z'), visit('a', '2026-10-08T08:00:00Z')]);
    const { order, send } = scripted({
      a: { kind: 'sent', orderNumber: null, onHold: false },
      b: { kind: 'sent', orderNumber: 'SO-1', onHold: true },
    });
    const summary = await sendQueued(store, 'u1', send);
    expect(order).toEqual(['a', 'b']);
    expect(summary).toEqual({ sent: 2, onHold: 1, rejected: 0, stoppedBecause: null });
    expect(store.items.size).toBe(0);
  });

  it('keeps a rejected visit with its reason and carries on', async () => {
    const store = memoryStore([visit('a', '1'), visit('b', '2')]);
    const { send } = scripted({
      a: { kind: 'rejected', error: 'Customer not found.' },
      b: { kind: 'sent', orderNumber: null, onHold: false },
    });
    const summary = await sendQueued(store, 'u1', send);
    expect(summary.rejected).toBe(1);
    expect(summary.sent).toBe(1);
    expect(store.items.get('a')).toMatchObject({ status: 'rejected', error: 'Customer not found.', attempts: 1 });
  });

  it('stops at the first connection problem and keeps the rest waiting', async () => {
    const store = memoryStore([visit('a', '1'), visit('b', '2'), visit('c', '3')]);
    const { order, send } = scripted({
      a: { kind: 'sent', orderNumber: null, onHold: false },
      b: { kind: 'retry' },
      c: { kind: 'sent', orderNumber: null, onHold: false },
    });
    const summary = await sendQueued(store, 'u1', send);
    expect(order).toEqual(['a', 'b']);
    expect(summary.stoppedBecause).toBe('retry');
    expect(store.items.get('b')).toMatchObject({ status: 'waiting', attempts: 1 });
    expect(store.items.has('c')).toBe(true);
  });

  it('stops when the session has expired', async () => {
    const store = memoryStore([visit('a', '1'), visit('b', '2')]);
    const { order, send } = scripted({ a: { kind: 'signin' }, b: { kind: 'sent', orderNumber: null, onHold: false } });
    expect((await sendQueued(store, 'u1', send)).stoppedBecause).toBe('signin');
    expect(order).toEqual(['a']);
  });

  it("skips rejected visits and other users' visits", async () => {
    const store = memoryStore([visit('a', '1', { status: 'rejected' }), visit('b', '2', { userId: 'u2' })]);
    const { order, send } = scripted({});
    expect(await sendQueued(store, 'u1', send)).toEqual({ sent: 0, onHold: 0, rejected: 0, stoppedBecause: null });
    expect(order).toEqual([]);
  });
});

describe('newVisitRef', () => {
  it('makes distinct version 4 UUIDs', () => {
    const a = newVisitRef();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newVisitRef()).not.toBe(a);
  });
});
