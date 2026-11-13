import type { DigitalBlock, Page } from '../model/page';
import { sortBlocksForReading } from '../model/page';
import { edgeText, nodeTree } from '../transcribe/figure';
import { figureToMermaid, mindMapLayout } from '../views/figureView';

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

/**
 * Labels, table cells, nested shapes, step order and relations of a diagram block, as Markdown
 * lines under the image embed (a table, an indented list, a numbered list, a bullet list).
 */
export function figureLines(b: DigitalBlock): string[] {
  const fig = b.figure;
  if (!fig) return [];
  const lines: string[] = [];
  const mermaid = figureToMermaid(fig);
  if (fig.labels.length && !fig.nodes?.length && !mermaid) lines.push(`Labels: ${fig.labels.map((l) => `\`${l}\``).join(', ')}`);
  if (fig.cells?.length) {
    const cell = (s: string) => s.replace(/\|/g, '\\|').trim();
    const [head, ...rows] = fig.cells;
    lines.push('', `| ${head.map(cell).join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`), '');
  }
  if (fig.nodes?.length && fig.kind !== 'mindmap') lines.push(...nodeTree(fig.nodes).map(({ node, depth }) => `${'  '.repeat(depth)}- ${node.label}${node.shape ? ` (${node.shape})` : ''}`));
  if (fig.sequence?.length) lines.push(...fig.sequence.map((step, i) => `${i + 1}. ${step}`), '');
  const map = fig.kind === 'mindmap' ? mindMapLayout(fig) : null;
  if (map) {
    lines.push(`- ${map.hub}`);
    for (const spoke of map.spokes) lines.push(`  - ${spoke.label}`, ...spoke.children.map(child => `    - ${child}`));
  } else if (fig.edges.length) lines.push(...fig.edges.map((e) => `- ${edgeText(e)}${e.inferred ? ' *(from ink geometry)*' : ''}`));
  if (mermaid) lines.push('', '```mermaid', mermaid, '```');
  return lines;
}

export function footnoteKey(marker: string): string {
  const map: Record<string, string> = { '*': 'star', '**': 'star2', '†': 'dagger', '‡': 'ddagger', '§': 'section' };
  if (map[marker]) return map[marker];
  const digits = marker.replace(/[^\p{N}\p{L}]/gu, '');
  return digits || 'note';
}
