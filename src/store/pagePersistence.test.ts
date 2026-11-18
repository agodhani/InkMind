import { afterEach, expect, it, vi } from 'vitest';
import { createPage } from '../model/page';
import { PagePersistence } from './pagePersistence';

afterEach(() => vi.useRealTimers());

it('deletes after an in-flight save without allowing queued or later saves to recreate the page', async () => {
  vi.useFakeTimers();
  const page = createPage('Original'), queued = { ...page, title: 'Queued' };
  let resume!: () => void, stored: typeof page | undefined = page;
  const gate = new Promise<void>(r => { resume = r; });
  const write = vi.fn(async (p: typeof page) => { if (p === page) await gate; stored = p; });
  const writer = new PagePersistence(write, vi.fn());
  writer.schedule(page); const saving = writer.flush();
  writer.schedule(queued); const queuedSave = writer.flush();
  writer.schedule({ ...page, title: 'Pending' });
  const remove = vi.fn(async () => { stored = undefined; });
  const deleting = writer.remove(page.id, remove);
  expect(remove).not.toHaveBeenCalled();
  resume(); await saving; await queuedSave; await deleting;
  expect(stored).toBeUndefined();
  writer.schedule({ ...page, title: 'Late effect' });
  await vi.runAllTimersAsync(); await writer.flush();
  expect(stored).toBeUndefined();
  expect(write.mock.calls).toEqual([[page]]);
  expect(remove).toHaveBeenCalledOnce();
});

it('allows explicit recreation after deletion without reviving pre-deletion queued writes', async () => {
  const page = createPage('Original');
  let resume!: () => void;
  const gate = new Promise<void>(r => { resume = r; });
  const write = vi.fn(async (p: typeof page) => { if (p === page) await gate; });
  const writer = new PagePersistence(write, vi.fn());
  writer.schedule(page); const saving = writer.flush();
  const queued = writer.replace({ ...page, title: 'Old queued replacement' });
  const remove = vi.fn(async () => {}), deleting = writer.remove(page.id, remove);
  const recreating = writer.replace({ ...page, title: 'Recreated' });
  resume(); await saving; await queued; await deleting;
  const recreated = await recreating;
  expect(write.mock.calls).toEqual([[page], [recreated]]);
  expect(remove.mock.invocationCallOrder[0]).toBeLessThan(write.mock.invocationCallOrder[1]);
  writer.schedule({ ...recreated, title: 'New edit', updatedAt: recreated.updatedAt + 1 });
  await writer.flush();
  expect(write.mock.calls[2][0].title).toBe('New edit');
});

it('restores normal saving after a deletion failure', async () => {
  const write = vi.fn(async () => {}), writer = new PagePersistence(write, vi.fn());
  const page = createPage('Pending'), failure = new Error('Delete failed');
  writer.schedule(page);
  await expect(writer.remove(page.id, async () => { throw failure; })).rejects.toBe(failure);
  const edited = { ...page, title: 'Edited after failure', updatedAt: page.updatedAt + 1 };
  writer.schedule(edited); await writer.flush();
  expect(write.mock.calls).toEqual([[edited]]);
});

it.each([false, true])('reschedules the latest snapshot after deletion fails (edited during deletion: %s)', async during => {
  const write = vi.fn(async () => {}), writer = new PagePersistence(write, vi.fn());
  const page = createPage('Pending'), edited = { ...page, title: 'Edited during deletion', updatedAt: page.updatedAt + 1 };
  let reject!: (error: Error) => void;
  const failure = new Error('Delete failed'), gate = new Promise<void>((_, r) => { reject = r; });
  writer.schedule(page);
  const deleting = writer.remove(page.id, () => gate);
  if (during) writer.schedule(edited);
  reject(failure);
  await expect(deleting).rejects.toBe(failure);
  await writer.flush();
  expect(write.mock.calls).toEqual([[during ? edited : page]]);
});

