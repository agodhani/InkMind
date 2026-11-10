import { Icon } from './icons';
import { IconButton } from './primitives';

export function Onboarding({ onClose, onChooseModel }: { onClose: () => void; onChooseModel: () => void }) {
  return (
    <div className="onboarding-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <header>
          <div>
            <h2 id="onboarding-title">Write by hand. Read it as text.</h2>
            <p>Three things to know before your first page.</p>
          </div>
          <IconButton icon="close" label="Dismiss" onClick={onClose} className="ghost" />
        </header>
        <ol>
          <li>
            <span className="step-icon">
              <Icon name="split" />
            </span>
            <div>
              <strong>Ink on the left, digital on the right</strong>
              <p>Pause for about a second and your handwriting becomes headings, lists, math — and diagrams stay as your own ink. Tap a block to see which strokes made it.</p>
            </div>
          </li>
          <li>
            <span className="step-icon">
              <Icon name="edit" />
            </span>
            <div>
              <strong>Double-tap a block to correct it</strong>
              <p>Every fix is remembered as an example of how you write, so the model gets better at reading you.</p>
            </div>
          </li>
          <li>
            <span className="step-icon">
              <Icon name="sparkles" />
            </span>
            <div>
              <strong>Pick a free model</strong>
              <p>
                Run <code>ollama pull qwen2.5vl:7b</code> for a private local model, or use a <code>:free</code> OpenRouter model with a key. Until then a mock transcriber shows placeholder text.
              </p>
            </div>
          </li>
        </ol>
        <footer>
          <button type="button" className="btn" onClick={onClose}>
            Start writing
          </button>
          <button type="button" className="btn tone-primary" onClick={onChooseModel}>
            <Icon name="settings" size={16} /> Choose a model
          </button>
        </footer>
      </div>
    </div>
  );
}
