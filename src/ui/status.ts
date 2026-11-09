import type { TranscriptionStatus } from '../transcribe/useTranscription';

export type StatusTone = 'idle' | 'off' | 'waiting' | 'running' | 'error';

/** Pure: collapse the transcription hook's status + settings into what the pill shows. */
export function describeStatus(status: TranscriptionStatus, live: boolean, providerLabel: string): { tone: StatusTone; text: string; detail: string } {
  if (status.state === 'running') {
    const n = status.pendingRegions;
    return { tone: 'running', text: n > 1 ? `Transcribing ${n} regions…` : 'Transcribing…', detail: `${providerLabel} is reading your ink` };
  }
  // The hook reschedules right after a failure (state flips error → waiting), so key the error UI off lastError,
  // which only clears on a successful run. Keeps the Retry action visible until something actually succeeds.
  if (status.state === 'error' || status.lastError) {
    const retrying = status.state === 'waiting' ? ' · retrying shortly' : '';
    return { tone: 'error', text: 'Transcription failed', detail: `${status.lastError ?? 'Unknown error'}${retrying}` };
  }
  if (status.state === 'waiting') return { tone: 'waiting', text: 'Waiting for pause…', detail: 'Lift the pen for a second to transcribe' };
  if (!live) return { tone: 'off', text: 'Live transcription off', detail: 'Use Transcribe now or turn it on in Settings' };
  const secs = status.lastDurationMs ? ` in ${(status.lastDurationMs / 1000).toFixed(1)} s` : '';
  return { tone: 'idle', text: 'Up to date', detail: status.lastModel ? `${status.lastModel}${secs}` : providerLabel };
}
