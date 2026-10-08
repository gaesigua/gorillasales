import type { QueuedVisit, QueueStore } from './queue';

// Visits waiting to be sent live in IndexedDB: it survives reloads and closing the browser.
const DB_NAME = 'gorillasales-offline';
const STORE = 'visits';
export const QUEUE_CHANGED_EVENT = 'gs-offline-queue-changed';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'clientRef' });
      store.createIndex('userId', 'userId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function changed() {
  window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
}

export const idbStore: QueueStore & { clear(): Promise<void> } = {
  list: (userId) => run('readonly', (s) => s.index('userId').getAll(userId) as IDBRequest<QueuedVisit[]>),
  put: async (item) => {
    await run('readwrite', (s) => s.put(item));
    changed();
  },
  remove: async (clientRef) => {
    await run('readwrite', (s) => s.delete(clientRef));
    changed();
  },
  clear: async () => {
    await run('readwrite', (s) => s.clear());
    changed();
  },
};
