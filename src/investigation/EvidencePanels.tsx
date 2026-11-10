import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, CircleDashed, Clock3, Layers, SearchCheck } from 'lucide-react';
import { GATEWAYS, MGMT, MODELS, models, PHASES, sites, SITE_STATE, type DeriveInput, type Tone } from '../derive';
import { Empty, Panel, StatusBadge, simClockIST } from '../shell';
import type { LiveEvent } from '../types';
import { number, text } from '../operations/data';
import { attackFaultEvidence, type Criterion } from './evidence';

function findSiteModel(data: DeriveInput, site: string, match: (event: LiveEvent) => boolean): LiveEvent | undefined {
  const matches = (event: LiveEvent) => event.audience !== 'control' && event.kind === 'model' && event.model === 'M3' && event.site === site && match(event);
  return [...(data.events ?? [])].reverse().find(matches) ?? [...(data.models ?? [])].reverse().find(matches);
}

export function AffectedAssets({ data }: { data: DeriveInput }) {
  const m3 = models(data).find((model) => model.id === 'M3');
  const suspected = m3?.klass === 'attack-management-plane' && !m3.abstain;
  const flaggedSite = m3?.event?.state === 'flagged' || (m3?.klass && m3.klass !== 'normal') ? text(m3?.event?.site) : undefined;
  const affected = sites(data).filter((site) => (site.state !== 'ok' && site.state !== 'unknown') || site.id === flaggedSite);
  return (
    <Panel title="Observed assets" icon={Layers}>
      <ul className="inv-assets">
        <li><div><strong>{MGMT.id}</strong><small>{MGMT.label}</small></div><StatusBadge tone={suspected ? 'warn' : 'unknown'} word={suspected ? 'Suspected by M3' : 'Not assessed'} size="sm" /></li>
        {GATEWAYS.filter((gateway) => gateway.allowed).map((gateway) => {
          const value = data.gateways?.[gateway.id];
          return <li key={gateway.id}><div><strong>{gateway.id}</strong><small>{gateway.label}</small></div><StatusBadge tone={value === 'up' ? 'ok' : value === 'down' ? 'critical' : 'unknown'} word={value === 'up' ? 'Operational' : value === 'down' ? 'Down' : 'Unavailable'} size="sm" /></li>;
        })}
        {affected.map((site) => {
          const status = site.id === flaggedSite && site.state === 'ok' ? { tone: 'warn' as const, word: 'M3 flagged' } : SITE_STATE[site.state];
          return <li key={site.id}><div><strong>{site.id}</strong><small>{site.area}</small></div><StatusBadge tone={status.tone} word={status.word} size="sm" /></li>;
        })}
      </ul>
      {!affected.length && <p className="ops-subtle">No affected site reported yet.</p>}
    </Panel>
  );
}

function CriteriaList({ items }: { items: Criterion[] }) {
  return <ul className="inv-criteria">{items.map((item) => {
    const Icon = item.met === true ? CheckCircle2 : item.met === false ? Circle : CircleDashed;
    const word = item.met === true ? 'Observed' : item.met === false ? 'Not observed' : 'No signal';
    return <li key={item.id} data-met={String(item.met)}>
      <Icon size={15} aria-hidden />
      <span><strong>{item.label}</strong><small className="mono">{item.observed}</small></span>
      <span className="ops-sr">{word}</span>
    </li>;
  })}</ul>;
}

