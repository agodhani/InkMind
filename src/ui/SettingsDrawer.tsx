import { useEffect, useState } from 'react';
import type { Correction } from '../profile/handwritingProfile';
import type { AppSettings, TranscriberProvider } from '../settings';
import { DEFAULT_OLLAMA_MODEL, OLLAMA_VISION_MODELS, probeOllama, type OllamaStatus } from '../transcribe/ollama';
import { openRouterKeyHint, plural, urlHint } from './format';
import { Icon, type IconName } from './icons';
import { Drawer, Field, Section, Segmented, Switch } from './primitives';
import type { ThemePreference } from './theme';

const OLLAMA_REPROBE_MS = 5000;

const OPENROUTER_MODELS = [
  'dots-studio/dots-3-note-preview:free',
  'nvidia/nemotron-3.5-super-vl:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'openai/gpt-4o',
  'anthropic/claude-sonnet-4',
];

const PROVIDERS: { value: TranscriberProvider; title: string; blurb: string; badge: string; badgeTone: string; icon: IconName }[] = [
  { value: 'ollama', title: 'Ollama (local)', blurb: 'Runs on your computer. Private, offline, free.', badge: 'Free', badgeTone: 'ok', icon: 'monitor' },
  { value: 'openrouter', title: 'OpenRouter', blurb: 'Cloud models with a key; “:free” models cost nothing.', badge: 'Free tier', badgeTone: 'accent', icon: 'sparkles' },
  { value: 'mock', title: 'Mock', blurb: 'Placeholder text, no model. Good for trying the ink ↔ digital flow.', badge: 'Demo', badgeTone: '', icon: 'info' },
];

export interface SettingsDrawerProps {
  open: boolean;
  settings: AppSettings;
  corrections: Correction[];
  themePref: ThemePreference;
  onThemePref: (p: ThemePreference) => void;
  onChange: (s: AppSettings) => void;
  onClose: () => void;
  onClearCorrections: () => Promise<void>;
  onShowTips: () => void;
}

export function SettingsDrawer({ open, settings, corrections, themePref, onThemePref, onChange, onClose, onClearCorrections, onShowTips }: SettingsDrawerProps) {
  return (
    <Drawer open={open} side="right" title="Settings" onClose={onClose} width={460}>
      {open && <SettingsBody settings={settings} corrections={corrections} themePref={themePref} onThemePref={onThemePref} onChange={onChange} onClearCorrections={onClearCorrections} onShowTips={onShowTips} />}
    </Drawer>
  );
}

