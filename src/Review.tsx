import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDashed, Download, FileText, Pause, Play, SkipBack, SkipForward, UserCheck, Bot, Siren, ShieldCheck } from 'lucide-react';
import { PipelineFlow } from './pipeline/PipelineFlow';
import { api } from './api';
import { useUi } from './stage/uiStore';
import { ist } from './stage/time';
import type { LiveEvent } from './types';
import { computeMetrics, type Metrics } from './review/metrics';
import { useReplay, type Speed } from './review/useReplay';
import './review/review.css';

const ICON = { size: 14, strokeWidth: 1.5, 'aria-hidden': true } as const;
const SPEEDS: Speed[] = [1, 4, 10];

export function Review() {
  const [params] = useSearchParams();
  const file = params.get('file');
  return file ? <Player file={file} /> : <Picker />;
}

function Picker() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const open = (f: string) => { const v = f.trim().split('/').pop() ?? ''; if (v) nav(`/review?file=${encodeURIComponent(v)}`); };
  const submit = (e: FormEvent) => { e.preventDefault(); open(name); };
  // Recordings the engine knows about, newest first; ones with a full stream sidecar replay best.
  const [runs, setRuns] = useState<{ file: string; scenario: string | null; stream: boolean; size: number }[] | null>(null);
  useEffect(() => {
    api.runs().then((r) => setRuns((r.runs ?? []).filter((x) => x.file.startsWith('live-') && x.size > 4000).sort((a, b) => Number(b.stream) - Number(a.stream)).slice(0, 8))).catch(() => setRuns([]));
  }, []);
  return (
    <main className="rev rev--pick">
      <header className="rev-top"><Link to="/" className="rev-back"><ArrowLeft {...ICON} />Back</Link><strong>ORCA-NTN</strong><span className="rev-sep">Review</span></header>
      <section className="rev-pick" aria-labelledby="rev-pick-h">
        <h1 id="rev-pick-h">Open a recording</h1>
        <p className="rev-muted">Replay a past exercise step by step. Review sees ground truth after the fact. All links are emulated.</p>
        <form onSubmit={submit} className="rev-pick__form">
          <label htmlFor="rev-file">Recording file name</label>
          <div className="rev-pick__row">
            <input id="rev-file" className="rev-input mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="live-YYYYMMDD-HHMMSS-s1-rules-mock.jsonl" autoComplete="off" spellCheck={false} />
            <button type="submit" className="rev-btn rev-btn--primary" disabled={!name.trim()}>Open</button>
          </div>
        </form>
        <h2 className="rev-h2">Known recordings</h2>
        <ul className="rev-quick">
          {runs === null && <li className="rev-muted">Loading recordings</li>}
          {runs?.length === 0 && <li className="rev-muted">No recordings yet. Run an exercise on the Stage first.</li>}
          {runs?.map((r) => (
            <li key={r.file}><button className="rev-quick__item" onClick={() => open(r.file)}><FileText {...ICON} /><span className="mono">{r.file}</span><span className="rev-muted">{r.scenario ? `Scenario ${r.scenario}` : ''}{r.stream ? '' : ' · audit only'}</span></button></li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Player({ file }: { file: string }) {
  const r = useReplay(file);
  const { events, cursor, playing, speed, scenario } = r;
  const metrics = useMemo(() => computeMetrics(events, file, scenario), [events, file, scenario]);
  const cur = cursor > 0 ? events[cursor - 1] : null;
  const total = events.length;

  useEffect(() => { useUi.getState().setPipeline('open'); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'range' || el.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space' && el?.tagName !== 'BUTTON') { e.preventDefault(); r.toggle(); }
      else if (e.key === 'ArrowRight' && el?.tagName !== 'INPUT') r.step(1);
      else if (e.key === 'ArrowLeft' && el?.tagName !== 'INPUT') r.step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(metrics, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `orca-review-${file.replace(/\.jsonl$/, '')}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <main className="rev">
      <header className="rev-top">
        <Link to="/" className="rev-back"><ArrowLeft {...ICON} />Back</Link>
        <strong>ORCA-NTN</strong><span className="rev-sep">Review</span>
        <span className="rev-file mono" title={file}>{file}</span>
        <span className="rev-chip">EMULATED</span>
        <span className="rev-spacer" />
        <Link to="/review" className="rev-btn">Open another</Link>
        <button className="rev-btn" onClick={exportJson} disabled={!total}><Download {...ICON} />Export JSON</button>
      </header>

      <section className="rev-flow" aria-label="Replayed pipeline">
        {r.loading && <p className="rev-state" role="status"><CircleDashed {...ICON} />Loading recording</p>}
        {r.error && <p className="rev-state rev-state--bad" role="alert"><AlertTriangle {...ICON} />Cannot load: {r.error}</p>}
        {!r.error && <PipelineFlow truth />}
      </section>

      <section className="rev-scrub" aria-label="Replay controls">
        <div className="rev-ctl">
          <button className="rev-ib" aria-label="Step back" title="Step back (Left arrow)" onClick={() => r.step(-1)} disabled={cursor <= 0}><SkipBack {...ICON} /></button>
          <button className="rev-ib rev-ib--main" aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause (Space)' : 'Play (Space)'} onClick={r.toggle} disabled={!total}>{playing ? <Pause {...ICON} /> : <Play {...ICON} />}<span>{playing ? 'Pause' : 'Play'}</span></button>
          <button className="rev-ib" aria-label="Step forward" title="Step forward (Right arrow)" onClick={() => r.step(1)} disabled={cursor >= total}><SkipForward {...ICON} /></button>
          <div className="rev-speed" role="group" aria-label="Speed">
            {SPEEDS.map((s) => <button key={s} className="rev-speed__b mono" aria-pressed={speed === s} onClick={() => r.setSpeed(s)}>x{s}</button>)}
          </div>
        </div>
        <div className="rev-track">
          <input className="rev-range" type="range" min={0} max={Math.max(1, total)} step={1} value={cursor} aria-label="Replay position" aria-valuetext={cur ? `Event ${cursor} of ${total}, ${ist(String(cur.ts))} IST` : 'Start'} onChange={(e) => r.seek(Number(e.target.value))} disabled={!total} />
          <Ticks events={events} />
        </div>
        <div className="rev-time mono" aria-live="off">
          <strong>{cur ? ist(String(cur.ts)) : '--:--:--'}</strong> IST
          <span className="rev-muted"> · +{cur ? Number(cur.t) : 0} min · event {cursor}/{total}</span>
        </div>
        <Legend />
      </section>

      <section className="rev-metrics" aria-label="Review metrics">
        <TruthTimeline m={metrics} minute={cur ? Number(cur.t) : 0} />
        <Times m={metrics} />
        <Gaps m={metrics} />
      </section>
    </main>
  );
}

/* ---------------------------------------------------------------- scrubber ticks */
type TickKind = 'inject' | 'alert' | 'approval' | 'execute' | 'heal';
const tickKind = (e: LiveEvent): TickKind | null => {
  if (e.kind === 'inject') return 'inject';
  if (e.kind === 'alert' || (e.kind === 'verdict' && e.gap_id)) return 'alert';
  if (e.kind === 'approval' && e.status !== 'requested') return 'approval';
  if (e.kind === 'execute') return 'execute';
  if (e.kind === 'heal') return 'heal';
  return null;
};
function Ticks({ events }: { events: LiveEvent[] }) {
  const n = events.length;
  if (!n) return <div className="rev-ticks" />;
  return (
    <div className="rev-ticks" aria-hidden>
      {events.map((e, i) => {
        const k = tickKind(e);
        if (!k) return null;
        return <i key={i} className={`rev-tick rev-tick--${k}`} style={{ '--f': (i + 1) / n } as CSSProperties} title={`${k} at ${ist(String(e.ts))}`} />;
      })}
    </div>
  );
}
function Legend() {
  const items: [TickKind, string][] = [['inject', 'Injected'], ['alert', 'Alert or gap'], ['approval', 'Approval'], ['execute', 'Executed'], ['heal', 'Healed']];
  return <ul className="rev-legend">{items.map(([k, w]) => <li key={k}><i className={`rev-tick rev-tick--${k} rev-tick--key`} />{w}</li>)}</ul>;
}

/* ---------------------------------------------------------------- column 1: truth vs detection */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(420);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, Math.floor(el.clientWidth))));
    ro.observe(el); setW(Math.max(260, Math.floor(el.clientWidth)));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
function TruthTimeline({ m, minute }: { m: Metrics; minute: number }) {
  const [ref, w] = useWidth();
  const maxM = Math.max(10, m.lastMinute);
  const padL = 12, padR = 16, rowH = 46, top = 8;
  const x = (v: number) => padL + (Math.min(v, maxM) / maxM) * (w - padL - padR);
  const rows = m.timings;
  const h = top + Math.max(1, rows.length) * rowH + 30;
  const step = maxM <= 30 ? 5 : maxM <= 90 ? 10 : 30;
  const ticks: number[] = []; for (let v = 0; v <= maxM; v += step) ticks.push(v);
  return (
    <article className="rev-card" aria-labelledby="rev-c1">
      <h2 id="rev-c1" className="rev-h2">Truth vs detection</h2>
      <div ref={ref} className="rev-chart">
        {!rows.length ? <p className="rev-muted">No injected threat in this recording.</p> : (
          <svg width={w} height={h} role="img" aria-label={`Timeline of ${rows.length} injected threats against first detection, minutes 0 to ${maxM}`}>
            {ticks.map((v) => <g key={v}><line x1={x(v)} x2={x(v)} y1={top} y2={h - 22} className="rev-grid" /><text x={x(v)} y={h - 6} textAnchor="middle" className="rev-axis">{v}</text></g>)}
            <text x={w - padR} y={h - 6} textAnchor="end" className="rev-axis rev-axis--u">min</text>
            {rows.map((t, i) => {
              const y = top + i * rowH;
              const end = t.threat.end ?? maxM;
              const detAt = t.detect === null ? null : t.threat.start + t.detect;
              const dx = detAt === null ? null : x(detAt);
              return (
                <g key={t.threat.id}>
                  <text x={padL} y={y + 12} className="rev-lbl">{t.threat.target} · {t.threat.label}</text>
                  <rect x={x(t.threat.start)} y={y + 18} width={Math.max(3, x(end) - x(t.threat.start))} height={6} rx={2} className="rev-bar--threat" />
                  {dx !== null && <>
                    <line x1={dx} x2={dx} y1={y + 14} y2={y + 32} className="rev-det__line" />
                    <path d={`M${dx} ${y + 34} l5 5 l-5 5 l-5 -5 z`} className="rev-det__mark"><title>First detection at +{detAt} min</title></path>
                  </>}
                </g>
              );
            })}
            <line x1={x(minute)} x2={x(minute)} y1={top} y2={h - 22} className="rev-now" />
          </svg>
        )}
      </div>
      <ul className="rev-key">
        <li><i className="rev-sw rev-sw--threat" />Injected threat (truth)</li>
        <li><i className="rev-sw rev-sw--det" />First detection</li>
        <li><i className="rev-sw rev-sw--now" />Playhead</li>
      </ul>
    </article>
  );
}

/* ---------------------------------------------------------------- column 2: times and decisions */
const mins = (v: number | null) => (v === null ? null : `${v} min`);
function Cell({ v, note }: { v: number | null; note?: string }) {
  return v === null
    ? <span className="rev-st rev-st--none"><CircleDashed {...ICON} size={12} />none</span>
    : <span className="rev-st rev-st--ok mono"><CheckCircle2 {...ICON} size={12} />{mins(v)}{note ? <small> {note}</small> : null}</span>;
}
function Times({ m }: { m: Metrics }) {
  return (
    <article className="rev-card" aria-labelledby="rev-c2">
      <h2 id="rev-c2" className="rev-h2">Time to detect, contain, heal</h2>
      {!m.timings.length ? <p className="rev-muted">No injected threat to measure.</p> : (
        <table className="rev-table">
          <thead><tr><th scope="col">Threat</th><th scope="col">Detect</th><th scope="col">Contain</th><th scope="col">Heal</th></tr></thead>
          <tbody>
            {m.timings.map((t) => (
              <tr key={t.threat.id}>
                <th scope="row"><span className="mono">{t.threat.target}</span><small>{t.threat.truthClass || t.threat.label}</small></th>
                <td><Cell v={t.detect} note={t.detectSource.includes('inferred') ? 'inferred' : undefined} /></td>
                <td><Cell v={t.contain} /></td>
                <td><Cell v={t.heal} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="rev-note">Minutes from the injection start. Inferred means no alert event was recorded, so the first agent task stands in.</p>
      <h3 className="rev-h3">Decisions</h3>
      {!m.decisions.length ? <p className="rev-muted">No approvals in this recording.</p> : (
        <ul className="rev-dec">
          {m.decisions.map((d, i) => (
            <li key={i}>
              {d.status === 'auto' ? <Bot {...ICON} /> : <UserCheck {...ICON} />}
              <span className="mono rev-dec__pb">{d.playbook || 'plan'}</span>
              <span>{d.status === 'rejected' ? 'Rejected' : 'Approved'} by {d.who}</span>
              <span className="rev-muted mono">{d.targets ? `${d.targets} · ` : ''}{ist(d.ts)} IST</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/* ---------------------------------------------------------------- column 3: gaps and with vs without */
function Gaps({ m }: { m: Metrics }) {
  return (
    <article className="rev-card" aria-labelledby="rev-c3">
      <h2 id="rev-c3" className="rev-h2">Gaps found</h2>
      {!m.gaps.length ? <p className="rev-muted">No policy gap was raised.</p> : (
        <ul className="rev-gaps">
          {m.gaps.map((g) => (
            <li key={g.id}>
              <span className="rev-st rev-st--warn"><Siren {...ICON} size={12} />{g.verdict.replace(/_/g, ' ') || 'GAP'}</span>
              <span className="mono rev-gaps__id">{g.id}</span>
              <p>{g.text}</p>
              <span className="rev-muted mono">+{g.minute} min{g.decision ? ` · human: ${g.decision}` : ' · awaiting human decision'}</span>
            </li>
          ))}
        </ul>
      )}
      <h3 className="rev-h3">With vs without ORCA</h3>
      {!m.impact ? <p className="rev-muted"><ShieldCheck {...ICON} /> No impact comparison was recorded. The audit chain does not carry impact events.</p> : (
        <div className="rev-imp">
          {m.impact.map((row) => {
            const max = Math.max(1, row.real, row.shadow);
            return (
              <div key={row.key} className="rev-imp__row">
                <span>{row.key.replace(/_/g, ' ')}</span>
                <div className="rev-imp__bars">
                  <b className="rev-imp__bar rev-imp__bar--real" style={{ width: `${(row.real / max) * 100}%` }} /><em className="mono">With ORCA {row.real}</em>
                  <b className="rev-imp__bar rev-imp__bar--shadow" style={{ width: `${(row.shadow / max) * 100}%` }} /><em className="mono">Without {row.shadow}</em>
                </div>
              </div>
            );
          })}
          <p className="rev-note">Emulated estimates from the last impact event.</p>
        </div>
      )}
    </article>
  );
}
