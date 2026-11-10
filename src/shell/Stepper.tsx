/**
 * Bottom stepper — one per page (except Home). Built from the engine's real phase
 * history (derive.phaseSteps): Predict → Heal → Coordinate → Contain → Fix → Report gaps.
 * Each step is done / current / pending, with the sim time it was reached.
 * On Audit & Replay, clicking a step can seek (onSeek).
 */
import { Eye } from 'lucide-react';
import { phaseSteps, useDerived, type PhaseId } from '../derive';
import { simClockIST } from './ContextStrip';

export function Stepper({ onSeek, seekable }: { onSeek?: (id: PhaseId, at?: string) => void; seekable?: boolean }) {
  const d = useDerived();
  const steps = phaseSteps(d);
  return (
    <nav className="sh-stepper" aria-label="Incident lifecycle workstreams" data-tour="lifecycle" title="Parallel workstreams. Seen means activity was observed, not that the incident is resolved.">
      <div className="sh-stepper__title">
        <span>Lifecycle</span>
      </div>
      <ol className="sh-stepper__list">
        {steps.map((s, i) => (
          <li key={s.id} className={`sh-step is-${s.status}${s.isLatest ? ' is-latest' : ''}`}>
            {i > 0 && <span className="sh-step__bar" aria-hidden />}
            <button
              className="sh-step__btn"
              disabled={!seekable || !s.at}
              onClick={() => seekable && onSeek?.(s.id, s.at)}
              aria-current={s.isLatest ? 'step' : undefined}
            >
              <span className="sh-step__dot">
                {s.status === 'seen' ? <Eye size={12} strokeWidth={2} /> : <span className="sh-step__num">{i + 1}</span>}
              </span>
              <span className="sh-step__text">
                <span className="sh-step__label">{s.label}</span>
                <span className="sh-step__at mono">{s.status === 'current' ? 'Active' : s.status === 'seen' ? 'Seen' : 'Not reached'}{s.at ? ` ${simClockIST(s.at)}` : ''}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
