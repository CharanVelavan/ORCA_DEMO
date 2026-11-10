import { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { CATEGORY_LABEL, INJECTOR_ICONS, groupInjectors, type InjectorInfo } from '../../sim/injectors';
import { isReadOnlyNow } from '../../sim/readOnly';
import type { DirectorControls } from '../../simulator/useDirectorControls';
import { api } from '../../api';
import { useLiveStore } from '../../store';
import { conditionTime, parseActiveConditions, type ActiveCondition } from './activeConditions';

export function ConsoleAttackRail({ injectors, targets, controls, readOnly }: { injectors:InjectorInfo[]; targets:string[]; controls:DirectorControls; readOnly:boolean }) {
  const [target, setTarget] = useState('');
  const [duration, setDuration] = useState('5');
  const [focused, setFocused] = useState<InjectorInfo | null>(null);
  const tick = useLiveStore(s => s.t);
  const session = useLiveStore(s => s.session);
  const [snapshot, setSnapshot] = useState<{t:number;items:ActiveCondition[]}|null>(null);
  const [snapshotError, setSnapshotError] = useState('');
  const [stopping, setStopping] = useState<string|null>(null);
  const [stopError, setStopError] = useState('');
  const [revision, setRevision] = useState(0);
  const requestVersion = useRef(0);
  useEffect(() => {
    let active = true;
    if (readOnly || isReadOnlyNow()) { setSnapshot(null); setSnapshotError(''); return () => { active = false; }; }
    const load = async () => {
      const request = ++requestVersion.current;
      try {
        const value = parseActiveConditions(await api.truth());
        if (!value) throw new Error('Condition state unavailable.');
        if (active && request === requestVersion.current && !isReadOnlyNow()) { setSnapshot(value); setSnapshotError(''); }
      } catch { if (active && request === requestVersion.current) { setSnapshot(null); setSnapshotError('Condition state unavailable.'); } }
    };
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, [readOnly, tick, session, controls.busy, revision]);
  const stop = async (item:ActiveCondition) => {
    if (readOnly || isReadOnlyNow() || !controls.canCommand || !item.cancellable || stopping) return;
    requestVersion.current += 1; setStopping(item.id); setStopError('');
    try { await api.stopInject({id:item.id}); setSnapshot(null); setRevision(value => value + 1); }
    catch (error) { setStopError(error instanceof Error ? error.message : 'Could not stop the condition.'); setRevision(value => value + 1); }
    finally { setStopping(null); }
  };
  const minutes = Number(duration);
  const valid = Number.isInteger(minutes) && minutes > 0;
  const description = (item:InjectorInfo) => `${item.label} · target ${target || item.default_target || 'unavailable'} · ${valid ? `${minutes} min` : 'invalid duration'}`;
  return <aside className="console-rail" aria-label="Director emulated conditions" data-tour="simulator-injection">
    <div className="console-rail__head"><strong>Inject</strong><small>Director only</small></div>
    <div className="console-rail__settings"><label>Target<select aria-label="Injection target" value={target} disabled={readOnly} onChange={e => setTarget(e.target.value)}><option value="">Event default</option>{targets.map(t => <option key={t} value={t}>{t}</option>)}</select></label><label>Minutes<input aria-label="Injection duration in minutes" type="number" min="1" step="1" inputMode="numeric" value={duration} disabled={readOnly} onChange={e => setDuration(e.target.value)} /></label></div>
    <p className="console-rail__help">{target ? `Target: ${target}` : 'Each event uses its listed default target.'} · {valid ? `${minutes} min` : 'Enter a positive whole number.'}</p>
    <div className="console-rail__groups">{groupInjectors(injectors).map(group => <div className="console-rail__group" key={group.category} role="group" aria-label={CATEGORY_LABEL[group.category]}><strong>{CATEGORY_LABEL[group.category]}</strong><div>{group.items.map(item => { const Icon = INJECTOR_ICONS[item.id] ?? Activity; const details = description(item); return <button type="button" key={item.id} className="console-rail__button" title={details} aria-label={`Launch ${details}`} aria-disabled={readOnly || !controls.canCommand || Boolean(stopping) || !valid || !(target || item.default_target)} onMouseEnter={() => setFocused(item)} onFocus={() => setFocused(item)} onClick={() => { if (!readOnly && !isReadOnlyNow() && controls.canCommand && !stopping && valid && Boolean(target || item.default_target)) void controls.inject(item.id, target || item.default_target, minutes); }}><Icon size={18} aria-hidden="true" /></button>; })}</div></div>)}</div>
    <div className="console-rail__detail" aria-live="polite">{focused ? description(focused) : 'Hover or focus an icon for its condition and target.'}</div>
    <section className="console-rail__active" aria-label="Active injected conditions"><strong>Injected conditions</strong>
      {readOnly ? <p>Playback is read-only. Live condition controls are unavailable.</p> : snapshotError ? <p role="status">{snapshotError}</p> : !snapshot ? <p>Loading condition state…</p> : !snapshot.items.length ? <p>No active injected conditions.</p> : snapshot.items.map(item => <article key={item.id}><strong>{item.label}</strong><small>{item.id} · {item.target}</small><small>{conditionTime(item,snapshot.t)} · simulation time</small>{item.cancellable ? <button type="button" className="sh-btn sh-btn--sm" disabled={!controls.canCommand || Boolean(stopping)} onClick={() => void stop(item)}>{stopping === item.id ? 'Stopping…' : 'Stop'}</button> : <small>No future condition ticks to stop.</small>}</article>)}
      <p>Stopping prevents future condition effects. It does not undo prior changes or route offers.</p>
      {stopError && <p role="alert">{stopError}</p>}
    </section>
    {!injectors.length && <p className="console-rail__help">No conditions available.</p>}
  </aside>;
}
