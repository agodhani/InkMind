import { afterEach, expect, it, vi } from 'vitest';
import { createPage } from '../model/page';
import { PagePersistence } from './pagePersistence';

afterEach(() => vi.useRealTimers());

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
