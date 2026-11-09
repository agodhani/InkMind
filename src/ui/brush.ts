export const INK_COLORS: { value: string; label: string }[] = [
  { value: '#1b1b1f', label: 'Ink black' },
  { value: '#4b4b53', label: 'Graphite' },
  { value: '#2f6fe4', label: 'Blue' },
  { value: '#c93c3c', label: 'Red' },
  { value: '#1f9d6a', label: 'Green' },
  { value: '#c0661a', label: 'Orange' },
  { value: '#7c3aed', label: 'Violet' },
  { value: '#0e7490', label: 'Teal' },
  { value: '#be185d', label: 'Magenta' },
  { value: '#a16207', label: 'Ochre' },
  { value: '#1e3a5f', label: 'Navy' },
];

export const BRUSH_SIZES: { value: number; label: string }[] = [
  { value: 1.5, label: 'Fine' },
  { value: 2.5, label: 'Regular' },
  { value: 4, label: 'Bold' },
  { value: 6, label: 'Marker' },
];

export const BRUSH_MIN = 1;
export const BRUSH_MAX = 10;

/** Pure: step the brush size with the `[` / `]` shortcuts, snapping to presets when possible. */
export function stepBrushSize(size: number, dir: 1 | -1): number {
  const presets = BRUSH_SIZES.map((s) => s.value);
  const next = dir > 0 ? presets.find((p) => p > size + 1e-6) : [...presets].reverse().find((p) => p < size - 1e-6);
  if (next !== undefined) return next;
  return Math.min(BRUSH_MAX, Math.max(BRUSH_MIN, size + dir));
}
