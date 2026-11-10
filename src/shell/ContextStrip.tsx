/**
 * Global context strip (one component, right of the top nav):
 *   scenario picker · Emulated badge · Chennai · sim clock (IST) · bell · autonomy · avatar.
 * All values come from the live store / engine; the clock uses the sim `ts`, never wall time.
 */
import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, MapPin, ShieldCheck, ShieldQuestion, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useLiveStore } from '../store';
import { bellCount, openApprovals, openGaps, useDerived } from '../derive';
import { timeIST } from '../policy/data';
import { EmulatedBadge } from './primitives';

/** HH:MM IST from a simulated ISO timestamp. */
export function simClockIST(ts: string | undefined): string {
  if (!ts) return '--:--';
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? '--:--' : new Intl.DateTimeFormat('en-GB', {
    hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Kolkata',
  }).format(date);
}

type Playbook = { id:string; title?:string };
type AutonomyMode = 'MANUAL' | 'ASSISTED' | 'AUTO';
type StatusEvent = { seq:number; [key:string]:unknown };
const MODES: AutonomyMode[] = ['MANUAL', 'ASSISTED', 'AUTO'];
const MODE_TONE: Record<AutonomyMode, string> = { MANUAL: 'var(--ink-muted)', ASSISTED: 'var(--accent)', AUTO: 'var(--warn)' };

export function autonomyView(event:StatusEvent | null, kill:StatusEvent | null, ts?:string): { mode:AutonomyMode | null; label:string } {
  if (kill?.engaged === true) return { mode:'MANUAL', label:'MANUAL · kill active' };
  if (kill?.engaged === false && kill.seq > (event?.seq ?? -1)) return { mode:'MANUAL', label:'MANUAL' };
  const mode = MODES.find((candidate) => candidate === String(event?.mode ?? event?.to ?? '').toUpperCase()) ?? null;
  const nested = event?.scope;
  const scope = nested && typeof nested === 'object' && !Array.isArray(nested) ? nested as Record<string,unknown> : event;
  const isWildcard = (value:unknown) => value === '*' || (Array.isArray(value) && value.length === 0);
  if (mode === 'MANUAL' && scope && ('sites' in scope || 'playbooks' in scope)
      && !(isWildcard(scope.sites) && isWildcard(scope.playbooks))) {
    return { mode:null, label:'Scoped MANUAL requested' };
  }
  const expires = event?.expires ?? event?.expires_at;
  if (mode && mode !== 'MANUAL' && typeof expires === 'string') {
    const deadline = Date.parse(expires);
    if (!Number.isFinite(deadline)) return { mode:null, label:'Grant expiry unavailable' };
    const now = ts ? Date.parse(ts) : NaN;
    if (Number.isFinite(now) && now > deadline) return { mode:null, label:'Grant expired' };
  }
  return { mode, label:mode ? `${mode}${mode === 'MANUAL' ? '' : ' · scoped'}` : 'Autonomy unavailable' };
}

export function ContextStrip() {
  const { search } = useLocation();
  const fake = new URLSearchParams(search).get('fake') === '1';
  const d = useDerived();
  const ts = useLiveStore((s) => s.ts);
  const autonomyEv = useLiveStore((s) => s.autonomy);
  const killEv = useLiveStore((s) => s.kill);
  const replay = useLiveStore((s) => s.source === 'replay');
  const [sites, setSites] = useState<string[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [open, setOpen] = useState<null | 'auto' | 'bell'>(null);
  const { mode, label:modeLabel } = autonomyView(autonomyEv, killEv, ts);
  const bell = bellCount(d);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    api.catalogue()
      .then((c) => {
        if (!live) return;
        setSites(c.sites && typeof c.sites === 'object' ? Object.keys(c.sites) : []);
        setPlaybooks(Array.isArray(c.playbooks) ? c.playbooks as Playbook[] : []);
      })
      .catch(() => { /* Controls remain unavailable without their catalogue. */ });
    return () => { live = false; };
  }, [fake]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(null); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="sh-ctx" ref={wrapRef}>
      <EmulatedBadge />
      <span className="sh-ctx__place"><MapPin size={14} strokeWidth={2} />Chennai</span>
      <span className="sh-ctx__clock mono" title="Simulation date and time (IST)">{timeIST(ts)}</span>

      {/* Bell */}
      <div className="sh-ctx__auto">
        <button className="sh-ctx__icon" aria-label={`${bell} open approvals and gaps`} aria-expanded={open === 'bell'} onClick={() => setOpen(open === 'bell' ? null : 'bell')}>
          <Bell size={16} strokeWidth={2} />
          {bell > 0 && <span className="sh-ctx__badge">{bell}</span>}
        </button>
        {open === 'bell' && <div className="sh-menu">
          <div className="sh-menu__head">Notifications</div>
          <Link className="sh-menu__item" to={`/operations${fake ? search : ''}`} onClick={() => setOpen(null)}>{openApprovals(d).length} open approvals</Link>
          <Link className="sh-menu__item" to={`/policy${fake ? search : ''}`} onClick={() => setOpen(null)}>{openGaps(d).length} policy gaps</Link>
        </div>}
      </div>

      {/* Autonomy */}
      <AutonomyControl mode={mode} modeLabel={modeLabel} readOnly={fake || replay} replay={replay} sites={sites} playbooks={playbooks} open={open === 'auto'} onToggle={() => setOpen(open === 'auto' ? null : 'auto')} onClose={() => setOpen(null)} />

      <span className="sh-ctx__avatar" title="Incident commander"><UserRound size={15} aria-hidden="true" /></span>
    </div>
  );
}

