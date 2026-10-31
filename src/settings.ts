export interface AppSettings {
  openRouterApiKey: string;
  visionModel: string;
  habits: string[];
  glossary: string[];
  liveTranscription: boolean;
}

const KEY = 'inkmind.settings.v1';

export const DEFAULT_SETTINGS: AppSettings = {
  openRouterApiKey: '',
  visionModel: 'google/gemini-2.5-flash',
  habits: [],
  glossary: [],
  liveTranscription: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY ?? '' };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
