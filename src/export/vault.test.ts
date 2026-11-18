import { expect, it } from 'vitest';
import { buildVault, crc32, zipFiles } from './vault';
import { pageToMarkdown } from './markdown';
import { largeDemoPages } from '../sim/kbDemo';
import { buildGraph } from '../kb/graph';
import { extractPage } from '../kb/extract';

it('exports grouped concept links, aliases and valid page block sources without changing markdown', () => {
  const pages = largeDemoPages(3); pages[0].title = '../unsafe/title';
  const before = pageToMarkdown(pages[0]), graph = buildGraph(pages.map(p => extractPage(p, { glossary: [] })));
  graph.concepts[0].aliases = ['Alias: "quoted"'];
  const files = buildVault(pages, graph), concept = files.find(f => f.path.startsWith('Concepts/'))!;
  expect(concept.content).toContain('aliases: ["Alias: \\"quoted\\""]');
  expect(concept.content).toContain('## mentions'); expect(concept.content).toContain('#^block-1|');
  expect(files.find(f => f.path.startsWith('Pages/'))!.content).toContain(' ^block-1');
  expect(pageToMarkdown(pages[0])).toBe(before);
  const duplicate = { ...pages[0], id: 'duplicate' };
  expect(new Set(buildVault([...pages, duplicate], graph).map(f => f.path.toLowerCase())).size).toBe(files.length + 1);
  expect(buildVault([], { concepts: [], edges: [] })).toEqual([]);
});
it('writes store-only ZIP local/central headers, UTF-8 content and correct CRC32', () => {
  const files = [{ path: 'Concepts/知识.md', content: 'hello π' }, { path: 'empty.md', content: '' }], bytes = zipFiles(files), view = new DataView(bytes.buffer), decoder = new TextDecoder();
  let offset = 0;
  for (const file of files) {
    expect(view.getUint32(offset, true)).toBe(0x04034b50);
    expect(view.getUint16(offset + 8, true)).toBe(0);
    const length = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true), dataStart = offset + 30 + nameLength;
    expect(decoder.decode(bytes.slice(offset + 30, dataStart))).toBe(file.path);
    const data = bytes.slice(dataStart, dataStart + length);
    expect(decoder.decode(data)).toBe(file.content); expect(view.getUint32(offset + 14, true)).toBe(crc32(data));
    offset = dataStart + length;
  }
  expect(view.getUint32(offset, true)).toBe(0x02014b50);
  expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
  expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  expect(zipFiles([])).toHaveLength(22);
  expect(() => zipFiles([{ path: 'a'.repeat(65536), content: '' }])).toThrow('filename');
});
