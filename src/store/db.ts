import type { Page } from '../model/page';
import type { Correction } from '../profile/handwritingProfile';

const DB_NAME = 'inkmind';
const DB_VERSION = 2;

type StoreName = 'pages' | 'corrections' | 'kv';

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('pages')) db.createObjectStore('pages', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('corrections')) db.createObjectStore('corrections', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('kbExtractions')) db.createObjectStore('kbExtractions', { keyPath: 'pageId' });
      if (!db.objectStoreNames.contains('kbConcepts')) db.createObjectStore('kbConcepts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kbEdges')) db.createObjectStore('kbEdges', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = run(t.objectStore(store));
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
    t.oncomplete = () => db.close();
  });
}

export const db = {
  async listPages(): Promise<Page[]> {
    const pages = await tx<Page[]>('pages', 'readonly', (s) => s.getAll());
    return pages.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  getPage: (id: string) => tx<Page | undefined>('pages', 'readonly', (s) => s.get(id)),
  putPage: (page: Page) => tx('pages', 'readwrite', (s) => s.put(page)),
  deletePage: (id: string) => tx('pages', 'readwrite', (s) => s.delete(id)),

  listCorrections: () => tx<Correction[]>('corrections', 'readonly', (s) => s.getAll()),
  putCorrection: (c: Correction) => tx('corrections', 'readwrite', (s) => s.put(c)),
  clearCorrections: () => tx('corrections', 'readwrite', (s) => s.clear()),

  getKv: <T>(key: string) => tx<T | undefined>('kv', 'readonly', (s) => s.get(key)),
  setKv: <T>(key: string, value: T) => tx('kv', 'readwrite', (s) => s.put(value, key)),
};

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}
