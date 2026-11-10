import { useEffect, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { useDerived } from '../../derive';
import { GapCard } from '../../inbox/GapCard';
import { ReportingClocks } from '../../policy/ReportingClocks';
import { actualVerdicts, object, recordBinding, recordIdsForGap, recordInForce, reportingClocks, strings, text, timeIST, usePolicyCatalogue, verdictTone, type RecordInfo } from '../../policy/data';
import { useLiveStore } from '../../store';
import { Code, StatusBadge } from '../primitives';
import { FLOW_POLICY } from '../flowConfig';
import { PageFrame } from '../PageFrame';
import { FittedFlow } from '../FittedFlow';
import { FlowGraph } from '../../pipeline/FlowGraph';
import { WorkspaceSplit } from './WorkspaceSplit';
import '../../policy/policy.css';
import '../../policy/dashboard.css';

type Tab = 'gaps' | 'duties' | 'sources';
const TABS: { id:Tab; label:string }[] = [{id:'gaps',label:'Gaps'},{id:'duties',label:'Duties'},{id:'sources',label:'Sources'}];
const recordLabel = (r:RecordInfo) => `${r.id} ${r.instrument ?? ''} ${r.authority ?? ''} ${r.topic ?? ''}`;
export default function Policy() {
  const data = useDerived();
  const source = useLiveStore(s => s.source);
  const kb = data.session?.kb;
  const { catalogue, error } = usePolicyCatalogue(kb);
  const [tab, setTab] = useState<Tab>('gaps');
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<Record<Tab,string>>({gaps:'',duties:'',sources:''});
  const [layoutKey,setLayoutKey] = useState(0);
  const [expanded,setExpanded] = useState(false);
  const gaps = (data.gaps ?? []).filter(gap => gap.audience !== 'control');
  const clocks = reportingClocks(data);
  const records = catalogue?.records ?? [];
  const query = search.trim().toLowerCase();
  const items = tab === 'gaps' ? gaps.map(g => ({id:String(g.gap_id ?? g.id ?? g.seq), title:text(g.title) ?? text(g.topic) ?? 'Gap title unavailable', sub:text(g.finding) ?? '', tag:text(g.status) ?? 'Candidate'}))
    : tab === 'duties' ? clocks.map(c => ({id:String(c.event.seq), title:c.regime, sub:c.trigger ?? 'Trigger unavailable', tag:c.status}))
      : records.map(r => ({id:r.id,title:r.instrument ?? r.id,sub:`${r.authority ?? 'Authority unavailable'} · ${r.pinpoint ?? r.clause ?? r.id}`,tag:r.verified === true ? 'Verified' : r.verified === false ? 'Unverified' : 'Not stated'}));
  const filtered = items.filter(item => `${item.id} ${item.title} ${item.sub} ${item.tag}`.toLowerCase().includes(query));
  const selected = filtered.find(item => item.id === selection[tab]) ?? filtered[0];
  const selectedGap = tab === 'gaps' ? gaps.find(g => String(g.gap_id ?? g.id ?? g.seq) === selected?.id) : undefined;
  const selectedClock = tab === 'duties' ? clocks.find(c => String(c.event.seq) === selected?.id) : undefined;
  const selectedRecord = tab === 'sources' ? records.find(r => r.id === selected?.id) : undefined;
  const associated = selectedGap ? recordIdsForGap(selectedGap) : selectedClock?.recordIds ?? (selectedRecord ? [selectedRecord.id] : []);
  const verdicts = actualVerdicts(data.verdicts ?? []).filter(v => {
    const ids = [...strings(v.records), ...strings(v.record_ids)];
    const gapRule = text(selectedGap?.rule);
    return Boolean(gapRule && (v.rule === gapRule || v.rule_id === gapRule)) || associated.some(id => ids.includes(id));
  });
  const reset = () => { try { ['policy-list','policy-right','policy-clock'].forEach(id => localStorage.removeItem(`orca-console-split-${id}`)); } catch { /* private mode */ } setLayoutKey(k => k + 1); };
  const list = <section className="policy-browser" aria-label="Policy findings and sources"><div className="policy-browser__tabs" role="tablist" aria-label="Policy items">{TABS.map((t,index) => <button type="button" role="tab" key={t.id} id={`policy-tab-${t.id}`} aria-controls="policy-item-list" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1} onClick={() => {setTab(t.id);setSearch('');}} onKeyDown={event => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length-1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length; setTab(TABS[next].id); setSearch(''); document.getElementById(`policy-tab-${TABS[next].id}`)?.focus(); }}>{t.label} <span>{t.id === 'gaps' ? gaps.length : t.id === 'duties' ? clocks.length : catalogue ? records.length : '—'}</span></button>)}</div><label className="policy-search"><span className="sr-only">Search {tab}</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${tab}`} /></label>{error && <p className="policy-error" role="alert">{error}</p>}<div className="policy-browser__list" role="tabpanel" id="policy-item-list" aria-labelledby={`policy-tab-${tab}`}>{!catalogue && !error && tab === 'sources' && <p>Loading catalogue…</p>}{filtered.length === 0 && <p>{query ? 'No matching items.' : tab === 'gaps' ? 'No gap raised yet. Absence of an event does not establish policy adequacy.' : tab === 'duties' ? 'No reporting duties raised yet. Applicability remains unassessed.' : 'No records available.'}</p>}{filtered.map(item => <button type="button" key={item.id} className={selected?.id === item.id ? 'is-selected' : ''} aria-pressed={selected?.id === item.id} onClick={() => setSelection(previous => ({...previous,[tab]:item.id}))}><strong>{item.title}</strong><small>{item.id}</small><span>{item.tag}</span></button>)}</div></section>;
  const inspector = <section className="policy-inspector" aria-label="Selected policy item"><header><strong>{selected?.title ?? 'Select a policy item'}</strong>{selected && <span>{selected.tag}</span>}</header><div className="policy-inspector__body">{source === 'replay' && <p className="policy-muted">Recording is read-only. Catalogue metadata may differ from the recorded run.</p>}{selectedGap && <><GapCard key={selected.id} gap={selectedGap} defaultExpanded /><section className="policy-inspector__section"><h3>Search boundary</h3><p>{text(object(selectedGap.search).scope) ?? text(selectedGap.search_scope) ?? 'No structured search boundary was included in this event. Read the finding and cited records for the stated scope and date.'}</p></section><CitationDetails ids={associated} records={records}/></>}{selectedClock && <ReportingClocks data={{...data,obligations:[selectedClock.event]}} records={records} />}{selectedRecord && <RecordDetails record={selectedRecord}/>} {verdicts.length > 0 && <section className="policy-inspector__section"><h3>Rule evaluations</h3>{verdicts.map(v => <article key={v.seq} className="policy-evaluation"><StatusBadge tone={verdictTone(v.verdict)} word={String(v.verdict)} size="sm" /> <Code>{text(v.rule) ?? text(v.rule_id) ?? 'Rule unavailable'}</Code><p>{text(v.explanation) ?? 'Explanation unavailable.'}</p><small>Evaluated {timeIST(v.ts)} · immutable evaluation; countdowns use the current simulation time.</small></article>)}</section>}{!selected && <p className="policy-muted">Choose an item to inspect its evidence and context.</p>}</div></section>;
  const clockPanel = <section className="policy-side-panel policy-side-clocks"><ReportingClocks data={data} records={records}/></section>;
  const flowPanel = <section className="policy-side-panel policy-side-flow" data-tour="execution-flow"><header><strong>Policy evidence path</strong><button type="button" className="sh-btn sh-btn--sm" onClick={() => setExpanded(true)}><Maximize2 size={13}/> Expand</button></header><FittedFlow config={FLOW_POLICY}/></section>;
  return <PageFrame title="Policy intelligence" subtitle="Evidence, reporting duties and human review" actions={<> <button className="sh-btn sh-btn--sm" type="button" onClick={reset}>Reset panel sizes</button></>}>
    <div className="policy-summary"><span>India + EU/global sources</span>{source === 'replay' && <span>Recorded rules: {kb === 'eu' ? 'EU' : 'India'} · read-only</span>}<span>{gaps.length} gaps raised</span><span>{clocks.length} duties raised</span><span>{catalogue ? records.length : '—'} catalogue records</span></div>
    <div className="policy-dashboard" key={layoutKey}><WorkspaceSplit id="policy-list" direction="horizontal" initial={25} label="Resize policy list" first={list} second={<WorkspaceSplit id="policy-right" direction="horizontal" initial={63} label="Resize policy inspector" first={inspector} second={<WorkspaceSplit id="policy-clock" direction="vertical" initial={47} label="Resize reporting clocks" first={clockPanel} second={flowPanel}/>}/>}/></div>
    {expanded && <PolicyGraph onClose={() => setExpanded(false)} />}
  </PageFrame>;
}

function RecordDetails({ record }: { record:RecordInfo }) {
  const binding = recordBinding(record);
  // Some catalogues expose URLs; do not manufacture a link when absent.
  const source = text(record.source_url);
  const href = source && /^https?:\/\//i.test(source) ? source : undefined;
  return <section className="policy-inspector__section"><h2>{record.instrument ?? 'Instrument unavailable'}</h2><p>{record.authority ?? 'Authority unavailable'} · {record.jurisdiction ?? 'Jurisdiction unavailable'}</p><p><Code>{record.id}</Code> · {record.pinpoint ?? record.clause ?? 'Pinpoint unavailable'}</p><p><StatusBadge {...binding} size="sm" /> · {recordInForce(record)} · {record.verified === true ? 'Verified record' : record.verified === false ? 'Unverified record' : 'Verification unavailable'}</p><p>Topic: {record.topic?.replace(/_/g,' ') ?? 'Unavailable'}</p>{record.summary && <><h3>Record summary</h3><p>{record.summary}</p></>}{record.quote && <><h3>Source excerpt · {record.verified === true ? 'verified' : record.verified === false ? 'unverified' : 'verification unavailable'}</h3><blockquote>{record.quote}</blockquote></>}{record.source_sha256 && <p className="policy-source-hash">Source SHA-256: <code>{record.source_sha256}</code></p>}{href ? <a className="policy-source-link" href={href} target="_blank" rel="noreferrer">Open source document ↗</a> : <p className="policy-muted">Source URL not provided by the catalogue.</p>}</section>;
}
function CitationDetails({ ids, records }: { ids:string[]; records:RecordInfo[] }) {
  return <section className="policy-inspector__section"><h3>Cited catalogue records</h3>{ids.length ? ids.map(id => { const record = records.find(r => r.id === id); return <details className="policy-citation" key={id}><summary><Code>{id}</Code> {record?.instrument ?? 'Catalogue metadata unavailable'}</summary>{record && <RecordDetails record={record}/>}</details>; }) : <p>No record IDs were attached to this event.</p>}</section>;
}
function PolicyGraph({ onClose }: {onClose:() => void}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.showModal(); return () => { if (ref.current?.open) ref.current.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className="graph-dialog policy-graph-dialog" aria-label="Detailed policy flow" onCancel={event => {event.preventDefault();onClose();}}><header><div><h2>Detailed policy flow</h2><p>Observed evidence and system methodology</p></div><button type="button" className="sh-btn" onClick={onClose}>Close</button></header><p className="graph-legend">Observed = result received · Active = work in progress · Not observed = evidence unavailable.</p><div className="graph-full"><FlowGraph /></div></dialog>;
}
