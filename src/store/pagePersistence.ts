import type { Page } from '../model/page';

export class PagePersistence {
  private latest = new Map<string, Page>();
  private deleted = new Set<string>();
  private generations = new Map<string, number>();
  private writing = new Map<string, Promise<unknown>>();
  private pending = new Map<string, { page: Page; timer: ReturnType<typeof setTimeout> }>();
  private write: (page: Page) => Promise<unknown>;
  private onError: (error: unknown) => void;
  private delay: number;
  constructor(write: (page: Page) => Promise<unknown>, onError: (error: unknown) => void, delay = 400) {
    this.write = write; this.onError = onError; this.delay = delay;
  }

  schedule(page: Page) {
    const latest = this.latest.get(page.id);
    if (latest && latest.updatedAt > page.updatedAt) return;
    this.latest.set(page.id, page);
    if (this.deleted.has(page.id)) return;
    if (this.pending.get(page.id)?.page === page) return;
    this.cancel(page.id);
    const timer = setTimeout(() => { void this.flushPage(page.id); }, this.delay);
    this.pending.set(page.id, { page, timer });
  }

  resolve(page: Page, active: Page | null): Page {
    return [page, this.latest.get(page.id), active?.id === page.id ? active : undefined]
      .filter((p): p is Page => !!p).reduce((a, b) => b.updatedAt >= a.updatedAt ? b : a);
  }

  async replace(page: Page, active: Page | null = null): Promise<Page> {
    const newest = this.resolve(page, active);
    const replacement = { ...page, updatedAt: Math.max(Date.now(), newest.updatedAt + 1) };
    this.cancel(page.id);
    this.deleted.delete(page.id);
    this.latest.set(page.id, replacement);
    await this.persist(replacement);
    return replacement;
  }

  async remove(id: string, remove: () => Promise<unknown>): Promise<void> {
    this.cancel(id);
    this.deleted.add(id);
    const generation = (this.generations.get(id) ?? 0) + 1;
    this.generations.set(id, generation);
    try {
      await this.enqueue(id, remove);
      if (this.generations.get(id) === generation && this.deleted.has(id)) this.latest.delete(id);
    } catch (error) {
      if (this.generations.get(id) === generation && this.deleted.has(id)) {
        this.deleted.delete(id);
        const latest = this.latest.get(id);
        if (latest) this.schedule(latest);
      }
      throw error;
    }
  }

  private persist(page: Page): Promise<void> {
    const generation = this.generations.get(page.id) ?? 0;
    return this.enqueue(page.id, async () => {
      if (this.deleted.has(page.id) || generation !== (this.generations.get(page.id) ?? 0)) return;
      await this.write(page);
    });
  }

  private async enqueue(id: string, action: () => Promise<unknown>): Promise<void> {
    const previous = this.writing.get(id);
    const operation = previous ? previous.catch(() => {}).then(action) : action();
    this.writing.set(id, operation);
    try { await operation; }
    finally { if (this.writing.get(id) === operation) this.writing.delete(id); }
  }

  cancel(id: string) {
    const pending = this.pending.get(id);
    if (pending) clearTimeout(pending.timer);
    this.pending.delete(id);
  }

  private async flushPage(id: string) {
    const pending = this.pending.get(id);
    if (!pending) return;
    this.cancel(id);
    try { await this.persist(pending.page); } catch (error) { this.onError(error); }
  }

  async flush() {
    await Promise.all([...this.pending.keys()].map(id => this.flushPage(id)));
  }
}
