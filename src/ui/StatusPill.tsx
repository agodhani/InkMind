import type { TranscriptionStatus } from '../transcribe/useTranscription';
import { Icon } from './icons';
import { describeStatus } from './status';

export function StatusPill({ status, live, providerLabel, onRetry, compact }: { status: TranscriptionStatus; live: boolean; providerLabel: string; onRetry: () => void; compact?: boolean }) {
  const d = describeStatus(status, live, providerLabel);
  return (
    <div className={`status-pill ${d.tone} ${compact ? 'compact' : ''}`} role="status" aria-live="polite" data-tip={`${d.text} · ${d.detail}`} data-tip-placement="bottom">
      {d.tone === 'running' ? <Icon name="spinner" size={14} /> : d.tone === 'error' ? <Icon name="alert" size={14} /> : <span className="status-dot" />}
      <span className="status-text">{d.text}</span>
      {d.tone === 'error' && (
        <button type="button" className="btn status-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
