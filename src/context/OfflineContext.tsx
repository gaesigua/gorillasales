'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { sendOverHttp, sendQueued, type QueuedVisit, type SyncSummary } from '@/lib/offline/queue';
import { idbStore, QUEUE_CHANGED_EVENT } from '@/lib/offline/idbStore';

const RETRY_EVERY_MS = 60_000;

interface OfflineState {
  online: boolean;
  /** This user's visits saved on the phone, oldest first. */
  queued: QueuedVisit[];
  syncing: boolean;
  /** Plain-language result of the last send, e.g. "Sent 2 visits." */
  notice: string;
  needsSignIn: boolean;
  enqueue: (item: QueuedVisit) => Promise<void>;
  discard: (clientRef: string) => Promise<void>;
  retry: (clientRef: string) => Promise<void>;
  syncNow: () => Promise<void>;
  /** Empties the queue and the offline copy of the Visits page (log out). */
  clearDevice: () => Promise<void>;
}

const OfflineContext = createContext<OfflineState | null>(null);

function postToWorker(message: { type: string }) {
  navigator.serviceWorker?.controller?.postMessage(message);
}

function describe(s: SyncSummary): string {
  const parts: string[] = [];
  if (s.sent) parts.push(`Sent ${s.sent} visit${s.sent === 1 ? '' : 's'} saved on this phone.`);
  if (s.onHold) parts.push(`${s.onHold} order${s.onHold === 1 ? ' is' : 's are'} on credit hold for manager approval.`);
  if (s.rejected) parts.push(`${s.rejected} could not be accepted — see the Visits page.`);
  return parts.join(' ');
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { currentUser } = useUser();
  const userId = currentUser.id;
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState<QueuedVisit[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const busy = useRef(false);

  const reload = useCallback(async () => {
    try {
      const items = await idbStore.list(userId);
      setQueued(items.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)));
    } catch {
      setQueued([]); // IndexedDB unavailable (private mode): nothing can be queued
    }
  }, [userId]);

  const syncNow = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    busy.current = true;
    setSyncing(true);
    try {
      const run = () => sendQueued(idbStore, userId, sendOverHttp);
      // One tab at a time sends, so two open tabs never race on the same visit
      const summary: SyncSummary | undefined = navigator.locks
        ? await navigator.locks.request('gs-visit-sync', { ifAvailable: true }, (lock) => (lock ? run() : undefined))
        : await run();
      if (!summary) return;
      setNeedsSignIn(summary.stoppedBecause === 'signin');
      if (summary.sent || summary.rejected) setNotice(describe(summary));
      if (summary.sent) {
        router.refresh();
        postToWorker({ type: 'refresh-field-copy' });
      }
    } catch {
      /* storage trouble: try again on the next trigger */
    } finally {
      busy.current = false;
      setSyncing(false);
      reload();
    }
  }, [userId, router, reload]);

  // Service worker (production builds only: in development it would serve stale code)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        if (navigator.onLine) reg.active?.postMessage({ type: 'refresh-field-copy' });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    reload();
    syncNow();
    const goOnline = () => {
      setOnline(true);
      syncNow();
      postToWorker({ type: 'refresh-field-copy' });
    };
    const goOffline = () => setOnline(false);
    const onVisible = () => document.visibilityState === 'visible' && syncNow();
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener(QUEUE_CHANGED_EVENT, reload);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener(QUEUE_CHANGED_EVENT, reload);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload, syncNow]);

  // While anything is waiting, keep trying (the 'online' event is unreliable on weak signal)
  const waiting = queued.some((v) => v.status === 'waiting');
  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(syncNow, RETRY_EVERY_MS);
    return () => window.clearInterval(id);
  }, [waiting, syncNow]);

  const value: OfflineState = {
    online,
    queued,
    syncing,
    notice,
    needsSignIn,
    syncNow,
    enqueue: async (item) => {
      await idbStore.put(item);
      if (navigator.onLine) syncNow();
    },
    discard: (clientRef) => idbStore.remove(clientRef),
    retry: async (clientRef) => {
      const item = queued.find((v) => v.clientRef === clientRef);
      if (!item) return;
      await idbStore.put({ ...item, status: 'waiting', error: undefined });
      syncNow();
    },
    clearDevice: async () => {
      try {
        await idbStore.clear();
      } catch {
        /* nothing stored */
      }
      postToWorker({ type: 'clear-field-copy' });
      if ('caches' in window) await caches.delete('gs-field-v1').catch(() => false);
    },
  };

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineState {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used inside OfflineProvider');
  return ctx;
}
