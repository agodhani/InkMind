import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { clamp } from './format';
import { ratioFromPointer, readSplitRatio, SPLIT_KEY, SPLIT_MAX, SPLIT_MIN } from './splitPane';

export function SplitPane({ a, b, vertical, labelA = 'Ink', labelB = 'Digital' }: { a: ReactNode; b: ReactNode; vertical: boolean; labelA?: string; labelB?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(readSplitRatio);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SPLIT_KEY, String(ratio));
    } catch {
      /* ignore */
    }
  }, [ratio]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(true);
      const move = (ev: PointerEvent) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        setRatio(vertical ? ratioFromPointer(ev.clientY, rect.top, rect.height) : ratioFromPointer(ev.clientX, rect.left, rect.width));
      };
      const up = () => {
        setDragging(false);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    [vertical],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setRatio((r) => clamp(r - step, SPLIT_MIN, SPLIT_MAX));
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setRatio((r) => clamp(r + step, SPLIT_MIN, SPLIT_MAX));
    else if (e.key === 'Home') setRatio(SPLIT_MIN);
    else if (e.key === 'End') setRatio(SPLIT_MAX);
    else if (e.key === 'Enter') setRatio(0.5);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={ref} className={`split ${vertical ? 'vertical' : ''} ${dragging ? 'dragging' : ''}`} style={{ '--split-a': `${ratio}fr`, '--split-b': `${1 - ratio}fr` } as React.CSSProperties}>
      <section className="pane ink-pane" aria-label={labelA}>
        {a}
      </section>
      <div
        className="divider"
        role="separator"
        aria-orientation={vertical ? 'horizontal' : 'vertical'}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={SPLIT_MIN * 100}
        aria-valuemax={SPLIT_MAX * 100}
        aria-label={`Resize ${labelA} and ${labelB} panes`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onDoubleClick={() => setRatio(0.5)}
        onKeyDown={onKeyDown}
        data-tip="Drag to resize · double-tap to reset"
      >
        <span className="grip" />
      </div>
      <section className="pane digital-pane" aria-label={labelB}>
        {b}
      </section>
    </div>
  );
}
