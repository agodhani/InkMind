import { expect, it } from 'vitest';
import { buildVault, crc32, zipFiles } from './vault';
import { pageToMarkdown } from './markdown';
import { largeDemoPages } from '../sim/kbDemo';
import { buildGraph } from '../kb/graph';
import { extractPage } from '../kb/extract';
import { applyDecisions, emptyDecisions, renameConcept } from '../kb/decisions';

it('keeps original concept labels as aliases when vault filenames are sanitized', () => {
  const page = largeDemoPages(1)[0];
  page.blocks[0].text = '[[Model: Free]]';
  page.blocks[0].kind = 'paragraph';
  const graph = buildGraph([extractPage(page, { glossary: [] })]);
  const files = buildVault([page], graph);
  expect(files.find(f => f.path === 'Concepts/Model- Free.md')!.content).toContain('aliases: ["Model: Free"]');
  expect(files.find(f => f.path.startsWith('Pages/'))!.content).toContain('[[Model- Free|Model: Free]]');
});

it('rewrites resolved labels and aliases to existing concept filenames without changing display text or source markdown', () => {
  const page = largeDemoPages(1)[0];
  page.blocks = [{ ...page.blocks[0], kind: 'paragraph', text: '[[Model: Free]] [[Gradient Descent|GD]]' }];
  const raw = buildGraph([extractPage(page, { glossary: [] })]);
  const graph = applyDecisions(raw, renameConcept(emptyDecisions(), 'Gradient Descent', 'Gradient method'));
  page.blocks[0].text = '[[Model: Free]] [[Model: Free|Free model]] [[GD]] [[ gd |Keep this text]] [[Gradient Descent]] [[Gradient method]] [[Unknown]] [[Unknown|Unresolved text]]';
  const before = pageToMarkdown(page), files = buildVault([page], graph), note = files.find(f => f.path.startsWith('Pages/'))!.content;
  for (const link of ['[[Model- Free|Model: Free]]', '[[Model- Free|Free model]]', '[[Gradient method|GD]]', '[[Gradient method|Keep this text]]', '[[Gradient method|Gradient Descent]]']) expect(note).toContain(link);
  expect(note).toContain('[[Gradient method]]');
  expect(note).toContain('[[Unknown]] [[Unknown|Unresolved text]]');
  for (const target of ['Model- Free', 'Gradient method']) expect(files.some(f => f.path === `Concepts/${target}.md`)).toBe(true);
  expect(pageToMarkdown(page)).toBe(before);
});

it('keeps fences, display math, lists and tables intact with standalone source refs', () => {
  const page = largeDemoPages(1)[0];
  const texts = ['```mermaid\ngraph TD\nA --> B\n```', '$$\nx = y\n$$', '- Alpha\n- Beta', '| A | B |\n| --- | --- |\n| 1 | 2 |', 'Following paragraph'];
  page.blocks = texts.map((text, i) => ({ ...page.blocks[0], id: `b${i}`, kind: i === 1 ? 'math' : 'paragraph', text, bbox: { left: 0, right: 600, top: i * 40, bottom: i * 40 + 30 } }));
  const graph = buildGraph([extractPage(page, { glossary: [] })]);
  graph.concepts.push({ id: 'source', label: 'Source', aliases: [], provenance: page.blocks.map(b => ({ pageId: page.id, blockId: b.id, strokeIds: [], extractor: 'test', surface: b.text })) });
  const files = buildVault([page], graph), note = files.find(f => f.path.startsWith('Pages/'))!.content;
  for (let i = 0; i < texts.length - 1; i++) {
    expect(note).toContain(`${texts[i]}\n\n^block-${i + 1}\n`);
    expect(files.find(f => f.path === 'Concepts/Source.md')!.content).toContain(`#^block-${i + 1}|`);
  }
  expect(note).toContain('Following paragraph');
  page.blocks = [{ ...page.blocks[0], kind: 'diagram', text: '', figure: { kind: 'flowchart', shapes: [], labels: ['A', 'B'], edges: [{ from: 'A', to: 'B' }] } }, page.blocks.at(-1)!];
  const diagram = buildVault([page], graph).find(f => f.path.startsWith('Pages/'))!.content;
  expect(diagram).toContain('```mermaid');
  expect(diagram).toContain('```\n\n^block-1\n\nFollowing paragraph');
});

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
