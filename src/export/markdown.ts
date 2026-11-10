import type { DigitalBlock, Page } from '../model/page';
import { sortBlocksForReading } from '../model/page';

/**
 * Obsidian-compatible Markdown. Diagrams become image embeds pointing at
 * `<page-id>/<block-id>.png`; footnotes use standard [^marker] syntax.
 */
export function pageToMarkdown(page: Page, blocks: DigitalBlock[] = page.blocks): string {
  const ordered = sortBlocksForReading(blocks);
  const defs = ordered.filter((b) => b.kind === 'footnote_def');
  const body: string[] = [];
  body.push('---', `id: ${page.id}`, `title: ${JSON.stringify(page.title)}`, `updated: ${new Date(page.updatedAt).toISOString()}`, 'source: inkmind', '---', '');
  body.push(`# ${page.title}`, '');
  for (const b of ordered) {
    switch (b.kind) {
      case 'footnote_def':
        continue;
      case 'heading': {
        const level = Math.min(3, Math.max(1, (b.level ?? 2))) + 1;
        body.push(`${'#'.repeat(level)} ${b.text.replace(/^#+\s*/, '')}`, '');
        break;
      }
      case 'diagram':
        body.push(`![[${page.id}/${b.id}.png]]`, b.text ? `*${b.text}*` : '', ...figureLines(b), '');
        break;
      case 'footnote_ref':
        body.push(`${b.text}${b.marker ? `[^${footnoteKey(b.marker)}]` : ''}`, '');
        break;
      case 'math':
        body.push(b.text.includes('$') ? b.text : `$$\n${b.text}\n$$`, '');
        break;
      case 'margin_note':
        body.push(`> ${b.text.split('\n').join('\n> ')}`, '');
        break;
      default:
        body.push(b.text, '');
    }
  }
  if (defs.length) {
    body.push('');
    for (const d of defs) body.push(`[^${footnoteKey(d.marker ?? '*')}]: ${d.text}`);
  }
  return body.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** Labels and relations of a diagram block, as Markdown lines under the image embed. */
export function figureLines(b: DigitalBlock): string[] {
  const fig = b.figure;
  if (!fig) return [];
  const lines: string[] = [];
  if (fig.labels.length) lines.push(`Labels: ${fig.labels.map((l) => `\`${l}\``).join(', ')}`);
  if (fig.edges.length) lines.push(...fig.edges.map((e) => `- ${e.from} → ${e.to}${e.label ? ` (${e.label})` : ''}`));
  return lines;
}

export function footnoteKey(marker: string): string {
  const map: Record<string, string> = { '*': 'star', '**': 'star2', '†': 'dagger', '‡': 'ddagger', '§': 'section' };
  if (map[marker]) return map[marker];
  const digits = marker.replace(/[^\p{N}\p{L}]/gu, '');
  return digits || 'note';
}
