import { describe, expect, it } from 'vitest';
import { nextThemePreference, readThemePreference, resolveTheme } from './theme';

describe('theme', () => {
  it('follows the OS when preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('toggle forces the opposite of what is showing, then returns to system', () => {
    expect(nextThemePreference('system', false)).toBe('dark');
    expect(nextThemePreference('system', true)).toBe('light');
    expect(nextThemePreference('dark', false)).toBe('system');
    expect(nextThemePreference('light', true)).toBe('system');
  });

  it('reads only valid preferences from storage', () => {
    expect(readThemePreference({ getItem: () => 'dark' })).toBe('dark');
    expect(readThemePreference({ getItem: () => 'purple' })).toBe('system');
    expect(readThemePreference({ getItem: () => null })).toBe('system');
    expect(
      readThemePreference({
        getItem: () => {
          throw new Error('denied');
        },
      }),
    ).toBe('system');
  });
});
