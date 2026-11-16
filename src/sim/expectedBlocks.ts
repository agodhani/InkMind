import type { DigitalBlock, FigureKind } from '../model/page';
import { buildStrokeGroups, strokesBounds } from '../transcribe/regions';
import { figureFromGeometry } from '../ink/shapeHints';
import { expectedNodeShapes, expectedTableCells, type Scene } from './scenes';

export function expectedBlocks(scene: Scene, idMap: Map<string, string>): DigitalBlock[] {
  const mapped = (ids: string[]) => ids.map(id => idMap.get(id) ?? id);
  const blocks: DigitalBlock[] = scene.figures.map(f => {
    const kind: FigureKind = f.type.includes('flowchart') || f.type === 'state-machine' ? 'flowchart'
      : f.type === 'mind-map' ? 'mindmap' : f.type.includes('tree') ? 'tree'
      : f.type === 'timeline' || f.type === 'sequence-diagram' ? 'sequence'
      : f.type === 'table' ? 'table' : f.type === 'graph-crossing' ? 'graph' : f.type.includes('graph') || f.type.includes('plot') || f.type.startsWith('bar-') ? 'plot'
      : f.type.includes('cube') || f.type === 'box-3d' ? 'cube' : 'shape';
    const shapes = expectedNodeShapes(f);
    const strokes = scene.strokes.filter(s => f.strokeIds.includes(s.id));
    const groups = buildStrokeGroups(strokes);
    const geometry = [...new Set(groups.flatMap(g => g.figure ? [g.figure] : []))].flatMap(fig => figureFromGeometry(fig, () => undefined, groups).nodes ?? []);
    const nodeIds = (label: string) => {
      if (f.nodeStrokeIds?.[label]?.length) return mapped(f.nodeStrokeIds[label]);
      const textIds = f.labelStrokeIds?.[label] ?? [];
      const node = geometry.map(node => ({ node, overlap: node.strokeIds?.filter(id => textIds.includes(id)).length ?? 0 }))
        .filter(hit => hit.overlap > 0).sort((a, b) => b.overlap - a.overlap)[0]?.node;
      return mapped([...new Set([...(node?.strokeIds ?? []), ...textIds])]);
    };
    return {
      id: `expected-${mapped(f.strokeIds)[0] ?? f.id}`, kind: 'diagram', text: `${f.description}. ${f.labels.join(', ')}`,
      bbox: { ...f.bbox }, strokeIds: mapped(f.strokeIds), confidence: 1,
      figure: {
        kind, shapes: shapes.size ? [...new Set(shapes.values())] : [f.type === 'table' ? 'rectangle' : f.type], labels: [...f.labels],
        nodes: f.nodes?.map(label => ({ id: label, label, strokeIds: nodeIds(label), shape: shapes.get(label), parent: f.contains?.find(c => c.inner === label)?.outer })),
        edges: (f.edges ?? []).map(e => ({ ...e, ...(e.strokeIds ? { strokeIds: mapped(e.strokeIds) } : {}), kind: e.from === e.to ? 'self-loop' : f.directed === false ? 'line' : 'arrow' })),
        sequence: f.type !== 'table' && f.sequence ? [...f.sequence] : undefined,
        cells: f.type === 'table' ? expectedTableCells(f.labels) : undefined,
      },
    };
  });
  if (scene.text.trim()) {
    const figureIds = new Set(scene.figures.flatMap(f => f.strokeIds));
    const strokes = scene.strokes.filter(s => !figureIds.has(s.id));
    blocks.push({ id: `expected-text-${mapped(strokes.map(s => s.id))[0] ?? scene.seed}`, kind: 'paragraph', text: scene.text, bbox: strokesBounds(strokes) ?? { left: 0, top: 0, right: scene.width, bottom: scene.height }, strokeIds: mapped(strokes.map(s => s.id)), confidence: 1 });
  }
  return blocks;
}
