import type { Page } from '../model/page';

export class PagePersistence {
  private latest = new Map<string, Page>();
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
    if (this.pending.get(page.id)?.page === page) return;
    this.cancel(page.id);
    const timer = setTimeout(() => { void this.flushPage(page.id); }, this.delay);
    this.pending.set(page.id, { page, timer });
  }

  resolve(page: Page, active: Page | null): Page {
    return [page, this.latest.get(page.id), active?.id === page.id ? active : undefined]
      .filter((p): p is Page => !!p).reduce((a, b) => b.updatedAt >= a.updatedAt ? b : a);
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
    try { await this.write(pending.page); } catch (error) { this.onError(error); }
  }

  async flush() {
    await Promise.all([...this.pending.keys()].map(id => this.flushPage(id)));
  }
}
