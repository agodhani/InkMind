import { emptyDecisions, type KbDecisions } from '../kb/decisions';
import { db } from './db';

export interface DecisionsStore { load(): Promise<KbDecisions>; save(value: KbDecisions): Promise<void> }
export class IndexedDbDecisionsStore implements DecisionsStore {
  async load(): Promise<KbDecisions> { return await db.getKv<KbDecisions>('kb.decisions') ?? emptyDecisions(); }
  async save(value: KbDecisions): Promise<void> { await db.setKv('kb.decisions', value); }
}
export class MemoryDecisionsStore implements DecisionsStore {
  private value = emptyDecisions();
  async load(): Promise<KbDecisions> { return structuredClone(this.value); }
  async save(value: KbDecisions): Promise<void> { this.value = structuredClone(value); }
}
