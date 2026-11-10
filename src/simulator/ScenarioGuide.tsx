import { useEffect, useState } from 'react';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useDerived } from '../derive';
import type { ScenarioInfo } from '../sim/useCatalogue';
import { Panel } from '../shell/primitives';
import { simClockIST } from '../shell/ContextStrip';
import { SCENARIO_GUIDE } from './scenarioGuideContent';
import { DIMENSIONS, scenarioDimensions } from './scenarioDimensions';
import './scenario-guide.css';

type GuideEvent = { at: number; label: string; actor?: string; detail?: string };
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const sentence = (v: unknown): string | undefined => typeof v === 'string' && v.length > 0 ? v : undefined;
function parseEvents(raw: Record<string, unknown>): GuideEvent[] {
  const value = raw.events ?? raw.schedule ?? raw.steps;
  if (!Array.isArray(value)) return [];
  return value.flatMap((value, index): GuideEvent[] => {
    const row = object(value);
    const rawTime = row.at_t ?? row.at_min ?? row.t ?? row.minute ?? row.at;
    const at = typeof rawTime === 'number' ? rawTime : typeof rawTime === 'string' && rawTime.trim() ? Number(rawTime) : NaN;
    if (!Number.isFinite(at) || at < 0) return [];
    const action = sentence(row.what) ?? sentence(row.description) ?? sentence(row.text) ?? sentence(row.summary);
    const explicitTitle = sentence(row.label) ?? sentence(row.title);
    const actor = sentence(row.actor)?.replaceAll('_', ' ');
    return [{ at, label: explicitTitle ?? action ?? `Scenario event ${index + 1}`, actor, detail: explicitTitle ? action : undefined }];
  }).sort((a, b) => a.at - b.at);
}

