import type { Page } from '../model/page';

export class PagePersistence {
  private pending = new Map<string, { page: Page; timer: ReturnType<typeof setTimeout> }>();
  private write: (page: Page) => Promise<unknown>;
  private onError: (error: unknown) => void;
  private delay: number;
  constructor(write: (page: Page) => Promise<unknown>, onError: (error: unknown) => void, delay = 400) {
    this.write = write; this.onError = onError; this.delay = delay;
  }

  schedule(page: Page) {
    if (this.pending.get(page.id)?.page === page) return;
    this.cancel(page.id);
    const timer = setTimeout(() => { void this.flushPage(page.id); }, this.delay);
    this.pending.set(page.id, { page, timer });
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
