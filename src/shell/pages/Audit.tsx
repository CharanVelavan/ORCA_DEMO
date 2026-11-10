/** Recorded evidence is observational. Playback belongs to the application-wide ReplayProvider. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Bot, ChevronLeft, ChevronRight, Download, FileClock, Layers, Link2, LockKeyhole, Pause, Play, Radio, Scale, Search, Settings2, UserRound, X } from 'lucide-react';
import { api } from '../../api';
import { PHASES } from '../../derive';
import { actorLabel, actorType, cursorForTs, phaseCursor, summarize, toEntries, toJsonl, type AuditEntry } from '../../review/audit';
import { AuditInspector, ChainStatus, eventTitle } from '../../review/AuditInspector';
import { buildEvidencePackage } from '../../review/evidenceExport';
import type { Speed } from '../../review/useReplay';
import { useDashboardReplay } from '../../review/ReplayProvider';
import { useLiveStore } from '../../store';
import { PageFrame } from '../PageFrame';
import { simClockIST } from '../ContextStrip';
import { WorkspaceSplit } from './WorkspaceSplit';
import type { AuditChain } from '../../types';
import '../../review/audit.css';

type Run = { file: string; scenario: string | null; stream: boolean; size: number; mtime: number };
type Category = 'all' | 'signals' | 'models' | 'rules' | 'agents' | 'approvals' | 'execution' | 'system';
const CATEGORIES = [
  { id: 'all', label: 'All events', icon: Layers }, { id: 'signals', label: 'Signals', icon: Activity },
  { id: 'models', label: 'Models', icon: Bot }, { id: 'rules', label: 'Rules', icon: Scale },
  { id: 'agents', label: 'Agents', icon: Radio }, { id: 'approvals', label: 'Approvals', icon: UserRound },
  { id: 'execution', label: 'Execution', icon: Settings2 }, { id: 'system', label: 'System', icon: FileClock },
] as const;
const PAGE = 160;
const SPEEDS: Speed[] = [1, 4, 10];
function category(entry: AuditEntry): Category {
  if (/^(approved|rejected|approval|autonomy|kill_switch)/.test(entry.kind)) return 'approvals';
  if (/^(execute|executed|rolled_back|rollback|clone|playbook)/.test(entry.kind)) return 'execution';
  if (actorType(entry.actor) === 'model' || /^M[1-4]$/.test(String(entry.payload.source ?? ''))) return 'models';
  if (actorType(entry.actor) === 'rule' || entry.kind === 'verdict') return 'rules';
  if (/^(event_released|alert|tick|net_state|posture)/.test(entry.kind)) return 'signals';
  return actorType(entry.actor) === 'agent' ? 'agents' : 'system';
}
const signature = (entries: AuditEntry[]) => JSON.stringify(entries.map(entry => [entry.seq, entry.hash, entry.prev_hash]));
function download(name: string, body: string, type = 'application/x-ndjson') {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Audit() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const { file, setFile, replay } = useDashboardReplay();
  const source = useLiveStore(state => state.source);
  const [selectedCategory, setCategory] = useState<Category>('all');
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const [upToCursor, setUpToCursor] = useState(false);
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [pageStart, setPageStart] = useState(0);
  const [chainOpen, setChainOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportToken = useRef(0);
  const [verification, setVerification] = useState<{ file: string; signature: string; chain: AuditChain } | null>(null);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const verifyToken = useRef(0);
  const timeline = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    api.runs().then(result => { if (alive) setRuns(result.runs ?? []); }).catch((error: unknown) => { if (alive) { setRuns([]); setRunsError(error instanceof Error ? error.message : 'Recordings unavailable'); } });
    return () => { alive = false; };
  }, []);
  useEffect(() => { setSelectedSeq(null); setPageStart(0); setVerification(null); setVerifyNotice(null); setVerifying(false); verifyToken.current += 1; exportToken.current += 1; setExporting(false); return () => { verifyToken.current += 1; exportToken.current += 1; }; }, [file]);
  const entries = useMemo(() => file && !replay.loading ? toEntries(replay.audit?.entries) : [], [file, replay.loading, replay.audit]);
  const loadedSignature = useMemo(() => signature(entries), [entries]);
  const chain = !file || replay.loading ? null : verification?.file === file && verification.signature === loadedSignature ? verification.chain : replay.audit?.chain;
  const currentTs = replay.cursor ? replay.events[replay.cursor - 1]?.ts : undefined;
  const cursorMs = typeof currentTs === 'string' ? Date.parse(currentTs) : NaN;
  const visibleEntries = useMemo(() => !upToCursor ? entries : entries.filter(entry => {
    const time = Date.parse(entry.ts ?? ''); return Number.isFinite(cursorMs) && (!Number.isFinite(time) || time <= cursorMs);
  }), [entries, upToCursor, cursorMs]);
  const counts = useMemo(() => {
    const result = Object.fromEntries(CATEGORIES.map(item => [item.id, 0])) as Record<Category, number>;
    visibleEntries.forEach(entry => result[category(entry)]++); result.all = visibleEntries.length; return result;
  }, [visibleEntries]);
  const kinds = useMemo(() => [...new Set(entries.map(entry => entry.kind))].sort(), [entries]);
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => visibleEntries.filter(entry => (selectedCategory === 'all' || category(entry) === selectedCategory) && (kind === 'all' || entry.kind === kind) && (!needle || `${entry.actor} ${entry.kind} ${JSON.stringify(entry.payload)}`.toLowerCase().includes(needle))), [visibleEntries, selectedCategory, kind, needle]);
  const nearest = [...filtered].reverse().find(entry => Number.isFinite(cursorMs) && Date.parse(entry.ts ?? '') <= cursorMs) ?? filtered[0];
  const selected = (selectedSeq === null ? undefined : filtered.find(entry => entry.seq === selectedSeq)) ?? nearest;
  const windowEntries = filtered.slice(pageStart, pageStart + PAGE);
  const selectedIndex = selected ? filtered.indexOf(selected) : -1;
  useEffect(() => setPageStart(0), [selectedCategory, kind, needle, upToCursor]);
  useEffect(() => { if (selectedIndex >= 0) setPageStart(Math.floor(selectedIndex / PAGE) * PAGE); }, [selected?.seq]);
  useEffect(() => {
    const parent = timeline.current;
    const target = parent?.querySelector<HTMLElement>(`[data-entry-seq="${selected?.seq}"]`);
    if (!parent || !target) return;
    const top = target.offsetTop;
    if (top < parent.scrollTop) parent.scrollTop = top;
    else if (top + target.offsetHeight > parent.scrollTop + parent.clientHeight) parent.scrollTop = top + target.offsetHeight - parent.clientHeight;
  }, [selected?.seq, pageStart]);
  const canPlay = Boolean(file && !replay.loading && replay.events.length);
  const chooseEntry = (entry: AuditEntry) => { setSelectedSeq(entry.seq); const cursor = cursorForTs(replay.events, entry.ts); if (cursor !== undefined) replay.seek(cursor); };
  const seek = (cursor: number) => { setSelectedSeq(null); replay.seek(cursor); };
  const step = (delta: number) => { setSelectedSeq(null); replay.step(delta); };
  const playPause = () => { if (!replay.playing) setSelectedSeq(null); replay.toggle(); };
  const verify = async () => {
    if (!file || verifying) return;
    const token = ++verifyToken.current; setVerifying(true); setVerifyNotice(null); setChainOpen(true);
    try {
      const response = await api.replay(file);
      if (token !== verifyToken.current) return;
      if (!response.audit || signature(toEntries(response.audit.entries)) !== loadedSignature) { setVerifyNotice('The recording changed. Reload it to verify the loaded version.'); return; }
      setVerification({ file, signature: loadedSignature, chain: response.audit.chain });
      setVerifyNotice(response.audit.chain.ok === true ? 'The browser verified the bundled original recording chain.' : response.audit.chain.note || 'The chain could not be verified.');
    } catch (error: unknown) { if (token === verifyToken.current) setVerifyNotice(error instanceof Error ? error.message : 'Chain verification unavailable'); }
    finally { if (token === verifyToken.current) setVerifying(false); }
  };
  const exportEvidence = async () => {
    if (!file || exporting || replay.loading) return;
    const token = ++exportToken.current; const selectedFile = file;
    setExporting(true); setVerifyNotice(null);
    try {
      // Fetch a fresh, internally consistent recording instead of exporting the replay cursor or normalized events.
      const response = await api.replay(selectedFile);
      if (token !== exportToken.current) return;
      const evidence = buildEvidencePackage({ file: selectedFile, events: response.events ?? [],
        entries: toEntries(response.audit?.entries), source: response.source ?? null,
        chain: response.audit?.chain, omittedControl: response.audit?.omitted_control });
      const name = selectedFile.split('/').pop()?.replace(/\.jsonl$/, '') || 'recording';
      download(`${name}-evidence.json`, JSON.stringify(evidence, null, 2) + '\n', 'application/json');
      setVerifyNotice('Recording evidence downloaded. It may contain multiple incidents; review it before sharing.');
    } catch (error: unknown) {
      if (token === exportToken.current) setVerifyNotice(error instanceof Error ? error.message : 'Evidence export unavailable.');
    } finally { if (token === exportToken.current) setExporting(false); }
  };
  const clearFilters = () => { setCategory('all'); setKind('all'); setQuery(''); setUpToCursor(false); };
  const pagination = <div className="au-pagination"><span>{filtered.length ? `${pageStart + 1}–${Math.min(pageStart + PAGE, filtered.length)} of ${filtered.length}` : '0 events'}</span><div><button type="button" aria-label="Previous events" disabled={pageStart === 0} onClick={() => setPageStart(start => Math.max(0, start - PAGE))}><ChevronLeft size={14} /></button><button type="button" aria-label="Next events" disabled={pageStart + PAGE >= filtered.length} onClick={() => setPageStart(start => start + PAGE)}><ChevronRight size={14} /></button></div></div>;
  const indexPanel = <section className="au-region au-index" aria-labelledby="audit-index-title"><header className="au-region__header"><h2 id="audit-index-title">Event filter</h2><span>{filtered.length} events</span></header><div className="au-index__filters"><label className="au-search"><Search size={14} /><input type="search" placeholder="Search text, ID or scope" aria-label="Search audit events" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear audit search" onClick={() => setQuery('')}><X size={13} /></button>}</label><label className="au-kind"><span>Event kind</span><select aria-label="Event kind" value={kind} onChange={event => setKind(event.target.value)}><option value="all">All kinds</option>{kinds.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="au-toggle"><input type="checkbox" checked={upToCursor} onChange={event => setUpToCursor(event.target.checked)} />Up to playhead</label></div><div className="au-index__body"><nav className="au-categories" aria-label="Event categories">{CATEGORIES.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={selectedCategory === id} onClick={() => setCategory(id)}><Icon size={15} /><span>{label}</span><b>{counts[id]}</b></button>)}</nav><div className="au-region__scroll au-event-index">{windowEntries.map(entry => <button key={entry.seq} type="button" className={selected?.seq === entry.seq ? 'is-selected' : ''} onClick={() => chooseEntry(entry)} aria-pressed={selected?.seq === entry.seq}><time>{simClockIST(entry.ts)}</time><span>{eventTitle(entry)}</span><small>#{entry.seq}</small></button>)}{!windowEntries.length && <p className="au-muted">No matching entries.</p>}</div></div>{pagination}</section>;
  const timelinePanel = <section className="au-region au-timeline" aria-labelledby="audit-timeline-title"><header className="au-region__header"><h2 id="audit-timeline-title">Recorded event timeline</h2><span>{replay.replaySource === 'stream' ? 'Stream + audit' : replay.replaySource === 'audit' ? 'Audit-derived' : 'No recording'}</span></header><div className="au-region__scroll au-timeline__scroll" ref={timeline}>{!file ? <div className="au-empty"><FileClock size={28} /><h3>Choose a recording</h3><p>Replay observed evidence across the dashboard. Exercise controls stay withheld.</p></div> : replay.loading ? <div className="au-empty" role="status"><h3>Loading recorded evidence…</h3><p>Reading events and the original chain status.</p></div> : !windowEntries.length ? <div className="au-empty"><Search size={25} /><h3>No matching events</h3><p>Adjust the search or event filters.</p><button type="button" className="au-btn" onClick={clearFilters}>Clear filters</button></div> : <ol className="au-timeline__events">{windowEntries.map(entry => <li key={entry.seq} data-entry-seq={entry.seq} className={selected?.seq === entry.seq ? 'is-selected' : ''}><button type="button" aria-pressed={selected?.seq === entry.seq} onClick={() => chooseEntry(entry)}><span className="au-timeline__dot" aria-hidden="true" /><time>{simClockIST(entry.ts)}</time><span className="au-timeline__copy"><strong>{eventTitle(entry)}</strong><span>{summarize(entry)}</span><small>{actorLabel(entry.actor)} · #{entry.seq}</small></span><span className="au-event-type">{CATEGORIES.find(item => item.id === category(entry))?.label}</span></button></li>)}</ol>}</div><footer className="au-timeline__footer"><LockKeyhole size={12} /><span>Recorded evidence · selection seeks playback · no network changes</span></footer></section>;
  const inspector = <AuditInspector entry={selected} chain={chain} omitted={replay.audit?.omitted_control ?? 0} chainOpen={chainOpen} setChainOpen={setChainOpen} />;

  return <PageFrame title="Audit & Replay" actions={<div className="au-header-controls"><label className="au-recording"><FileClock size={15} /><span>Recording</span><select aria-label="Recording" value={file ?? ''} disabled={!runs?.length} onChange={event => setFile(event.target.value || null)}><option value="">{runs === null ? 'Loading recordings…' : 'Choose a recording'}</option>{(runs ?? []).map(run => <option key={run.file} value={run.file}>{run.scenario ?? 'Unknown'} · {run.stream ? 'stream' : 'audit'} · {run.file}</option>)}</select></label><div className="au-transport" role="group" aria-label="Replay transport"><button type="button" className="au-icon-btn au-icon-btn--primary" onClick={playPause} disabled={!canPlay} aria-label={replay.playing ? 'Pause replay' : 'Play replay'}>{replay.playing ? <Pause size={15} /> : <Play size={15} />}</button><button type="button" className="au-icon-btn" onClick={() => step(-1)} disabled={!canPlay || replay.cursor <= 0} aria-label="Step back one event"><ChevronLeft size={16} /></button><button type="button" className="au-icon-btn" onClick={() => step(1)} disabled={!canPlay || replay.cursor >= replay.events.length} aria-label="Step forward one event"><ChevronRight size={16} /></button><label className="au-speed"><span>Speed</span><select aria-label="Replay speed" value={replay.speed} disabled={!canPlay} onChange={event => replay.setSpeed(Number(event.target.value) as Speed)}>{SPEEDS.map(speed => <option key={speed} value={speed}>{speed.toFixed(1)}×</option>)}</select></label></div><span className="au-readonly"><LockKeyhole size={13} />Recorded evidence · read only</span><button type="button" className="au-btn" disabled={!file || replay.loading || verifying} onClick={() => void verify()}><Link2 size={14} />{verifying ? 'Checking…' : 'Verify chain'}</button><button type="button" className="au-btn" disabled={!file || replay.loading || exporting} title="Export public evidence for the whole selected recording; may contain multiple incidents" onClick={() => void exportEvidence()}><Download size={14} />{exporting ? 'Preparing…' : 'Recording evidence JSON'}</button><button type="button" className="au-icon-btn" disabled={!filtered.length} title="Export filtered public audit JSONL" aria-label="Export filtered audit JSONL" onClick={() => file && download(`${file.replace(/\.jsonl$/, '')}-audit-public-filtered.jsonl`, toJsonl(filtered))}><Download size={15} /></button>{source === 'replay' && <button type="button" className="au-btn au-btn--quiet" onClick={() => { window.location.assign("/scenarios"); }}>Choose another scenario</button>}</div>}>
    <div className="au-layout">
      {(runsError || replay.error || verifyNotice) && <div className={`au-notice${runsError || replay.error ? ' is-error' : ''}`} role={runsError || replay.error ? 'alert' : 'status'}>{runsError ?? replay.error ?? verifyNotice}</div>}
      <div className="au-workbench"><WorkspaceSplit id="audit-index" direction="horizontal" initial={27} label="Resize event index" first={indexPanel} second={<WorkspaceSplit id="audit-inspector" direction="horizontal" initial={56} label="Resize timeline and event inspector" first={timelinePanel} second={inspector} />} /></div>
      <section className="au-playhead" aria-label="Replay playhead"><button type="button" className="au-icon-btn au-icon-btn--primary" onClick={playPause} disabled={!canPlay} aria-label={replay.playing ? 'Pause timeline' : 'Play timeline'}>{replay.playing ? <Pause size={18} /> : <Play size={18} />}</button><div className="au-playhead__position"><strong>{typeof currentTs === 'string' ? `${simClockIST(currentTs)} IST` : 'Start of recording'}</strong><span>{replay.cursor} / {replay.events.length} replay events</span></div><div className="au-playhead__scrubber"><input type="range" min={0} max={replay.events.length} value={replay.cursor} disabled={!canPlay} onChange={event => seek(Number(event.target.value))} aria-label="Replay position" aria-valuetext={`Event ${replay.cursor} of ${replay.events.length}, ${typeof currentTs === 'string' ? simClockIST(currentTs) + ' IST' : 'start'}`} /><div className="au-phase-markers" role="group" aria-label="Jump to lifecycle phase">{PHASES.map(phase => { const cursor = phaseCursor(replay.events, phase.id); return <button key={phase.id} type="button" disabled={cursor === undefined} className={cursor !== undefined && replay.cursor >= cursor ? 'is-reached' : ''} onClick={() => cursor !== undefined && seek(cursor)} title={cursor === undefined ? `${phase.label}: not recorded` : `${phase.label}: ${simClockIST(String(replay.events[cursor - 1]?.ts ?? ''))} IST`}><i aria-hidden="true" /><span>{phase.label}</span><small>{cursor === undefined ? 'Not recorded' : simClockIST(String(replay.events[cursor - 1]?.ts ?? ''))}</small></button>; })}</div></div><div className="au-playhead__integrity"><ChainStatus chain={chain} /><span>Original chain</span></div></section>
    </div>
  </PageFrame>;
}