it.each([false, true])('persists explicit demo replacement over a cached edit (already saved: %s)', async saved => {
  vi.useFakeTimers(); vi.setSystemTime(100);
  const demo = { ...createPage('Demo content'), updatedAt: 0 }, edited = { ...demo, title: 'User edit', updatedAt: 200 };
  let stored = demo;
  const write = vi.fn(async (page: typeof demo) => { stored = page; });
  const writer = new PagePersistence(write, vi.fn());
  writer.schedule(edited); if (saved) await writer.flush();
  const replacement = await writer.replace(demo, edited);
  const opened = writer.resolve(replacement, edited);
  writer.schedule(opened);
  await vi.runAllTimersAsync(); await writer.flush();
  expect(opened.title).toBe('Demo content');
  expect(stored.title).toBe('Demo content');
  expect(stored.updatedAt).toBeGreaterThan(edited.updatedAt);
});

it('serializes replacement after an edit whose write is already in flight', async () => {
  const demo = { ...createPage('Demo content'), updatedAt: 0 }, edited = { ...demo, title: 'User edit', updatedAt: Date.now() + 100 };
  let resume!: () => void, stored = demo;
  const gate = new Promise<void>(r => { resume = r; });
  const writer = new PagePersistence(async p => { if (p === edited) await gate; stored = p; }, vi.fn());
  writer.schedule(edited);
  const saving = writer.flush(), replacing = writer.replace(demo, edited);
  expect(writer.resolve(demo, edited).title).toBe('Demo content');
  resume(); await saving;
  const replacement = await replacing;
  expect(stored).toBe(replacement);
  expect(writer.resolve(demo, edited)).toBe(replacement);
});

it('does not replace a pending or saved edit with the stale drawer snapshot', async () => {
  vi.useFakeTimers();
  const write = vi.fn(async () => {}), writer = new PagePersistence(write, vi.fn());
  const stale = { ...createPage('Old'), updatedAt: 1 }, edited = { ...stale, title: 'Edited', updatedAt: 2 };
  writer.schedule(edited);
  expect(writer.resolve(stale, edited)).toBe(edited);
  writer.schedule(stale);
  await writer.flush();
  expect(write.mock.calls).toEqual([[edited]]);
  expect(writer.resolve(stale, null)).toBe(edited);
  writer.schedule(stale);
  await writer.flush();
  expect(write.mock.calls).toEqual([[edited]]);
});

it('debounces each page independently and writes its latest snapshot', async () => {
  vi.useFakeTimers();
  const write = vi.fn(async () => {}), error = vi.fn();
  const writer = new PagePersistence(write, error);
  const first = createPage('First'), second = createPage('Second');
  writer.schedule(first); writer.schedule(second);
  const edited = { ...first, title: 'Edited' };
  writer.schedule(edited);
  await vi.advanceTimersByTimeAsync(399);
  expect(write).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(write.mock.calls).toEqual([[second], [edited]]);
  expect(error).not.toHaveBeenCalled();
});

it('flushes immediately once and cancels deleted pages', async () => {
  vi.useFakeTimers();
  const write = vi.fn(async () => {}), writer = new PagePersistence(write, vi.fn());
  const first = createPage('First'), second = createPage('Second');
  writer.schedule(first); writer.schedule(second); writer.cancel(second.id);
  await writer.flush(); await writer.flush();
  await vi.runAllTimersAsync();
  expect(write.mock.calls).toEqual([[first]]);
});

it('does not postpone a pending write when the same snapshot is scheduled again', async () => {
  vi.useFakeTimers();
  const write = vi.fn(async () => {}), writer = new PagePersistence(write, vi.fn());
  const page = createPage('First'); writer.schedule(page);
  await vi.advanceTimersByTimeAsync(300); writer.schedule(page);
  await vi.advanceTimersByTimeAsync(100);
  expect(write).toHaveBeenCalledWith(page);
});

it('handles an empty flush and reports failed writes', async () => {
  const failure = new Error('Storage unavailable'), write = vi.fn(async () => { throw failure; }), error = vi.fn();
  const writer = new PagePersistence(write, error);
  await writer.flush(); expect(write).not.toHaveBeenCalled();
  writer.schedule(createPage('First')); await writer.flush();
  expect(error).toHaveBeenCalledWith(failure);
});
