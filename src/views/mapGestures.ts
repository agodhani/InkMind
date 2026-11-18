import { MAP_NODE_BOX, mapNodeRadius, type Position } from '../kb/mapView';

export interface MapCamera { x: number; y: number; zoom: number }
export interface MapLabel { id: string; label: string; x: number; y: number; degree: number }
export interface MapBox { left: number; top: number; right: number; bottom: number }
export interface PlacedLabel { text: string; x: number; y: number; box: MapBox }
export function boxesOverlap(a: MapBox, b: MapBox): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
export function fitCamera(positions: Position[], size: { width: number; height: number }, margin = 40): MapCamera {
  if (!positions.length) return { x: size.width / 2, y: size.height / 2, zoom: 1 };
  const left = Math.min(...positions.map(p => p.x)) - MAP_NODE_BOX / 2, right = Math.max(...positions.map(p => p.x)) + MAP_NODE_BOX / 2;
  const top = Math.min(...positions.map(p => p.y)) - MAP_NODE_BOX / 2, bottom = Math.max(...positions.map(p => p.y)) + MAP_NODE_BOX / 2;
  const zoom = Math.min(1.5, Math.max(1, size.width - margin * 2) / (right - left), Math.max(1, size.height - margin * 2) / (bottom - top));
  return { x: (size.width - (left + right) * zoom) / 2, y: (size.height - (top + bottom) * zoom) / 2, zoom };
}
export function screenNodeBox(node: MapLabel, camera: MapCamera, focused = false): MapBox {
  const x = node.x * camera.zoom + camera.x, y = node.y * camera.zoom + camera.y;
  const radius = mapNodeRadius(node.degree, focused) * camera.zoom + Math.max(3, 2 * camera.zoom);
  return { left: x - radius, right: x + radius, top: y - radius, bottom: y + radius };
}
export function placeLabels(nodes: MapLabel[], camera: MapCamera, size: { width: number; height: number }, required: string[] = [], neighbours: string[] = []): Map<string, PlacedLabel> {
  const labels = new Map<string, PlacedLabel>(), boxes: MapBox[] = [];
  const priority = (id: string) => required.includes(id) ? required.indexOf(id) : neighbours.includes(id) ? required.length : required.length + 1;
  const nodeBoxes = nodes.map(n => screenNodeBox(n, camera, required.includes(n.id)));
  const limit = Math.max(8, Math.round(size.width * size.height / 11000)) * Math.max(1, camera.zoom * camera.zoom);
  for (const node of [...nodes].sort((a, b) => priority(a.id) - priority(b.id) || b.degree - a.degree || a.id.localeCompare(b.id))) {
    if (!required.includes(node.id) && !neighbours.includes(node.id) && (labels.size >= limit || (node.degree < 2 && camera.zoom < 0.8))) continue;
    const text = camera.zoom < 1.2 && !required.includes(node.id) && node.label.length > 24 ? `${node.label.slice(0, 23)}…` : node.label;
    const width = text.length * 8 + 8, height = 20;
    const x = node.x * camera.zoom + camera.x, y = node.y * camera.zoom + camera.y;
    const gap = mapNodeRadius(node.degree, required.includes(node.id)) * camera.zoom + 8;
    const candidates = [{ x: x - width / 2, y: y - gap - height }, { x: x + gap, y: y - height / 2 }, { x: x - width / 2, y: y + gap }, { x: x - gap - width, y: y - height / 2 }];
    for (const p of candidates) {
      const box = { left: p.x, right: p.x + width, top: p.y, bottom: p.y + height };
      if (box.left < 4 || box.right > size.width - 4 || box.top < 4 || box.bottom > size.height - 4 || [...boxes, ...nodeBoxes].some(b => boxesOverlap(box, b))) continue;
      labels.set(node.id, { text, x: (box.left + box.right) / 2, y: box.top + 14, box }); boxes.push(box); break;
    }
  }
  return labels;
}
export function visibleLabels(nodes: MapLabel[], camera: MapCamera, size: { width: number; height: number }, required: string[] = []): Set<string> {
  return new Set(placeLabels(nodes, camera, size, required).keys());
}
export function zoomAt(camera: MapCamera, point: { x: number; y: number }, factor: number): MapCamera {
  const zoom = Math.max(0.05, Math.min(4, camera.zoom * factor));
  const ratio = zoom / camera.zoom;
  return { x: point.x - (point.x - camera.x) * ratio, y: point.y - (point.y - camera.y) * ratio, zoom };
}