export function AttackFaultEvidence({ data, site }: { data: DeriveInput; site: string }) {
  const view = attackFaultEvidence(data.models ?? [], data.tickHistory ?? [], site);
  const count = (items: Criterion[]) => `${items.filter((item) => item.met === true).length} of ${items.length}`;
  const attackMet = view.attack.filter((item) => item.met === true).length;
  const faultMet = view.fault.filter((item) => item.met === true).length;
  return (
    <Panel title="Attack vs network fault - evidence" icon={SearchCheck} right={<span className="ops-subtle">{site} · {view.sampleCount} samples</span>}>
      <div className="inv-evidence-grid">
        <section data-side="attack"><h3><span>Attack indicators</span><StatusBadge tone={attackMet ? 'critical' : 'unknown'} word={`${count(view.attack)} observed`} size="sm" /></h3><CriteriaList items={view.attack} /></section>
        <section data-side="fault"><h3><span>Network fault indicators</span><StatusBadge tone={faultMet ? 'warn' : 'unknown'} word={`${count(view.fault)} observed`} size="sm" /></h3><CriteriaList items={view.fault} /></section>
      </div>
      <p className="ops-subtle">Checks run over observed emulated telemetry and M1/M2/M3 output since the first sample. They support, not replace, the M3 classification, which can abstain. Exercise ground truth is not shown here.</p>
    </Panel>
  );
}

function classProbabilities(event?: LiveEvent): { name: string; probability: number }[] {
  const value = event?.probabilities ?? event?.class_probabilities ?? event?.top_classes;
  const rows: { name: string; probability: number }[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const name = text(row.class) ?? text(row.name) ?? text(row.label);
      const probability = number(row.probability) ?? number(row.score);
      if (name && probability !== undefined && probability >= 0 && probability <= 1) rows.push({ name, probability });
    }
  } else if (value && typeof value === 'object') {
    for (const [name, raw] of Object.entries(value as Record<string, unknown>)) {
      const probability = number(raw);
      if (probability !== undefined && probability >= 0 && probability <= 1) rows.push({ name, probability });
    }
  }
  return rows.sort((a, b) => b.probability - a.probability).slice(0, 3);
}

export function Hypotheses({ data, site }: { data: DeriveInput; site: string }) {
  const withProbabilities = findSiteModel(data, site, (event) => classProbabilities(event).length > 0);
  const event = withProbabilities ?? findSiteModel(data, site, () => true);
  const rows = classProbabilities(withProbabilities);
  return (
    <Panel title="M3 class hypotheses" icon={AlertTriangle}>
      {rows.length ? <table className="ops-table"><thead><tr><th>Class</th><th>Model score (uncalibrated)</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.name}><td>{row.name}</td><td><span className="inv-probability"><span className="inv-probability__track" aria-hidden><span style={{ width: `${row.probability * 100}%` }} /></span>{(row.probability * 100).toFixed(1)}%</span></td></tr>)}
      </tbody></table> : <Empty>Class probabilities have not been provided by M3.</Empty>}
      {event && <p className="ops-subtle">Reported for {site} at {simClockIST(event.ts)} IST: {event.abstain === true ? 'abstain' : text(event.class) ?? 'class unavailable'}.</p>}
    </Panel>
  );
}

function timelineLine(event: LiveEvent): { title: string; tone: Tone; status: string } {
  if (event.kind === 'alert') return { title: text(event.label) ?? 'Alert', tone: 'warn', status: 'Observed' };
  if (event.kind === 'model') {
    const klass = text(event.class) ?? (event.abstain === true ? 'abstain' : 'unavailable');
    return { title: `${text(event.model) ?? 'Model'}: ${klass}`, tone: klass.startsWith('attack') ? 'critical' : klass === 'abstain' ? 'warn' : 'accent', status: 'Reported' };
  }
  if (event.kind === 'approval') {
    const status = text(event.status) ?? 'unavailable';
    return { title: `Approval ${text(event.playbook) ?? ''}`.trim(), tone: status === 'approved' ? 'ok' : status === 'rejected' ? 'critical' : 'warn', status };
  }
  if (event.kind === 'execute') {
    const result = text(event.result) ?? 'unavailable';
    return { title: `Execution ${text(event.playbook) ?? ''}`.trim(), tone: result === 'ok' ? 'ok' : result === 'refused' || result === 'rolled_back' ? 'critical' : 'unknown', status: result };
  }
  if (event.kind === 'rollback') return { title: 'Rollback', tone: 'warn', status: 'Reported' };
  if (event.kind === 'heal') return { title: `Failover ${text(event.site) ?? ''}`.trim(), tone: 'accent', status: 'Reported' };
  if (event.kind === 'reattack') return { title: 'Re-attack check', tone: event.blocked === true ? 'ok' : event.blocked === false ? 'critical' : 'unknown', status: event.blocked === true ? 'Blocked' : event.blocked === false ? 'Not blocked' : 'Unavailable' };
  return { title: event.kind, tone: 'unknown', status: 'Reported' };
}

