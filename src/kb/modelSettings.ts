import type { AppSettings } from '../settings';
import { modelExtractor, ollamaKbModel, openRouterKbModel } from './modelExtractor';
import type { Extractor } from './extractor';

export function configuredKbExtractor(settings: AppSettings): Extractor | undefined {
  if (!settings.modelConceptExtraction || settings.provider === 'mock') return;
  return modelExtractor(settings.provider === 'ollama'
    ? ollamaKbModel({ url: settings.ollamaUrl })
    : openRouterKbModel(settings.openRouterApiKey));
}
