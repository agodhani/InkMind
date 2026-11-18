import { sortBlocksForReading } from '../model/page';
import type { Page } from '../model/page';
import { figureEndpointLabel, mindMapLayout, vennLayout } from '../views/figureView';
import type { MindMapBranch } from '../views/figureView';
import type { ConceptEdgeKind, PageExtraction, Provenance } from './model';
import { isConceptLabel, scanTerms, splitParenAlias, termKey } from './normalize';

export function extractPage(page: Page, { glossary }: { glossary: string[] }): PageExtraction {
  const result: PageExtraction = { pageId: page.id, extractor: 'deterministic', terms: [], relations: [], texts: [] };
  const sections: { term: string; level: number }[] = [];
  for (const block of sortBlocksForReading(page.blocks)) {
    const prov = (extractor: string, surface: string, strokeIds: string[] = []): Provenance => ({ pageId: page.id, blockId: block.id, extractor, surface, strokeIds });
    const term = (surface: string, extractor: string, strokes: string[] = [], aliases: string[] = []) => {
      const split = splitParenAlias(surface);
      if (!isConceptLabel(split.term)) return;
      const existing = result.terms.find(t => termKey(t.term) === termKey(split.term) && t.prov.blockId === block.id && t.prov.extractor === extractor);
      if (existing) {
        existing.aliases = [...new Set([...(existing.aliases ?? []), ...split.aliases, ...aliases])];
        existing.prov.strokeIds = [...new Set([...existing.prov.strokeIds, ...strokes])];
      } else result.terms.push({ term: split.term, aliases: [...split.aliases, ...aliases], prov: prov(extractor, split.term, strokes), defines: true });
    };
    const relation = (from: string, to: string, kind: ConceptEdgeKind, extractor: string, strokes: string[] = [], label?: string) => {
      from = splitParenAlias(from).term;
      to = splitParenAlias(to).term;
      if (!isConceptLabel(from) || !isConceptLabel(to) || termKey(from) === termKey(to)) return;
      const p = prov(extractor, label ?? to, strokes);
      const existing = result.relations.find(r => termKey(r.from) === termKey(from) && termKey(r.to) === termKey(to) && r.kind === kind && r.label === label && r.prov.blockId === block.id && r.prov.extractor === extractor);
      if (existing) existing.prov.strokeIds = [...new Set([...existing.prov.strokeIds, ...strokes])];
      else result.relations.push({ from, to, kind, ...(label ? { label } : {}), prov: p });
    };
    let headingKeys: Set<string> | undefined;
    if (block.kind === 'heading') {
      const heading = block.text.replace(/^\s*(?:#+\s*|\d+[.)]\s*)+/, '').replace(/:\s*$/, '').trim();
      const level = block.level ?? 2;
      while (sections.length && sections.at(-1)!.level >= level) sections.pop();
      term(heading, 'det:heading', block.strokeIds);
      const split = splitParenAlias(heading);
      headingKeys = new Set([split.term, ...split.aliases].map(termKey));
      if (sections.length) relation(sections.at(-1)!.term, heading, 'contains', 'det:heading', block.strokeIds);
      sections.push({ term: splitParenAlias(heading).term, level });
    }
    const section = sections.at(-1)?.term;
    result.texts.push({ blockId: block.id, text: block.text, ...(section ? { section } : {}) });
    for (const match of block.text.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
      term(match[1].trim(), 'det:link', [], match[2] ? [match[2].trim()] : []);
      if (section) relation(section, match[1].trim(), 'mentions', 'det:link');
    }
    const candidates = glossary.flatMap(entry => {
      const split = splitParenAlias(entry);
      return [split.term, ...split.aliases].map(s => ({ key: termKey(s), value: entry }));
    });
    for (const { value: entry, surface } of scanTerms(block.text, candidates, headingKeys)) {
      const split = splitParenAlias(entry);
      term(entry, 'det:glossary');
      const mention = result.terms.find(t => termKey(t.term) === termKey(split.term) && t.prov.blockId === block.id && t.prov.extractor === 'det:glossary');
      if (mention) mention.prov.surface = surface;
      if (section) relation(section, split.term, 'mentions', 'det:glossary');
    }
    const fig = block.figure;
    if (!fig || ['plot', 'sketch', 'cube', 'shape'].includes(fig.kind)) continue;
    const label = (value: string) => figureEndpointLabel(fig, value);
    const nodeTerm = (value: string) => {
      const text = label(value), node = fig.nodes?.find(n => n.id === value || n.label === text);
      term(text, 'det:figure', node?.strokeIds ?? fig.edges.find(e => e.label === text)?.strokeIds);
    };
    const edge = (index: number) => {
      const e = fig.edges[index];
      if (e.kind === 'self-loop') return;
      nodeTerm(e.from); nodeTerm(e.to);
      relation(label(e.from), label(e.to), fig.kind === 'tree' ? 'contains' : e.kind === 'line' ? 'mentions' : 'follows', 'det:figure', e.strokeIds, e.label);
    };
    if (fig.kind === 'table') {
      fig.cells?.[0]?.filter(Boolean).forEach(nodeTerm);
      if (fig.cells?.[0]?.[0] === '') fig.cells.slice(1).forEach(row => { if (row[0]) nodeTerm(row[0]); });
      continue;
    }
    fig.nodes?.forEach(n => nodeTerm(n.id));
    const venn = vennLayout(fig.nodes ?? []);
    if (venn) {
      venn.sets.forEach(set => set.members.forEach(member => relation(set.node.label, member.label, 'contains', 'det:figure', member.strokeIds)));
      continue;
    }
    if (fig.kind === 'mindmap') {
      const layout = mindMapLayout(fig);
      if (layout) {
        nodeTerm(layout.hub);
        const branch = (parent: string, child: MindMapBranch) => {
          nodeTerm(child.label);
          const e = fig.edges.find(e => [label(e.from), label(e.to)].includes(parent) && [label(e.from), label(e.to)].includes(child.label));
          relation(parent, child.label, 'contains', 'det:figure', e?.strokeIds);
          child.children.forEach(c => branch(child.label, c));
        };
        layout.spokes.forEach(child => branch(layout.hub, child));
        const other = (child: MindMapBranch) => { nodeTerm(child.label); child.children.forEach(c => branch(child.label, c)); };
        layout.other.forEach(other);
        layout.remainingEdges.forEach(edge);
      }
    } else {
      if (fig.kind !== 'sequence') fig.edges.forEach((_, i) => edge(i));
      fig.nodes?.forEach(n => [...new Set([...(n.parents ?? []), ...(n.parent ? [n.parent] : [])])].forEach(parent => relation(label(parent), n.label, 'contains', 'det:figure', n.strokeIds)));
    }
    const steps = fig.sequence ?? [];
    steps.forEach(nodeTerm);
    steps.slice(1).forEach((step, i) => relation(label(steps[i]), label(step), 'follows', 'det:figure', fig.edges[fig.sequenceEdges?.[i + 1] ?? -1]?.strokeIds));
    if (!fig.nodes?.length && !fig.edges.length && !steps.length && fig.kind !== 'mindmap') fig.labels.forEach(nodeTerm);
  }
  return result;
}
