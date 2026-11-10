import { useRef, useState } from 'react';
import { Icon } from './icons';
import { Popover } from './primitives';
import { BRUSH_MAX, BRUSH_MIN, BRUSH_SIZES, INK_COLORS } from './brush';

export function BrushPicker({ color, size, onColor, onSize, shortcutHint }: { color: string; size: number; onColor: (c: string) => void; onSize: (n: number) => void; shortcutHint?: string }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const dot = Math.max(3, Math.min(14, size * 1.8));
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={`btn brush-trigger ${open ? 'is-active' : ''}`}
        aria-label="Pen colour and size"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tip={`Colour & size${shortcutHint ? ` · ${shortcutHint}` : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="swatch" style={{ background: color }} />
        <span className="swatch-size" aria-hidden="true">
          <i style={{ width: dot, height: dot }} />
        </span>
        <Icon name="chevron-down" size={14} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} label="Pen colour and size">
        <div className="brush-popover">
          <div className="brush-preview" aria-hidden="true">
            <svg viewBox="0 0 240 44" preserveAspectRatio="none">
              <path d="M8 30 C 40 6, 60 38, 90 22 S 140 6, 170 24 S 210 40, 232 16" fill="none" stroke={color} strokeWidth={size * 1.6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h4>Colour</h4>
            <div className="swatches" role="radiogroup" aria-label="Ink colour">
              {INK_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={c.value.toLowerCase() === color.toLowerCase()}
                  aria-label={c.label}
                  className={c.value.toLowerCase() === color.toLowerCase() ? 'is-active' : ''}
                  style={{ '--c': c.value } as React.CSSProperties}
                  onClick={() => onColor(c.value)}
                >
                  {c.value.toLowerCase() === color.toLowerCase() && <Icon name="check" size={16} />}
                </button>
              ))}
              <label className="custom" aria-label="Custom colour" data-tip="Custom colour">
                <input type="color" value={color} onChange={(e) => onColor(e.target.value)} />
              </label>
            </div>
          </div>
          <div>
            <h4>Size</h4>
            <div className="sizes" role="radiogroup" aria-label="Pen size">
              {BRUSH_SIZES.map((s) => (
                <button key={s.value} type="button" role="radio" aria-checked={Math.abs(s.value - size) < 0.01} aria-label={s.label} className={Math.abs(s.value - size) < 0.01 ? 'is-active' : ''} data-tip={s.label} onClick={() => onSize(s.value)}>
                  <i style={{ width: 4 + s.value * 2, height: 4 + s.value * 2 }} />
                </button>
              ))}
            </div>
            <input type="range" min={BRUSH_MIN} max={BRUSH_MAX} step={0.5} value={size} aria-label="Pen size" onChange={(e) => onSize(Number(e.target.value))} />
          </div>
        </div>
      </Popover>
    </>
  );
}
