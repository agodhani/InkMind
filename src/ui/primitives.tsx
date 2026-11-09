import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Icon, type IconName } from './icons';

/* ---------- IconButton: 40px tap target, aria-label, tooltip from `label` + optional shortcut ---------- */

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  label: string;
  shortcut?: string;
  active?: boolean;
  tone?: 'default' | 'primary' | 'danger';
  /** Render the label next to the icon (text button). */
  showLabel?: boolean;
  tipPlacement?: 'top' | 'bottom';
  tipAlign?: 'start' | 'center' | 'end';
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({ icon, label, shortcut, active, tone = 'default', showLabel, tipPlacement = 'bottom', tipAlign = 'center', className, ...rest }: IconButtonProps) {
  const tip = shortcut ? `${label} · ${shortcut}` : label;
  return (
    <button
      type="button"
      aria-label={showLabel ? undefined : label}
      aria-pressed={active === undefined ? undefined : active}
      data-tip={tip}
      data-tip-placement={tipPlacement}
      data-tip-align={tipAlign === 'center' ? undefined : tipAlign}
      className={['btn', showLabel ? 'btn-text' : 'btn-icon', `tone-${tone}`, active ? 'is-active' : '', className ?? ''].filter(Boolean).join(' ')}
      {...rest}
    >
      <Icon name={icon} />
      {showLabel && <span className="btn-label">{label}</span>}
    </button>
  );
}

/* ---------- Segmented control ---------- */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  shortcut?: string;
  /** Hide the text and show only the icon (label still used for aria/tooltip). */
  iconOnly?: boolean;
}

export function Segmented<T extends string>({ value, options, onChange, label, size = 'md' }: { value: T; options: SegmentOption<T>[]; onChange: (v: T) => void; label: string; size?: 'sm' | 'md' }) {
  return (
    <div className={`seg seg-${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.iconOnly ? o.label : undefined}
          data-tip={o.iconOnly || o.shortcut ? `${o.label}${o.shortcut ? ` · ${o.shortcut}` : ''}` : undefined}
          className={o.value === value ? 'is-active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} />}
          {!o.iconOnly && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Switch ---------- */

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className="switch-row">
      <div className="switch-text">
        <label htmlFor={id}>{label}</label>
        {description && <small>{description}</small>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
        <span className="switch-knob" />
      </button>
    </div>
  );
}

/* ---------- Popover: anchored below the trigger, closes on outside pointer / Escape ---------- */

export function Popover({ open, onClose, anchorRef, children, label, align = 'start' }: { open: boolean; onClose: () => void; anchorRef: React.RefObject<HTMLElement | null>; children: ReactNode; label: string; align?: 'start' | 'end' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number; flip: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a) return;
      const below = a.bottom + 8;
      const flip = below + 240 > window.innerHeight && a.top > 260;
      const top = flip ? a.top - 8 : below;
      setPos(align === 'start' ? { top, left: Math.max(8, a.left), flip } : { top, right: Math.max(8, window.innerWidth - a.right), flip });
    };
    place();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
    };
  }, [open, onClose, anchorRef, align]);

  if (!open || !pos) return null;
  return (
    <div ref={ref} className={`popover ${pos.flip ? 'flip' : ''}`} role="dialog" aria-label={label} style={{ top: pos.top, left: pos.left, right: pos.right }}>
      {children}
    </div>
  );
}

/* ---------- Drawer: side sheet with scrim, Escape to close, focus moved in and restored ---------- */

export function Drawer({ open, side, title, onClose, children, actions, width }: { open: boolean; side: 'left' | 'right'; title: string; onClose: () => void; children: ReactNode; actions?: ReactNode; width?: number }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const previous = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    previous.current = document.activeElement;
    const first = bodyRef.current?.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])');
    (first ?? bodyRef.current)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      (previous.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={`drawer drawer-${side}`} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={bodyRef} className="drawer-body" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} style={width ? { width: `min(${width}px, 94vw)` } : undefined}>
        <header className="drawer-head">
          <h2 id={titleId}>{title}</h2>
          <div className="drawer-actions">
            {actions}
            <IconButton icon="close" label="Close" onClick={onClose} tipAlign="end" />
          </div>
        </header>
        <div className="drawer-content">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Small helpers ---------- */

export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? (
        <small className="field-error" role="alert">
          <Icon name="alert" size={14} /> {error}
        </small>
      ) : hint ? (
        <small className="field-hint">{hint}</small>
      ) : null}
    </div>
  );
}

export function Section({ title, description, children, icon }: { title: string; description?: ReactNode; children: ReactNode; icon?: IconName }) {
  return (
    <section className="section">
      <header className="section-head">
        {icon && <Icon name={icon} size={18} />}
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </header>
      <div className="section-body">{children}</div>
    </section>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
