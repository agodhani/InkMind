import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_KEY = 'inkmind.theme';

export function isThemePreference(v: unknown): v is ThemePreference {
  return v === 'system' || v === 'light' || v === 'dark';
}

/** Pure: what the UI should render given the saved preference and the OS setting. */
export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light';
  return pref;
}

/** Cycle used by the toolbar toggle: follow the OS, then force the opposite of what is showing. */
export function nextThemePreference(pref: ThemePreference, systemPrefersDark: boolean): ThemePreference {
  const showing = resolveTheme(pref, systemPrefersDark);
  if (pref === 'system') return showing === 'dark' ? 'light' : 'dark';
  return 'system';
}

export function readThemePreference(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): ThemePreference {
  try {
    const raw = storage?.getItem(THEME_KEY);
    return isThemePreference(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#17171a' : '#fbfaf7';
}

export function useTheme() {
  const [pref, setPrefState] = useState<ThemePreference>(() => readThemePreference());
  const [systemDark, setSystemDark] = useState(() => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)').matches : false));

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const theme = resolveTheme(pref, systemDark);
  useEffect(() => applyTheme(theme), [theme]);

  const setPref = useCallback((p: ThemePreference) => {
    setPrefState(p);
    try {
      localStorage.setItem(THEME_KEY, p);
    } catch {
      /* private mode */
    }
  }, []);
  const toggle = useCallback(() => setPref(nextThemePreference(pref, systemDark)), [pref, systemDark, setPref]);

  return { pref, theme, setPref, toggle };
}
