import { Pause, Play, SkipForward } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDerived } from '../derive';
import { isReadOnlyNow } from '../sim/readOnly';
import { simClockIST } from '../shell/ContextStrip';
import { StatusBadge } from '../shell/primitives';
import type { DirectorControls } from './useDirectorControls';

const SPEEDS = [0.5, 1, 2, 5, 10];

export function ClockBar({ controls, readOnly, fake, replay, search }: {
  controls: DirectorControls; readOnly: boolean; fake: boolean; replay: boolean; search: string;
}) {
  const d = useDerived();
  const history = (d.tickHistory ?? []).map((tick) => tick.t).filter((t): t is number => typeof t === 'number');
  const first = history[0] ?? 0;
  const last = history.at(-1) ?? first;
  const disabled = !controls.canCommand || controls.running === null;

  function clock(action: 'play' | 'pause' | 'step') {
    if (readOnly || isReadOnlyNow() || disabled || (action === 'step' && controls.running !== false)) return;
    void controls.updateClock(action);
  }

  return (
    <section className="director-clock" aria-label="Simulation clock and session controls">
      <div className="director-clock__playback">
        <div className="director-clock__buttons">
          <button type="button" className="director-icon-button director-icon-button--primary"
            disabled={disabled} onClick={() => clock(controls.running ? 'pause' : 'play')}
            aria-label={controls.running ? 'Pause simulation' : 'Play simulation'}>
            {controls.running ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
          </button>
          <button type="button" className="director-icon-button" disabled={disabled || controls.running !== false}
            onClick={() => clock('step')} aria-label="Advance one simulation minute">
            <SkipForward size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="director-clock__time">
          <strong className="mono">{simClockIST(d.ts)} IST</strong>
          <span>{d.ts && typeof d.t === 'number' ? `Simulation minute ${d.t}` : 'Clock unavailable'}</span>
        </div>
        <label className="director-clock__timeline">Observed timeline
          <input type="range" min={first} max={Math.max(first + 1, last)} value={last} disabled
            aria-label="Observed simulation timeline, seeking unavailable" />
          <span>Seeking is available in <Link to={`/audit${search}`}>Audit &amp; Replay</Link>.</span>
        </label>
        <label className="director-clock__speed">Speed
          <select value={controls.speed ?? ''} disabled={disabled} onChange={(event) => {
            if (readOnly || isReadOnlyNow() || disabled) return;
            controls.changeSpeed(Number(event.target.value));
          }}>
            {controls.speed === null && <option value="">Unavailable</option>}
            {controls.speed !== null && !SPEEDS.includes(controls.speed) && <option value={controls.speed}>{controls.speed}x</option>}
            {SPEEDS.map((speed) => <option key={speed} value={speed}>{speed}x</option>)}
          </select>
        </label>
        <StatusBadge tone={replay || fake || !controls.connected ? 'unknown' : 'ok'}
          word={replay ? 'Replay' : fake ? 'Fixture' : controls.connected ? 'Live' : 'Disconnected'} />
      </div>
      <div className="director-clock__settings">
        <label>Rules
          <select value={controls.rules === null ? '' : controls.rules ? 'on' : 'off'} disabled={!controls.canCommand}
            onChange={(event) => {
              if (readOnly || isReadOnlyNow() || !controls.canCommand) return;
              if (event.target.value === 'on' || event.target.value === 'off') void controls.changeRules(event.target.value === 'on');
            }}>
            {controls.rules === null && <option value="">Unavailable</option>}
            <option value="on">On</option><option value="off">Off</option>
          </select>
        </label>
        <span className="director-clock__knowledge">India rules · EU/global comparisons</span>
        <label>LLM mode
          <select value={controls.llm} disabled={!controls.canCommand} onChange={(event) => {
            if (readOnly || isReadOnlyNow() || !controls.canCommand) return;
            if (event.target.value === 'mock' || event.target.value === 'local') controls.chooseLlm(event.target.value);
          }}>
            {!controls.llm && <option value="">Unavailable</option>}
            <option value="mock">Mock</option><option value="local">Local</option>
          </select>
        </label>
        <label>Agent sync
          <select value={controls.sync === null ? '' : controls.sync ? 'on' : 'off'} disabled={!controls.canCommand}
            onChange={(event) => {
              if (readOnly || isReadOnlyNow() || !controls.canCommand) return;
              if (event.target.value === 'on' || event.target.value === 'off') controls.chooseSync(event.target.value === 'on');
            }}>
            {controls.sync === null && <option value="">Unavailable</option>}
            <option value="on">On</option><option value="off">Off</option>
          </select>
        </label>
        <p>LLM and sync settings take effect when a scenario is started.
          {controls.draftChanged && <strong> Changes pending.</strong>}
        </p>
      </div>
      {replay ? <p className="director-clock__readonly">Replay is read-only. Engine commands are disabled.</p>
        : fake ? <p className="director-clock__readonly">Fixture playback is read-only. No engine commands are sent.</p> : null}
      {controls.connectionError && <p className="director-error" role="status">Engine state unavailable: {controls.connectionError}</p>}
      {controls.error && <p className="director-error" role="alert">{controls.error}</p>}
      {controls.notice && <p className="director-notice" role="status">{controls.notice}</p>}
    </section>
  );
}
