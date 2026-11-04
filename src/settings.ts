import { DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_URL } from './transcribe/ollama';
import type { TranscriptionScope } from './transcribe/useTranscription';

export type TranscriberProvider = 'mock' | 'ollama' | 'openrouter';

export interface AppSettings {
  provider: TranscriberProvider;
  openRouterApiKey: string;
  visionModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  habits: string[];
  glossary: string[];
  liveTranscription: boolean;
  scope: TranscriptionScope;
}

const KEY = 'inkmind.settings.v1';

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'mock',
  openRouterApiKey: '',
  visionModel: 'google/gemma-4-31b-it:free',
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
  habits: [],
  glossary: [],
  liveTranscription: true,
  scope: 'page',
};

/** Fill defaults and pick a provider for settings saved before `provider` existed. */
export function migrateSettings(raw: Partial<AppSettings>): AppSettings {
  const s = { ...DEFAULT_SETTINGS, ...raw };
  if (!raw.provider) s.provider = s.openRouterApiKey ? 'openrouter' : 'mock';
  return s;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const envKey = import.meta.env.VITE_OPENROUTER_API_KEY ?? '';
      return migrateSettings(envKey ? { openRouterApiKey: envKey } : {});
    }
    return migrateSettings(JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