export function ScenarioGuide({ scenario, previewOnly = false }: { scenario?: ScenarioInfo; previewOnly?: boolean }) {
  const d = useDerived();
  const { search } = useLocation();
  const [detail, setDetail] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!scenario) return;
    const controller = new AbortController();
    setDetail({}); setLoading(true); setError(undefined);
    fetch(`/data/scenarios/${encodeURIComponent(scenario.id)}.json`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('The step schedule is unavailable.'); return response.json(); })
      .then((raw: unknown) => { if (!controller.signal.aborted) setDetail(object(raw)); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'The step schedule is unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [scenario?.id]);
  const payload = object(detail.scenario ?? detail);
  const plannedStart = sentence(payload.start) ?? scenario?.start;
  const events = parseEvents(payload);
  const currentId = String(d.session?.scenario ?? '').toUpperCase();
  const runningSelected = !previewOnly && scenario?.id.toUpperCase() === currentId && Boolean(currentId);
  const now = runningSelected && typeof d.t === 'number' && Number.isFinite(d.t) && d.t >= 0 ? d.t : -1;
  const released = events.filter(event => event.at <= now).length;
  const story = sentence(payload.narrative) ?? sentence(payload.story) ?? scenario?.story;
  const notes = scenario ? SCENARIO_GUIDE[scenario.id.toUpperCase()] : undefined;
  const coverage = scenario ? scenarioDimensions(scenario.id) : null;
  const impacts = Array.isArray(payload.everyday_impact) ? payload.everyday_impact.map(object) : [];
  const decisions = Array.isArray(payload.human_decisions) ? payload.human_decisions.filter((x): x is string => typeof x === 'string') : [];
  const observed = runningSelected ? (d.events ?? []).filter(event => ['alert', 'model', 'verdict', 'approval', 'execute', 'heal', 'rollback', 'reattack'].includes(event.kind)).slice(-4).reverse() : [];
  const observedCount = d.events?.length ?? 0;
  return <div data-tour="simulator-guide" className="scenario-guide"><Panel title="Exercise guide" icon={BookOpen}>
    {!scenario ? <p>Select a scenario to begin.</p> : <>
      <span className="scenario-guide__id">{scenario.id} · {previewOnly ? 'Scenario briefing · recorded demonstration' : 'Director view'}</span><h2>{scenario.title}</h2>
      {story && <p>{story}</p>}
      {coverage && <section className="scenario-guide__dimensions" aria-label="Planned Readiness dimension coverage"><h3>Planned coverage · {coverage.count} of {coverage.total} selected dimensions</h3><p>{coverage.reason}</p><details><summary>Which dimensions and why</summary><ul>{coverage.dimensions.map(id => <li key={id}><strong>{id}</strong> · {DIMENSIONS[id]}</li>)}</ul></details><small>Project mapping, not an official readiness score. Actual coverage needs evidence from this run; planned steps alone do not prove completion.</small></section>}
      <div className="scenario-guide__purpose"><strong>Planned objective</strong><p>{scenario.objective ?? sentence(object(payload.objective).what) ?? 'Inspect the released evidence, model output, policy duties and proposed response as the exercise unfolds.'}</p></div>
      {previewOnly && <section className="scenario-guide__setup"><h3>Starting conditions</h3><dl><div><dt>Planned start</dt><dd>{plannedStart ? `${simClockIST(plannedStart)} IST` : 'Not specified in the catalogue'}</dd></div><div><dt>Sites</dt><dd>{scenario.sites.length ? scenario.sites.join(', ') : 'Not specified in the catalogue'}</dd></div><div><dt>Scripted cause</dt><dd>{scenario.m3_expected || 'Not specified'} · expected scenario label, not an observed model result</dd></div></dl></section>}
      {notes && <div className="scenario-guide__brief" aria-label="Scenario briefing">
        <section><h3>{previewOnly ? '01 / Setup & planned progression' : 'Planned progression'}</h3><p>{notes.progression}</p></section>
        <section><h3>{previewOnly ? '02 / Signals to watch' : 'Signals to watch'}</h3><p>{notes.signals}</p></section>
        <section><h3>{previewOnly ? '03 / Model roles' : 'Model roles'}</h3><p>{notes.models}</p><small>These are roles to inspect, not a promise that every model produces an output.</small></section>
        <section><h3>{previewOnly ? '04 / Planned guarded response' : 'Planned guarded response'}</h3><p>{notes.response}</p></section>
        <section><h3>{previewOnly ? '05 / What to inspect' : 'What to inspect'}</h3><p>{notes.inspect}</p></section>
      </div>}
      {impacts.length > 0 && <section className="scenario-guide__brief-section"><h3>Scripted service impact</h3><ul>{impacts.map((impact, index) => <li key={index}><strong>{sentence(impact.who) ?? 'Service'}</strong>: {sentence(impact.what) ?? 'Impact described in the scenario'}{typeof impact.from === 'number' ? ` (from T+${impact.from})` : ''}</li>)}</ul></section>}
      {decisions.length > 0 && <section className="scenario-guide__brief-section"><h3>Scripted human decisions</h3><ul>{decisions.map(decision => <li key={decision}>{decision}</li>)}</ul></section>}
      {!previewOnly && <section className="scenario-guide__observed" aria-label="Observed run evidence"><h3>Observed in this run</h3><p>{runningSelected ? `${observedCount} event${observedCount === 1 ? '' : 's'} retained in the current session. These entries are actual events, not the script.` : 'This briefing is a preview. Start this scenario and inspect its live events before treating a planned step as evidence.'}</p>{runningSelected && observed.length === 0 && <p>No relevant events observed yet.</p>}{observed.length > 0 && <ul>{observed.map(event => <li key={event.seq}><span className="mono">T+{event.t} min</span> <strong>{event.kind}</strong>{[sentence(event.model), sentence(event.verdict), sentence(event.status)].filter(Boolean).map((value, index) => <span key={index}> · {value}</span>)}</li>)}</ul>}<p>Open Operator for the full model outputs, approvals and execution records.</p></section>}
      {loading && <p role="status">Loading the scenario schedule…</p>}
      {events.length > 0 && <section className="scenario-guide__schedule"><h3>{previewOnly ? '06 / Scripted schedule · director truth' : 'Scripted schedule · director truth'}</h3><p>{runningSelected ? `${released} of ${events.length} scheduled times reached. This does not confirm execution.` : 'Preview only. Start this scenario to follow its clock.'}</p><ol>{events.map((event, index) => <li key={`${event.at}-${index}`} data-state={event.at <= now ? 'reached' : 'upcoming'}><time className="mono">T+{event.at} min</time><div><strong>{event.label}</strong>{event.actor && <span>Scripted actor: {event.actor}</span>}{event.detail && <span>{event.detail}</span>}<small>{event.at <= now ? 'Scheduled time reached · inspect recorded events' : 'Upcoming · scenario ground truth'}</small></div></li>)}</ol></section>}
      {error && <p className="scenario-guide__notice" role="status">{error} The catalogue story remains available.</p>}
      <p className="scenario-guide__boundary">Schedule entries describe the exercise. They do not prove detection, execution or recovery.</p>
      {!previewOnly && <Link className="scenario-guide__operator" to={`/operations${search}`}>Open the full Operator view <ArrowRight size={16} /></Link>}
    </>}
  </Panel></div>;
}
