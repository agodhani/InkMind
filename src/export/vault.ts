import type { Page } from '../model/page';
import { sortBlocksForReading } from '../model/page';
import type { KbGraph } from '../kb/model';
import { groupLinks } from '../kb/mapView';
import { pageToMarkdown } from './markdown';

export interface VaultFile { path: string; content: string }
function names(items: { id: string; label: string }[]): Map<string, string> {
  const used = new Set<string>(), result = new Map<string, string>();
  for (const item of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    const base = [...item.label.normalize('NFKC')].map(c => c.charCodeAt(0) < 32 || '<>:"/\\|?*[]#^'.includes(c) ? '-' : c).join('').replace(/[. ]+$/g, '').trim() || 'Untitled';
    let name = base, i = 2;
    while (used.has(name.toLowerCase())) name = `${base} (${i++})`;
    used.add(name.toLowerCase()); result.set(item.id, name);
  }
  return result;
}
export function buildVault(pages: Page[], graph: KbGraph): VaultFile[] {
  const pageNames = names(pages.map(p => ({ id: p.id, label: p.title }))), conceptNames = names(graph.concepts);
  const refs = new Map<string, Map<string, string>>();
  const files: VaultFile[] = pages.map(page => {
    const blocks = sortBlocksForReading(page.blocks), ids = new Map(blocks.map((b, i) => [b.id, `block-${i + 1}`]));
    refs.set(page.id, ids);
    const header = pageToMarkdown(page, []);
    const body = blocks.map(b => {
      const markdown = pageToMarkdown(page, [b]).slice(header.trimEnd().length).trim();
      const structured = b.kind === 'diagram' || b.kind === 'math' || /\n|^(?:[-*+] |\d+\. |\|)/.test(markdown);
      return markdown + `${structured ? '\n\n' : ' '}^${ids.get(b.id)}`;
    }).join('\n\n');
    return { path: `Pages/${pageNames.get(page.id)}.md`, content: `${header}\n${body}\n` };
  });
  for (const c of graph.concepts) {
    const lines = ['---', `aliases: ${JSON.stringify(c.aliases)}`, '---', '', `# ${c.label}`, ''];
    for (const [kind, links] of Object.entries(groupLinks(graph, c.id))) {
      if (!links.outgoing.length && !links.incoming.length) continue;
      lines.push(`## ${kind}`, '');
      for (const direction of ['outgoing', 'incoming'] as const) for (const link of links[direction]) {
        lines.push(`- [[Concepts/${conceptNames.get(link.concept.id)}|${link.concept.label}]] (${direction})`);
      }
      lines.push('');
    }
    lines.push('## Sources', '');
    const sources = new Set<string>();
    for (const p of c.provenance) {
      const name = pageNames.get(p.pageId), block = refs.get(p.pageId)?.get(p.blockId);
      if (name && block) sources.add(`- [[Pages/${name}#^${block}|${name}]]`);
    }
    lines.push(...sources);
    files.push({ path: `Concepts/${conceptNames.get(c.id)}.md`, content: lines.join('\n') + '\n' });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function zipFiles(files: VaultFile[]): Uint8Array {
  if (files.length > 65535) throw new Error('ZIP64 is not supported');
  const encoder = new TextEncoder();
  const entries = files.map(f => ({ name: encoder.encode(f.path), data: encoder.encode(f.content) }));
  let localSize = 0, centralSize = 0;
  for (const e of entries) {
    if (e.name.length > 65535) throw new Error('ZIP filename too long');
    localSize += 30 + e.name.length + e.data.length; centralSize += 46 + e.name.length;
  }
  if (localSize + centralSize + 22 > 0xffffffff) throw new Error('ZIP64 is not supported');
  const out = new Uint8Array(localSize + centralSize + 22), view = new DataView(out.buffer);
  const u16 = (at: number, n: number) => view.setUint16(at, n, true), u32 = (at: number, n: number) => view.setUint32(at, n, true);
  let offset = 0, central = localSize;
  for (const e of entries) {
    const crc = crc32(e.data);
    u32(offset, 0x04034b50); u16(offset + 4, 20); u16(offset + 6, 0x800); u16(offset + 12, 33);
    u32(offset + 14, crc); u32(offset + 18, e.data.length); u32(offset + 22, e.data.length); u16(offset + 26, e.name.length);
    out.set(e.name, offset + 30); out.set(e.data, offset + 30 + e.name.length);
    u32(central, 0x02014b50); u16(central + 4, 20); u16(central + 6, 20); u16(central + 8, 0x800); u16(central + 14, 33);
    u32(central + 16, crc); u32(central + 20, e.data.length); u32(central + 24, e.data.length); u16(central + 28, e.name.length); u32(central + 42, offset);
    out.set(e.name, central + 46);
    offset += 30 + e.name.length + e.data.length; central += 46 + e.name.length;
  }
  u32(central, 0x06054b50); u16(central + 8, files.length); u16(central + 10, files.length); u32(central + 12, centralSize); u32(central + 16, localSize);
  return out;
}
