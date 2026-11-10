import { useEffect, useState } from 'react';
import { Pause, Play, SkipForward } from 'lucide-react';
import { usePresenter } from '../stage/presenter';
import { scenarioName } from '../names';
import { BANDS } from './pipelineNodes';
import { pathFor } from './scenarioPaths';
import { usePipeline } from './pipelineStore';
import { ICONS } from './icons';

/**
 * "What happens next" as a small pop-up at the side of the flowchart (user review, 9 Nov: no big dialog).
 * The run waits while it shows; Pause keeps it open, Continue moves on.
 */
export function GuideToast() {
  const card = usePresenter((s) => s.card);
  const held = usePresenter((s) => s.held);
  const skip = usePresenter((s) => s.skip);
  const toggleHold = usePresenter((s) => s.toggleHold);
  const scenario = usePipeline((s) => s.scenario);
  const [, tick] = useState(0);
  useEffect(() => { if (!card || held) return; const t = window.setInterval(() => tick((n) => n + 1), 100); return () => window.clearInterval(t); }, [card, held]);
  if (!card) return null;
  const pct = held ? 0 : Math.min(1, (Date.now() - card.started) / card.ms);
  const band = BANDS.find((b) => b.id === card.band);
  const Icon = band ? ICONS[band.icon] : null;
  const intro = card.kind === 'intro';
  const path = pathFor(scenario);
  return (
    <aside className={`gd-toast b-${card.band ?? 'intro'}`} role="status" aria-live="polite" key={card.started}>
      <span className="gd-kicker mono">{intro ? `${scenario} · what will happen` : `Next · step ${band?.n ?? ''} of 7`}</span>
      <b className="gd-title">{Icon && <Icon size={18} strokeWidth={1.75} aria-hidden />}{intro ? scenarioName(scenario, path?.title ?? card.title) : card.title}</b>
      <p className="gd-text">{intro ? (path?.story ?? '') : card.text}</p>
      {intro && (
        <ol className="gd-steps">
          {BANDS.slice(1).map((b) => <li key={b.id}><span className="mono">{b.n}</span>{b.title}</li>)}
        </ol>
      )}
      <div className="gd-foot">
        <span className="gd-bar" aria-hidden><i style={{ transform: `scaleX(${pct})` }} /></span>
        <button className="gd-btn" onClick={toggleHold} aria-pressed={held}>{held ? <Play size={14} strokeWidth={1.75} aria-hidden /> : <Pause size={14} strokeWidth={1.75} aria-hidden />}{held ? 'Resume' : 'Pause'}</button>
        <button className="gd-btn gd-btn--go" onClick={() => { if (held) toggleHold(); skip(); }}><SkipForward size={14} strokeWidth={1.75} aria-hidden />Continue</button>
      </div>
    </aside>
  );
}
