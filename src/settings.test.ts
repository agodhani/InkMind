import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, migrateSettings } from './settings';

describe('migrateSettings', () => {
  it('defaults to mock when nothing is stored', () => {
    expect(migrateSettings({}).provider).toBe('mock');
  });
  it('keeps pre-provider users with a key on openrouter', () => {
    expect(migrateSettings({ openRouterApiKey: 'sk-or-x' }).provider).toBe('openrouter');
  });
  it('respects an explicit provider and fills defaults', () => {
    const s = migrateSettings({ provider: 'ollama' });
    expect(s.provider).toBe('ollama');
    expect(s.ollamaUrl).toBe(DEFAULT_SETTINGS.ollamaUrl);
    expect(s.ollamaModel).toBe(DEFAULT_SETTINGS.ollamaModel);
  });
});
