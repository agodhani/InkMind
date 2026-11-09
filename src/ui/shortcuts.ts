/** Keyboard shortcut helpers shared by the toolbar (labels) and the global key handler. */

export interface ShortcutDef {
  /** `KeyboardEvent.key`, compared case-insensitively for letters. */
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export const SHORTCUTS = {
  pen: { key: 'p' },
  eraser: { key: 'e' },
  pan: { key: 'h' },
  viewInk: { key: '1' },
  viewSplit: { key: '2' },
  viewDigital: { key: '3' },
  undo: { key: 'z', ctrl: true },
  redo: { key: 'z', ctrl: true, shift: true },
  transcribe: { key: 'Enter', ctrl: true },
  smaller: { key: '[' },
  larger: { key: ']' },
  pages: { key: 'o', ctrl: true },
  settings: { key: ',', ctrl: true },
  toggleTheme: { key: 'd', ctrl: true, shift: true },
  escape: { key: 'Escape' },
} as const satisfies Record<string, ShortcutDef>;

export type ShortcutName = keyof typeof SHORTCUTS;

export function isMacPlatform(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /Mac|iPhone|iPad|iPod/.test(ua);
}

const KEY_LABELS: Record<string, string> = { Enter: 'Enter', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ' ': 'Space' };

/** Human label such as "Ctrl+Shift+Z" or "⌘⇧Z". */
export function formatShortcut(def: ShortcutDef, mac = isMacPlatform()): string {
  const key = KEY_LABELS[def.key] ?? (def.key.length === 1 ? def.key.toUpperCase() : def.key);
  if (mac) return `${def.ctrl ? '⌘' : ''}${def.alt ? '⌥' : ''}${def.shift ? '⇧' : ''}${key}`;
  const parts: string[] = [];
  if (def.ctrl) parts.push('Ctrl');
  if (def.alt) parts.push('Alt');
  if (def.shift) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function matchesShortcut(e: KeyLike, def: ShortcutDef): boolean {
  const wantCtrl = !!def.ctrl;
  if ((e.ctrlKey || e.metaKey) !== wantCtrl) return false;
  if (!!def.shift !== e.shiftKey) return false;
  if (!!def.alt !== e.altKey) return false;
  return def.key.length === 1 ? e.key.toLowerCase() === def.key.toLowerCase() : e.key === def.key;
}

/** True when the key press belongs to a text field, so single-letter shortcuts must not fire. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== 'string') return false;
  const el = target as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return el.isContentEditable === true;
}
