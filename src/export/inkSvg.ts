import type { DigitalBlock, Page } from '../model/page';
import { colorToRGBA, getStrokeBoundingBox, StockBrush } from '../types/brush';

export function blockInkSvg(page: Page, block: DigitalBlock): string | null {
  const ids = new Set(block.strokeIds);
  const strokes = page.strokes.filter(s => ids.has(s.id) && s.inputs.inputs.length && s.inputs.inputs.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)) && Number.isFinite(s.brush.size) && s.brush.size > 0);
  if (!strokes.length) return null;
  const bounds = strokes.map(s => getStrokeBoundingBox(s)!);
  const left = Math.min(...bounds.map(b => b.left)) - 2, top = Math.min(...bounds.map(b => b.top)) - 2;
  const width = Math.max(...bounds.map(b => b.right)) + 2 - left, height = Math.max(...bounds.map(b => b.bottom)) + 2 - top;
  const lines = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}" width="${width}" height="${height}">`, '<title>Original ink</title>'];
  for (const s of strokes) {
    const { r, g, b, a } = colorToRGBA(s.brush.color), color = `rgb(${r},${g},${b})`, points = s.inputs.inputs;
    const size = s.brush.size * (s.brush.stockBrush === StockBrush.PENCIL ? 0.8 : 1);
    const pressure = (p: typeof points[number]) => Number.isFinite(p.pressure) ? Math.min(1, Math.max(0, p.pressure!)) : 1;
    lines.push(`<g opacity="${a}"${s.brush.stockBrush === StockBrush.HIGHLIGHTER ? ' style="mix-blend-mode:multiply"' : ''}>`);
    if (points.length === 1 || points.some(p => p.pressure !== undefined)) {
      for (let i = 1; i < points.length; i++) {
        const p = points[i - 1], q = points[i];
        lines.push(`<path d="M ${p.x} ${p.y} L ${q.x} ${q.y}" fill="none" stroke="${color}" stroke-width="${size * (pressure(p) + pressure(q)) / 2}" stroke-linecap="round"/>`);
      }
      for (const p of points) lines.push(`<circle cx="${p.x}" cy="${p.y}" r="${size * pressure(p) / 2}" fill="${color}"/>`);
    } else lines.push(`<polyline points="${points.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${size}" stroke-linecap="round" stroke-linejoin="round"/>`);
    lines.push('</g>');
  }
  return [...lines, '</svg>'].join('\n');
}
