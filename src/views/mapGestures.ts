export interface MapCamera { x: number; y: number; zoom: number }
export interface MapLabel { id: string; label: string; x: number; y: number; degree: number }
export function visibleLabels(nodes: MapLabel[], camera: MapCamera, size: { width: number; height: number }, required: string[] = []): Set<string> {
  const visible = new Set<string>();
  const boxes: { left: number; top: number; right: number; bottom: number }[] = [];
  const forced = new Set(required);
  const limit = Math.max(8, Math.round(size.width * size.height / 20000)) * Math.max(1, camera.zoom * camera.zoom);
  for (const node of [...nodes].sort((a, b) => Number(forced.has(b.id)) - Number(forced.has(a.id)) || b.degree - a.degree || a.id.localeCompare(b.id))) {
    const x = node.x * camera.zoom + camera.x, y = node.y * camera.zoom + camera.y - 24;
    const half = node.label.length * 3.6 + 6;
    const box = { left: x - half, right: x + half, top: y - 13, bottom: y + 5 };
    if (!forced.has(node.id) && (visible.size >= limit || box.left < 4 || box.right > size.width - 4 || box.top < 4 || box.bottom > size.height - 4 || boxes.some(b => box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top))) continue;
    visible.add(node.id); boxes.push(box);
  }
  return visible;
}
export function zoomAt(camera: MapCamera, point: { x: number; y: number }, factor: number): MapCamera {
  const zoom = Math.max(0.25, Math.min(4, camera.zoom * factor));
  const ratio = zoom / camera.zoom;
  return { x: point.x - (point.x - camera.x) * ratio, y: point.y - (point.y - camera.y) * ratio, zoom };
}
