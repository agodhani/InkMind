import { OpenAICompatTranscriber } from './openaiCompat';

export { normaliseBlocks } from './openaiCompat';
export const DEFAULT_VISION_MODEL = 'google/gemini-2.5-flash';
const BASE_URL = 'https://openrouter.ai/api/v1';

export interface OpenRouterOptions {
  apiKey: string;
  model?: string;
  siteUrl?: string;
  siteName?: string;
}

export class OpenRouterTranscriber extends OpenAICompatTranscriber {
  constructor(opts: OpenRouterOptions) {
    const headers: Record<string, string> = {};
    if (opts.siteUrl) headers['HTTP-Referer'] = opts.siteUrl;
    if (opts.siteName) headers['X-Title'] = opts.siteName;
    super({ provider: 'openrouter', baseUrl: BASE_URL, model: opts.model ?? DEFAULT_VISION_MODEL, apiKey: opts.apiKey, headers });
  }
}
