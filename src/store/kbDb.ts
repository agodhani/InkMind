import type { KbGraph, PageExtraction } from '../kb/model';
import type { KnowledgeStore } from '../kb/store';
import { openDb } from './db';

const stores = ['kbExtractions', 'kbConcepts', 'kbEdges'];

async function transaction<T>(mode: IDBTransactionMode, run: (tx: IDBTransaction, done: (value: T) => void) => void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result: T;
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Knowledge transaction aborted')); };
    try { run(tx, value => { result = value; }); }
    catch (error) { tx.abort(); reject(error); }
  });
}

export class IndexedDbKnowledgeStore implements KnowledgeStore {
  listExtractions(): Promise<PageExtraction[]> {
    return transaction('readonly', (tx, done) => {
      const req = tx.objectStore('kbExtractions').getAll();
      req.onsuccess = () => done(req.result);
    });
  }
  loadGraph(): Promise<KbGraph> {
    return transaction('readonly', (tx, done) => {
      const concepts = tx.objectStore('kbConcepts').getAll(), edges = tx.objectStore('kbEdges').getAll();
      const read = () => { if (concepts.readyState === 'done' && edges.readyState === 'done') done({ concepts: concepts.result, edges: edges.result }); };
      concepts.onsuccess = read; edges.onsuccess = read;
    });
  }
  commit(pageId: string, extraction: PageExtraction | null, graph: KbGraph): Promise<void> {
    return transaction('readwrite', tx => {
      const extractions = tx.objectStore('kbExtractions');
      if (extraction) extractions.put(extraction); else extractions.delete(pageId);
      tx.objectStore('kbConcepts').clear(); tx.objectStore('kbEdges').clear();
      graph.concepts.forEach(c => tx.objectStore('kbConcepts').put(c));
      graph.edges.forEach(e => tx.objectStore('kbEdges').put(e));
    });
  }
  clear(): Promise<void> {
    return transaction('readwrite', tx => { stores.forEach(s => tx.objectStore(s).clear()); });
  }
}
