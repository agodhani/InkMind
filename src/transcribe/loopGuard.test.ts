import { describe, expect, it } from 'vitest';
import { closeJsonPrefix, detectLoop } from './loopGuard';

describe('loop guard', () => {
  const prefix = '{"blocks":[{"kind":"diagram","figure":{';
  it.each([
    '"shapes":[' + '"box", '.repeat(12),
    '"labels":["' + 'a cube / 3D box inside '.repeat(12),
    '"groupIndices":[' + Array.from({ length: 80 }, (_, i) => i + 1).join(', '),
  ])('cuts and closes a looping prefix: %s', (tail) => {
    const raw = prefix + tail;
    const loop = detectLoop(raw)!;
    expect(loop).toBeDefined();
    const repaired = JSON.parse(closeJsonPrefix(raw.slice(0, loop.keepUntil)));
    expect(repaired.blocks[0].kind).toBe('diagram');
    expect(closeJsonPrefix(raw.slice(0, loop.keepUntil)).length).toBeLessThan(raw.length);
  });
  it.each(['', '"box", "box", "box"', JSON.stringify({ labels: Array.from({ length: 80 }, (_, i) => `label ${i}`) }), '[3, 1, 4, 8, 2, 9]', '[] '.repeat(20)])('does not guard legitimate content: %s', (raw) => {
    expect(detectLoop(raw)).toBeUndefined();
  });
  it('repairs strings and drops incomplete trailing keys or literals', () => {
    expect(JSON.parse(closeJsonPrefix('{"text":"brace } and escaped \\"quote'))).toEqual({ text: 'brace } and escaped "quote' });
    expect(JSON.parse(closeJsonPrefix('{"blocks":[],"unfinished":tru'))).toEqual({ blocks: [] });
    expect(JSON.parse(closeJsonPrefix('{"blocks":[],"unfinished'))).toEqual({ blocks: [] });
    expect(closeJsonPrefix('{"blocks":[]}')).toBe('{"blocks":[]}');
    expect(JSON.parse(closeJsonPrefix('[{"kind":"diagram"'))).toEqual([{ kind: 'diagram' }]);
    expect(closeJsonPrefix('')).toBe('');
  });
});
