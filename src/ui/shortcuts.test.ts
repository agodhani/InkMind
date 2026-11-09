import { describe, expect, it } from 'vitest';
import { formatShortcut, isEditableTarget, matchesShortcut, SHORTCUTS } from './shortcuts';

const key = (k: string, mods: Partial<{ ctrl: boolean; meta: boolean; shift: boolean; alt: boolean }> = {}) => ({
  key: k,
  ctrlKey: !!mods.ctrl,
  metaKey: !!mods.meta,
  shiftKey: !!mods.shift,
  altKey: !!mods.alt,
});

describe('shortcuts', () => {
  it('formats for Windows/Linux and macOS', () => {
    expect(formatShortcut(SHORTCUTS.redo, false)).toBe('Ctrl+Shift+Z');
    expect(formatShortcut(SHORTCUTS.redo, true)).toBe('⌘⇧Z');
    expect(formatShortcut(SHORTCUTS.transcribe, false)).toBe('Ctrl+Enter');
    expect(formatShortcut(SHORTCUTS.pen, true)).toBe('P');
    expect(formatShortcut(SHORTCUTS.escape, false)).toBe('Esc');
  });

  it('matches letters case-insensitively and treats meta like ctrl', () => {
    expect(matchesShortcut(key('P'), SHORTCUTS.pen)).toBe(true);
    expect(matchesShortcut(key('p', { ctrl: true }), SHORTCUTS.pen)).toBe(false);
    expect(matchesShortcut(key('z', { meta: true }), SHORTCUTS.undo)).toBe(true);
    expect(matchesShortcut(key('Z', { ctrl: true, shift: true }), SHORTCUTS.redo)).toBe(true);
    expect(matchesShortcut(key('Z', { ctrl: true, shift: true }), SHORTCUTS.undo)).toBe(false);
    expect(matchesShortcut(key('Enter', { ctrl: true }), SHORTCUTS.transcribe)).toBe(true);
    expect(matchesShortcut(key('Enter'), SHORTCUTS.transcribe)).toBe(false);
  });

  it('detects text fields so single-letter shortcuts stay quiet while typing', () => {
    expect(isEditableTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'BUTTON', isContentEditable: false } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
