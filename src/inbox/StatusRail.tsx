import { useCallback, useRef, useState } from 'react';
import { CircleHelp, Gauge, OctagonAlert, ShieldCheck, Timer } from 'lucide-react';
import { useLiveStore } from '../store';
import { Popover } from './Popover';
import { AutonomyPanel, useAutonomy } from './autonomy';
import { KillPanel, useKillStatus } from './KillPanel';
import { ICON } from './parts';
import { clockText, toMs } from './format';
import { useSimNow } from './simClock';
import './inbox.css';

/** 64 px status rail for /console: autonomy mode, kill switch, open reporting clocks. */
export function StatusRail() {
  const { mode } = useAutonomy();
  const killStatus = useKillStatus();
  const killed = killStatus === 'engaged';
  const obligations = useLiveStore((s) => s.obligations);
  const now = useSimNow();
  const [pop, setPop] = useState<'mode' | 'kill' | null>(null);
  const modeRef = useRef<HTMLButtonElement>(null), killRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setPop(null), []);
  const clocks = obligations.filter((o) => String(o.status ?? 'open') === 'open');

  return (
    <aside className="inbox-rail" aria-label="Console status">
      <button ref={modeRef} type="button" className={`inbox-rail__btn inbox-rail__btn--${mode === 'AUTO' ? 'warn' : mode === 'ASSISTED' ? 'accent' : 'unknown'}`}
        aria-haspopup="dialog" aria-expanded={pop === 'mode'} onClick={() => setPop(pop === 'mode' ? null : 'mode')}>
        <Gauge size={18} strokeWidth={1.5} aria-hidden="true" />
        <span className="inbox-rail__cap">Mode</span>
        <span className="mono inbox-rail__val">{mode}</span>
      </button>
      <button ref={killRef} type="button" className={`inbox-rail__btn inbox-rail__btn--${killed ? 'critical' : 'unknown'}`}
        aria-haspopup="dialog" aria-expanded={pop === 'kill'} onClick={() => setPop(pop === 'kill' ? null : 'kill')}>
        {killed ? <OctagonAlert size={18} strokeWidth={1.5} aria-hidden="true" /> : killStatus === 'armed' ? <ShieldCheck size={18} strokeWidth={1.5} aria-hidden="true" /> : <CircleHelp size={18} strokeWidth={1.5} aria-hidden="true" />}
        <span className="inbox-rail__cap">Kill</span>
        <span className="inbox-rail__val">{killed ? 'Engaged' : killStatus === 'armed' ? 'Armed' : 'State unavailable'}</span>
      </button>
      <div className="inbox-rail__clocks" aria-label="Open reporting clocks">
        <div className="inbox-rail__cap inbox-rail__cap--row"><Timer {...ICON} />Clocks</div>
        {clocks.length === 0 && <span className="inbox-rail__none">None open</span>}
        {clocks.map((o) => {
          const left = toMs(o.due_at) - now;
          const over = Number.isFinite(left) && left <= 0;
          const urgent = Number.isFinite(left) && left > 0 && left < 3600000;
          return (
            <div key={String(o.regime)} className={`inbox-rail__clock${over ? ' is-over' : urgent ? ' is-urgent' : ''}`} title={`${String(o.regime)}, trigger ${String(o.trigger ?? 'unknown')}`}>
              <span className="mono inbox-rail__regime">{String(o.regime)}</span>
              <span className="mono inbox-rail__time">{over ? 'Overdue' : Number.isFinite(left) ? clockText(left) : '--'}</span>
            </div>
          );
        })}
      </div>
      {pop === 'mode' && <Popover anchor={modeRef} onClose={close} placement="right" label="Autonomy mode"><AutonomyPanel onDone={close} /></Popover>}
      {pop === 'kill' && <Popover anchor={killRef} onClose={close} placement="right" label="Kill switch"><KillPanel onDone={close} /></Popover>}
    </aside>
  );
}
