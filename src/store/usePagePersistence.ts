import { useEffect, useMemo, useRef, useState } from 'react';
import type { Page } from '../model/page';
import { db, openDb } from './db';
import { PagePersistence } from './pagePersistence';

export function usePagePersistence(onSaved: (page: Page) => void) {
  const saved = useRef(onSaved); saved.current = onSaved;
  const connection = useRef<IDBDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const writer = useMemo(() => new PagePersistence(async page => {
    const current = connection.current;
    if (current) {
      await new Promise<void>((resolve, reject) => {
        const tx = current.transaction('pages', 'readwrite');
        tx.objectStore('pages').put(page);
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Page save failed'));
      });
    } else await db.putPage(page);
    saved.current(page);
  }, e => setError(e instanceof Error ? e.message : String(e))), []);
  useEffect(() => {
    let disposed = false;
    void openDb().then(db => {
      if (disposed) db.close();
      else connection.current = db;
    }).catch(e => setError(String(e)));
    const flush = () => { void writer.flush(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      flush();
      connection.current?.close(); connection.current = null;
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [writer]);
  return { writer, error };
}