function AutonomyControl({ mode, modeLabel, readOnly, replay, sites, playbooks, open, onToggle, onClose }: { mode: AutonomyMode | null; modeLabel:string; readOnly:boolean; replay:boolean; sites:string[]; playbooks:Playbook[]; open: boolean; onToggle: () => void; onClose: () => void }) {
  const [pending, setPending] = useState<AutonomyMode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [site, setSite] = useState('');
  const [playbook, setPlaybook] = useState('');
  const [minutes, setMinutes] = useState(20);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (readOnly) setPending(null);
  }, [readOnly]);

  const apply = async (next: AutonomyMode) => {
    setErr(null);
    if (readOnly || useLiveStore.getState().source === 'replay' || new URLSearchParams(window.location.search).get('fake') === '1') { setErr('Commands are unavailable during playback.'); return; }
    if (submitting) return;
    if (next !== 'MANUAL' && (!site || !playbook)) {
      setErr('Select a site and playbook for this grant.');
      return;
    }
    setSubmitting(true);
    try {
      await api.autonomy({ mode: next, minutes, sites:next === 'MANUAL' ? [] : [site], playbooks:next === 'MANUAL' ? [] : [playbook] });
      setPending(null); onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Autonomy change rejected'); } finally { setSubmitting(false); }
  };

  return (
    <div className="sh-ctx__auto">
      <button className="sh-ctx__btn sh-ctx__pill" style={{ color: mode ? MODE_TONE[mode] : 'var(--ink-muted)' }} onClick={onToggle} aria-haspopup="menu" aria-expanded={open}>
        {mode ? <ShieldCheck size={14} strokeWidth={2} /> : <ShieldQuestion size={14} strokeWidth={2} />}
        <span>{modeLabel}</span><ChevronDown size={13} strokeWidth={2} />
      </button>
      {open && (
        <div className="sh-menu sh-menu--auto" role="menu">
          <div className="sh-menu__head">Autonomy</div>
          {readOnly && <div className="sh-menu__muted">Commands are unavailable during {replay ? 'replay' : 'fixture playback'}.</div>}
          {MODES.map((m) => (
            <button key={m} role="menuitem" disabled={readOnly} className={`sh-menu__item${m === mode ? ' is-active' : ''}`} onClick={() => { setPending(m); setErr(null); }} style={{ color: MODE_TONE[m] }}>
              {m}{m === mode && <span className="sh-menu__tag">current</span>}
            </button>
          ))}
          {pending && (
            <div className="sh-menu__pin">
              {pending !== 'MANUAL' && <>
                <label htmlFor="autonomy-site">Site</label>
                <select id="autonomy-site" value={site} onChange={(e) => setSite(e.target.value)}>
                  <option value="">Select a site</option>{sites.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
                <label htmlFor="autonomy-playbook">Playbook</label>
                <select id="autonomy-playbook" value={playbook} onChange={(e) => setPlaybook(e.target.value)}>
                  <option value="">Select a playbook</option>{playbooks.map((p) => <option key={p.id} value={p.id}>{p.id} {p.title}</option>)}
                </select>
                <label htmlFor="autonomy-minutes">Duration</label>
                <select id="autonomy-minutes" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                  {[5, 10, 20, 60].map((n) => <option key={n} value={n}>{n} minutes</option>)}
                </select>
              </>}
              <p>Confirm <b>{pending}</b>{pending === 'MANUAL' ? '' : ` for ${site || 'the selected site'} and ${playbook || 'the selected playbook'}, ${minutes} minutes`}.</p>
              <button type="button" className="sh-btn sh-btn--sm" onClick={() => apply(pending)} disabled={readOnly || submitting}>{submitting ? 'Applying…' : 'Confirm'}</button>
            </div>
          )}
          {err && <div className="sh-menu__err">{err}</div>}
        </div>
      )}
    </div>
  );
}