export function EvidenceTimeline({ data, site }: { data: DeriveInput; site: string }) {
  const [cutoff, setCutoff] = useState('');
  const seen = new Set<string>();
  const phases = (data.phaseHistory ?? []).filter((event) => {
    const phase = text(event.latest);
    if (event.audience === 'control' || !phase || seen.has(phase) || !PHASES.some((item) => item.id === phase)) return false;
    seen.add(phase);
    return true;
  });
  const selected = phases.some((event) => String(event.t) === cutoff) ? cutoff : '';
  const from = selected ? Number(selected) : undefined;
  const events = (data.events ?? []).filter((event) => {
    if (event.audience === 'control' || (from !== undefined && event.t < from)) return false;
    if (event.kind === 'model') return event.model === 'M3' && event.site === site && (event.abstain === true || (typeof event.class === 'string' && event.class !== 'normal'));
    if (event.kind === 'alert') return !text(event.site) || event.site === site;
    return ['approval', 'execute', 'heal', 'rollback', 'reattack'].includes(event.kind);
  });
  return (
    <Panel title="Evidence timeline" icon={Clock3}>
      {phases.length > 0 && <label className="ops-field ops-field--inline">Show from phase
        <select value={selected} onChange={(event) => setCutoff(event.target.value)}><option value="">All observed events</option>
          {phases.map((event) => <option key={event.seq} value={String(event.t)}>{PHASES.find((phase) => phase.id === event.latest)?.label} - {simClockIST(event.ts)} IST</option>)}
        </select>
      </label>}
      {!events.length ? <Empty>No matching evidence events have been received.</Empty> : <ol className="inv-htl" aria-label="Evidence events in simulation time order">
        {events.slice(-8).map((event) => {
          const line = timelineLine(event);
          return <li key={`${event.seq}-${event.kind}`} data-tone={line.tone}>
            <span className="inv-htl__dot" aria-hidden />
            <time className="mono">{simClockIST(event.ts)}</time>
            <strong title={line.title}>{line.title}</strong>
            <small>{line.status}</small>
          </li>;
        })}
      </ol>}
      {events.length > 8 && <p className="ops-subtle">Showing the latest 8 matching events of {events.length}.</p>}
      <p className="ops-subtle">Times are IST simulation time. The phase filter changes this timeline only; the network remains live.</p>
    </Panel>
  );
}

export function ModelContext({ data }: { data: DeriveInput }) {
  const m1 = models(data).find((model) => model.id === 'M1');
  const threshold = number(m1?.event?.threshold);
  const ecodFlagged = Array.isArray(m1?.event?.flag_sources) && m1.event.flag_sources.includes('ecod');
  return <div className="inv-model-context">
    <span>{MODELS.find((model) => model.id === 'M1')?.label}</span>
    <strong>{m1?.score === undefined ? 'Unavailable' : m1.score.toFixed(3)}</strong>
    <small>Isolation Forest score{threshold === undefined ? '' : ` · threshold ${threshold}`}{ecodFlagged ? ' · ECOD also flagged' : ''}</small>
    {m1?.score !== undefined && m1.score >= 0 && m1.score <= 1 && <meter className="inv-model-meter" min={0} max={1} value={m1.score} aria-label={`Anomaly score ${m1.score} on a zero to one scale`} />}
  </div>;
}
