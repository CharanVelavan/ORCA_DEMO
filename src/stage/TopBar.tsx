import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Moon, Pause, Play, Square, Sun } from 'lucide-react';
import { api } from '../api';
import { useLiveStore } from '../store';
import { AutonomyBadge, KillSwitchButton } from '../inbox';
import { endExercise } from '../sim';
import { scenarioName } from '../names';
import { usePresenter } from './presenter';
import { useUi, type ExerciseConfig } from './uiStore';
import { ist } from './time';

const ICON = { size: 15, strokeWidth: 1.6, 'aria-hidden': true } as const;
const SPEEDS: { value: ExerciseConfig['speed']; text: string }[] = [{ value: 0.5, text: 'Slow' }, { value: 1, text: 'Normal' }, { value: 2, text: 'Fast' }];

export function TopBar({ view }: { view: 'stage' | 'console' | 'control' }) {
  const mode = useUi((s) => s.mode);
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const speed = useUi((s) => s.config.speed);
  const run = useUi((s) => s.config.run);
  const chosen = useUi((s) => s.config.scenario);
  const setConfig = useUi((s) => s.setConfig);
  const session = useLiveStore((s) => s.session);
  const ts = useLiveStore((s) => s.ts);
  const held = usePresenter((s) => s.held);
  const toggleHold = usePresenter((s) => s.toggleHold);
  const running = view === 'console' || mode === 'running';
  const stage = view === 'stage';
  const setSpeed = (v: ExerciseConfig['speed']) => { setConfig({ speed: v }); if (run === 'live') api.clock({ action: 'play', speed: v }).catch(() => undefined); };
  const scn = String(session.scenario ?? (stage && running ? chosen : '') ?? '');
  return (
    <header className="st-top">
      <Link to="/" className="st-brand">ORCA<span>-NTN</span></Link>
      <span className="st-sep" />
      {running && scn ? (
        <span className="st-title"><b className="mono">{scn}</b>{scenarioName(scn, String(session.title ?? ''))}</span>
      ) : (
        <span className="st-title st-title--muted">{view === 'console' ? 'Operator console' : view === 'control' ? 'Simulator' : 'Exercise stage'} · Chennai</span>
      )}
      <span className="st-tag mono">EMULATED</span>
      {stage && running && <span className={`st-mode mono is-${run}`}>{run === 'demo' ? 'DEMO · recorded' : 'LIVE · AI model'}</span>}
      <span className="st-grow" />
      <span className="st-clock mono" title="Simulation time, IST">{ist(ts)} IST</span>
      {stage && running && (
        <button className={`st-play ${held ? 'is-held' : ''}`} onClick={toggleHold} title={held ? 'Resume (Space)' : 'Pause (Space)'} aria-pressed={held}>
          {held ? <Play {...ICON} /> : <Pause {...ICON} />}{held ? 'Resume' : 'Pause'}
        </button>
      )}
      {stage && running && (
        <div className="st-seg" role="group" aria-label="Simulation speed">
          {SPEEDS.map((v) => <button key={v.value} className={v.value === speed ? 'is-on' : ''} onClick={() => setSpeed(v.value)}>{v.text}</button>)}
        </div>
      )}
      {running && (run === 'live' || !stage) && <ControlsMenu />}
      <button className="st-ib" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'} title="Theme">{theme === 'dark' ? <Sun {...ICON} /> : <Moon {...ICON} />}</button>
      {running && stage && <button className="st-end" onClick={() => endExercise().catch(() => useUi.getState().end())}><Square {...ICON} size={12} />End</button>}
    </header>
  );
}

/** Autonomy and kill switch live behind one menu so the bar stays calm. */
function ControlsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="st-menu" ref={ref}>
      <button className="st-menu__btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>Controls<ChevronDown {...ICON} size={14} /></button>
      {open && (
        <div className="st-menu__pop" role="menu">
          <div className="st-menu__row"><span>Autonomy</span><AutonomyBadge /></div>
          <div className="st-menu__row"><span>Kill switch</span><KillSwitchButton /></div>
        </div>
      )}
    </div>
  );
}