function SettingsBody({ settings, corrections, themePref, onThemePref, onChange, onClearCorrections, onShowTips }: Omit<SettingsDrawerProps, 'open' | 'onClose'>) {
  const [habits, setHabits] = useState(settings.habits.join('\n'));
  const [glossary, setGlossary] = useState(settings.glossary.join(', '));
  const [probed, setProbed] = useState<{ url: string; status: OllamaStatus } | null>(null);
  const [probeTick, setProbeTick] = useState(0);

  useEffect(() => {
    if (settings.provider !== 'ollama' || urlHint(settings.ollamaUrl)) return;
    const ctrl = new AbortController();
    const url = settings.ollamaUrl;
    const run = () => void probeOllama(url, ctrl.signal).then((status) => !ctrl.signal.aborted && setProbed({ url, status }));
    const t = window.setTimeout(run, 300);
    const every = window.setInterval(run, OLLAMA_REPROBE_MS);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(every);
      ctrl.abort();
    };
  }, [settings.provider, settings.ollamaUrl, probeTick]);

  const ollama = probed?.url === settings.ollamaUrl ? probed.status : undefined;
  const commitText = () =>
    onChange({
      ...settings,
      habits: habits.split('\n').map((s) => s.trim()).filter(Boolean),
      glossary: glossary.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
    });
  const keyHint = openRouterKeyHint(settings.openRouterApiKey);
  const ollamaUrlHint = urlHint(settings.ollamaUrl);
  const recent = [...corrections].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  return (
    <>
      <Section title="Transcriber" icon="sparkles" description="Which vision model reads your ink. Free options first.">
        <div className="provider-grid" role="radiogroup" aria-label="Transcriber provider">
          {PROVIDERS.map((p) => (
            <button key={p.value} type="button" role="radio" aria-checked={settings.provider === p.value} className={`provider-card ${settings.provider === p.value ? 'is-active' : ''}`} onClick={() => onChange({ ...settings, provider: p.value })}>
              <span className="provider-icon">
                <Icon name={p.icon} />
              </span>
              <span className="provider-text">
                <strong>{p.title}</strong>
                <small>{p.blurb}</small>
              </span>
              <span className={`badge ${p.badgeTone}`}>{p.badge}</span>
            </button>
          ))}
        </div>

        {settings.provider === 'ollama' && (
          <>
            <Field label="Ollama URL" htmlFor="ollama-url" error={ollamaUrlHint} hint="The app talks to Ollama straight from this browser. On a tablet, point this at your computer's LAN address (see README).">
              <input id="ollama-url" value={settings.ollamaUrl} onChange={(e) => onChange({ ...settings, ollamaUrl: e.target.value.trim() })} placeholder="http://localhost:11434" inputMode="url" autoCapitalize="off" spellCheck={false} />
            </Field>
            <Field label="Vision model" htmlFor="ollama-model" hint="qwen2.5vl:7b reads messy handwriting best; 3b is faster on CPU.">
              <input id="ollama-model" list="ollama-models" value={settings.ollamaModel} onChange={(e) => onChange({ ...settings, ollamaModel: e.target.value.trim() })} autoCapitalize="off" spellCheck={false} />
              <datalist id="ollama-models">
                {[...new Set([...(ollama?.models ?? []), ...OLLAMA_VISION_MODELS])].map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              {(ollama?.models.length ?? 0) > 0 && (
                <div className="chip-row" aria-label="Installed vision models">
                  {ollama!.models.map((m) => (
                    <button key={m} type="button" className={`chip ${m === settings.ollamaModel ? 'is-active' : ''}`} onClick={() => onChange({ ...settings, ollamaModel: m })}>
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <OllamaStatusRow status={ollama} settings={settings} pending={!ollamaUrlHint && ollama === undefined} onRecheck={() => setProbeTick((n) => n + 1)} />
          </>
        )}

        {settings.provider === 'openrouter' && (
          <>
            <Field
              label="OpenRouter API key"
              htmlFor="or-key"
              error={keyHint}
              hint={
                <>
                  Stored only in this browser. Get one at{' '}
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
                    openrouter.ai/keys
                  </a>
                  .
                </>
              }
            >
              <input id="or-key" type="password" value={settings.openRouterApiKey} onChange={(e) => onChange({ ...settings, openRouterApiKey: e.target.value.trim() })} placeholder="sk-or-…" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Vision model" htmlFor="or-model" hint="Models ending in “:free” cost nothing. dots-3-note-preview reads notes well; Gemini/GPT/Claude are paid.">
              <input id="or-model" list="or-models" value={settings.visionModel} onChange={(e) => onChange({ ...settings, visionModel: e.target.value.trim() })} autoCapitalize="off" spellCheck={false} />
              <datalist id="or-models">
                {OPENROUTER_MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <div className="chip-row">
                {OPENROUTER_MODELS.filter((m) => m.endsWith(':free')).map((m) => (
                  <button key={m} type="button" className={`chip ${m === settings.visionModel ? 'is-active' : ''}`} onClick={() => onChange({ ...settings, visionModel: m })}>
                    {m.replace(':free', '')} <span aria-hidden="true">· free</span>
                  </button>
                ))}
              </div>
            </Field>
            {!settings.openRouterApiKey && (
              <div className="model-status warn">
                <span className="status-dot" />
                <span className="model-text">No key yet — the mock transcriber runs until you add one.</span>
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="Live transcription" icon="refresh">
        <Switch checked={settings.liveTranscription} onChange={(v) => onChange({ ...settings, liveTranscription: v })} label="Transcribe while I write" description="After about a second of pause, the page is sent to the model." />
        <Field label="What gets sent after a pause" htmlFor="scope" hint={settings.scope === 'page' ? 'Best accuracy: vision models need the whole page for context.' : 'Cheaper, but small crops starve the model of context on messy writing.'}>
          <select id="scope" value={settings.scope} onChange={(e) => onChange({ ...settings, scope: e.target.value as AppSettings['scope'] })}>
            <option value="page">Whole page</option>
            <option value="region">Only the lines I changed</option>
          </select>
        </Field>
      </Section>

      <Section title="Handwriting profile" icon="pen" description="Sent with every transcription so the model knows how you write.">
        <Field label="Habits (one per line)" htmlFor="habits">
          <textarea id="habits" rows={4} value={habits} onChange={(e) => setHabits(e.target.value)} onBlur={commitText} placeholder={'I write footnotes with * and define them at the bottom of the page\nMy 7s have a cross bar\nI use → to mean "leads to"'} />
        </Field>
        <Field label="Glossary (terms you write often)" htmlFor="glossary" hint="Comma-separated. Words the model gets wrong are added here automatically from your corrections.">
          <textarea id="glossary" rows={2} value={glossary} onChange={(e) => setGlossary(e.target.value)} onBlur={commitText} placeholder="RLHF, PPO, minimax, backprop" />
        </Field>
      </Section>

      <Section title="Corrections dataset" icon="edit" description="Every block you fix in the Digital view is saved as ink crop + your text. Recent ones are sent as examples; the dataset is what a per-user fine-tune will train on.">
        <div className="stat-row">
          <div>
            <strong>{corrections.length}</strong> <small>{plural(corrections.length, 'correction').replace(/^\d+ /, '')} captured</small>
          </div>
          <div className="stat-actions">
            <button
              type="button"
              className="btn"
              disabled={!corrections.length}
              onClick={() => {
                const blob = new Blob([JSON.stringify(corrections, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'inkmind-corrections.json';
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              <Icon name="download" size={16} /> Export
            </button>
            <button type="button" className="btn tone-danger" disabled={!corrections.length} onClick={() => window.confirm(`Delete all ${corrections.length} corrections? This cannot be undone.`) && void onClearCorrections()}>
              Clear
            </button>
          </div>
        </div>
        {recent.length > 0 && (
          <div className="corrections">
            {recent.map((c) => (
              <div key={c.id} className="correction">
                {c.imageDataUrl ? (
                  <img src={c.imageDataUrl} alt="" />
                ) : (
                  <div className="no-img">
                    <Icon name="pen" size={16} />
                  </div>
                )}
                <div>
                  <s>{c.modelText}</s>
                  <div className="fixed">{c.userText}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Appearance" icon="sun">
        <div className="theme-row">
          <Segmented<ThemePreference>
            label="Theme"
            value={themePref}
            onChange={onThemePref}
            options={[
              { value: 'system', label: 'System', icon: 'monitor' },
              { value: 'light', label: 'Light', icon: 'sun' },
              { value: 'dark', label: 'Dark', icon: 'moon' },
            ]}
          />
        </div>
        <button type="button" className="btn" onClick={onShowTips}>
          <Icon name="info" size={16} /> Show the welcome tips again
        </button>
      </Section>
    </>
  );
}

function OllamaStatusRow({ status, settings, pending, onRecheck }: { status: OllamaStatus | undefined; settings: AppSettings; pending: boolean; onRecheck: () => void }) {
  let tone = 'pending';
  let text: React.ReactNode = 'Checking Ollama…';
  if (!pending && status) {
    if (!status.reachable) {
      tone = 'danger';
      text = (
        <>
          Can't reach Ollama at <code>{settings.ollamaUrl}</code> ({status.error}). Install from{' '}
          <a href="https://ollama.com/download" target="_blank" rel="noreferrer">
            ollama.com
          </a>
          , then <code>ollama pull {settings.ollamaModel}</code>. If the app is not on localhost, start Ollama with <code>OLLAMA_ORIGINS="{window.location.origin}"</code>.
        </>
      );
    } else if (status.models.includes(settings.ollamaModel)) {
      tone = 'ok';
      text = (
        <>
          Connected · <strong>{settings.ollamaModel}</strong> ready · {plural(status.models.length, 'vision model')} installed.
        </>
      );
    } else if (status.textOnly.includes(settings.ollamaModel)) {
      tone = 'warn';
      text = (
        <>
          <code>{settings.ollamaModel}</code> is text-only and can't read ink. Pick a vision model above or run <code>ollama pull {DEFAULT_OLLAMA_MODEL}</code>.
        </>
      );
    } else {
      tone = 'warn';
      text = (
        <>
          Connected, but <code>{settings.ollamaModel}</code> is not pulled. Run <code>ollama pull {settings.ollamaModel}</code>
          {status.models.length ? ' or pick an installed model above.' : '.'}
        </>
      );
    }
  }
  return (
    <div className={`model-status ${tone}`} role="status">
      <span className="status-dot" />
      <span className="model-text">{text}</span>
      <button type="button" className="btn" onClick={onRecheck} aria-label="Re-check Ollama">
        <Icon name="refresh" size={14} /> Re-check
      </button>
    </div>
  );
}
