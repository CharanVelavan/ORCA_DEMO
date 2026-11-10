/**
 * derive.ts — the single source of truth for every number, name and id shown in the UI.
 *
 * Rules (docs/plan/UI_MOCKUP_BUILD_PLAN.md §2, HARD RULES):
 *  - Every value comes from engine events or the canonical repo files
 *    (dashboard/topology.py, scenarios/*.yaml, playbooks/catalogue.yaml, kb/*).
 *    Nothing is hard-coded demo data and no regulation is invented here.
 *  - The satellite is never "compromised"; only SAT-MGMT or a gateway can be.
 *  - M2 shows minutes-to-failure (no confidence); M4 shows allocation + optimal/feasible
 *    (no confidence). M1 shows its score. M3 shows its class and confidence, or "abstain".
 *
 * Input is a typed *structural* shape (everything optional) so this module compiles and
 * runs whether or not the live store has populated a field yet. `useDerived()` binds it
 * to the live store; pages call the selectors, never read raw numbers themselves.
 */
import { useEffect, useState } from 'react';
import { api } from './api';
import { taskEvidence } from './workflow';
import { useLiveStore } from './store';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, Approval, LiveEvent, SiteState } from './types';

/* ------------------------------------------------------------------ *
 * Canonical constants — sourced from dashboard/topology.py and the
 * agent role files (agents/roles/*.yaml). IDs/labels are not invented.
 * ------------------------------------------------------------------ */

export type SiteMeta = { id: string; area: string; role: string };
/** The six emulated Chennai sites, in dashboard/topology.py order. */
export const SITES: SiteMeta[] = [
  { id: 'CHN-01', area: 'Park Town', role: 'hospital corridor' },
  { id: 'CHN-02', area: 'T. Nagar', role: 'shops, UPI and ATMs' },
  { id: 'CHN-03', area: 'Adyar', role: 'homes, 112' },
  { id: 'CHN-04', area: 'Guindy', role: 'grid communications' },
  { id: 'CHN-05', area: 'Ennore', role: 'coastal, cyclone-exposed' },
  { id: 'CHN-06', area: 'OMR', role: 'offices, traffic signals' },
];
export const SITE_COUNT = SITES.length;

export const GATEWAYS = [
  { id: 'GW-IN-1', label: 'Gateway 1 (India, primary)', allowed: true },
  { id: 'GW-IN-2', label: 'Gateway 2 (India, backup)', allowed: true },
  { id: 'GW-XX', label: 'Gateway outside India (forbidden)', allowed: false },
];
export const MGMT = { id: 'SAT-MGMT', label: 'Satellite operator management network' };

/** The six operator agents, plus the gap analyst and the human commander.
 *  Role ids match agents/roles/*.yaml. Models (M1–M4) are NOT agents. */
export type RoleMeta = { role: string; label: string; kind: 'operator' | 'analyst' | 'human' };
export const AGENT_ROLES: RoleMeta[] = [
  { role: 'mobile_operator', label: 'Mobile operator', kind: 'operator' },
  { role: 'satellite_operator', label: 'Satellite operator', kind: 'operator' },
  { role: 'power_utility', label: 'Power utility', kind: 'operator' },
  { role: 'cert_in', label: 'CERT-In', kind: 'operator' },
  { role: 'regulator', label: 'Telecom regulator', kind: 'operator' },
  { role: 'policy_adviser', label: 'Policy adviser', kind: 'operator' },
  { role: 'gap_analyst', label: 'Gap analyst', kind: 'analyst' },
  { role: 'commander', label: 'Incident commander', kind: 'human' },
];
/** The six coordinating operator agents only (the "n/6" count). */
export const OPERATOR_ROLES = AGENT_ROLES.filter((r) => r.kind === 'operator');

export const MODELS = [
  { id: 'M1', label: 'Anomaly detector' },
  { id: 'M2', label: 'Failure forecaster' },
  { id: 'M3', label: 'Attack classifier' },
  { id: 'M4', label: 'Capacity planner' },
];

/** Canonical lifecycle (title order). Never renamed per page. Engine `phase`
 *  events carry these ids in `active` / `latest`. */
export type PhaseId = 'predict' | 'heal' | 'coordinate' | 'contain' | 'fix' | 'report';
export const PHASES: { id: PhaseId; label: string }[] = [
  { id: 'predict', label: 'Predict' },
  { id: 'heal', label: 'Heal' },
  { id: 'coordinate', label: 'Coordinate' },
  { id: 'contain', label: 'Contain' },
  { id: 'fix', label: 'Fix' },
  { id: 'report', label: 'Report gaps' },
];

export type SiteStateName = 'ok' | 'degraded' | 'down' | 'healing' | 'unknown';
export type Tone = 'ok' | 'warn' | 'critical' | 'healing' | 'accent' | 'unknown';
export const SITE_STATE: Record<SiteStateName, { word: string; tone: Tone }> = {
  ok: { word: 'Operational', tone: 'ok' },
  degraded: { word: 'Degraded', tone: 'warn' },
  down: { word: 'Down', tone: 'critical' },
  healing: { word: 'Recovering', tone: 'healing' },
  unknown: { word: 'Unavailable', tone: 'unknown' },
};

/* ------------------------------------------------------------------ *
 * Structural input (all optional → safe before the store fills up).
 * ------------------------------------------------------------------ */
export type DeriveInput = {
  session?: Record<string, unknown>;
  sites?: Record<string, SiteState>;
  gateways?: Record<string, string>;
  tickHistory?: LiveEvent[];
  phaseHistory?: LiveEvent[];
  events?: LiveEvent[];
  models?: LiveEvent[];
  alerts?: LiveEvent[];
  approvals?: Approval[];
  gaps?: LiveEvent[];
  verdicts?: LiveEvent[];
  obligations?: LiveEvent[];
  agents?: Record<string, Agent>;
  impact?: LiveEvent | null;
  summary?: LiveEvent | null;
  autonomy?: LiveEvent | null;
  kill?: LiveEvent | null;
  ts?: string;
  t?: number;
};

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const last = <T,>(items: T[]): T | undefined => (items.length ? items[items.length - 1] : undefined);

/* ------------------------------------------------------------------ *
 * Sites / network health.
 * ------------------------------------------------------------------ */
export type SiteView = SiteMeta & { state: SiteStateName; raw?: SiteState };

export function sites(d: DeriveInput): SiteView[] {
  const s = d.sites ?? {};
  return SITES.map((m) => {
    const raw = s[m.id];
    const state = raw?.state ?? 'unknown';
    return { ...m, state, raw };
  });
}

export function sitesAffected(d: DeriveInput): { affected: number; total: number } {
  const affected = sites(d).filter((x) => x.state !== 'ok' && x.state !== 'unknown').length;
  return { affected, total: SITE_COUNT };
}

export function gatewayHealth(d: DeriveInput): { up:number; total:number } | undefined {
  const allowed = GATEWAYS.filter((gateway) => gateway.allowed);
  if (!allowed.every((gateway) => typeof d.gateways?.[gateway.id] === 'string')) return undefined;
  return { up:allowed.filter((gateway) => d.gateways?.[gateway.id] === 'up').length, total:allowed.length };
}

/** Current delivered share, not the cumulative impact over the run. */
export function networkHealthPct(d: DeriveInput): number | undefined {
  const tick = last(d.tickHistory ?? []);
  const entries = Object.values((tick?.services ?? {}) as Record<string, Record<string, unknown>>);
  if (entries.length) {
    const values = entries.map((entry) => ({ demand:num(entry.demand_mbps), delivered:num(entry.delivered_mbps) }));
    if (values.every((v) => v.demand !== undefined && v.delivered !== undefined)) {
      const demand = values.reduce((sum, v) => sum + v.demand!, 0);
      if (demand > 0) return Math.round(values.reduce((sum, v) => sum + v.delivered!, 0) / demand * 1000) / 10;
    }
  }
  const instant = (d.impact?.instantaneous ?? {}) as Record<string, unknown>;
  return num(instant.network_availability_pct);
}

/** Current aggregate service availability, on the same instantaneous basis. */
export function serviceAvailabilityPct(d: DeriveInput): number | undefined {
  return networkHealthPct(d);
}

/** True once the engine has emitted live site/tick/impact telemetry. Before that,
 *  availability and health are Unavailable (never a default 100). */
export function hasTelemetry(d: DeriveInput): boolean {
  return Object.keys(d.sites ?? {}).length > 0 || (d.tickHistory?.length ?? 0) > 0;
}

/** Render helper: a percentage Stat, or "Unavailable" when the value is missing. */
export function pctView(n?: number): { value: string; unit?: string } {
  return n === undefined ? { value: 'Unavailable' } : { value: String(n), unit: '%' };
}

/* ------------------------------------------------------------------ *
 * Services (per-service delivered Mbps — work item A, tick.services).
 * ------------------------------------------------------------------ */
export type ServiceView = { id: string; label: string; delivered?: number; capacity?: number; demand?: number };

function latestTickServices(d: DeriveInput): Record<string, unknown> | undefined {
  const t = last(d.tickHistory ?? []);
  const sv = (t?.services ?? undefined) as Record<string, unknown> | undefined;
  return sv;
}

export function services(d: DeriveInput): ServiceView[] {
  const sv = latestTickServices(d);
  if (!sv) return [];
  return Object.entries(sv).map(([id, v]) => {
    const o = (v ?? {}) as Record<string, unknown>;
    return {
      id,
      label: str(o.label) ?? id,
      delivered: num(o.delivered_mbps) ?? num(o.delivered),
      capacity: num(o.capacity_mbps) ?? num(o.capacity),
      demand: num(o.demand_mbps) ?? num(o.demand),
    };
  });
}

export function deliveredMbps(d: DeriveInput): number | undefined {
  const rows = services(d);
  if (!rows.length || rows.some((row) => row.delivered === undefined)) return undefined;
  return rows.reduce((total, row) => total + row.delivered!, 0);
}

/** A delivered-Mbps series per service across tickHistory, for sparklines/charts. */
export function serviceSeries(d: DeriveInput): { id: string; label: string; points: { t: number; ts?: string; value: number }[] }[] {
  const ticks = d.tickHistory ?? [];
  const byId = new Map<string, { id: string; label: string; points: { t: number; ts?: string; value: number }[] }>();
  for (const tk of ticks) {
    const sv = (tk.services ?? undefined) as Record<string, unknown> | undefined;
    if (!sv) continue;
    for (const [id, v] of Object.entries(sv)) {
      const o = (v ?? {}) as Record<string, unknown>;
      const value = num(o.delivered_mbps) ?? num(o.delivered);
      if (value === undefined) continue;
      if (!byId.has(id)) byId.set(id, { id, label: str(o.label) ?? id, points: [] });
      byId.get(id)!.points.push({ t: num(tk.t) ?? 0, ts: str(tk.ts), value });
    }
  }
  return [...byId.values()];
}

/* ------------------------------------------------------------------ *
 * Models (M1–M4). Latest event per model + the right display fields.
 * ------------------------------------------------------------------ */
export type ModelView = {
  id: string;
  label: string;
  event?: LiveEvent;
  /** M1: anomaly score. */ score?: number;
  /** M3: class + confidence, or abstain. */ klass?: string; confidence?: number; abstain?: boolean;
  /** M2: median minutes to failure, bounded forecast window, and history. */ minutesToFailure?: number; forecastWindow?: number; spark?: number[];
  /** M4: allocation rows + optimal/feasible. */ allocation?: { site: string; service: string; mbps: number; demand?: number; pct?: number }[]; solution?: 'optimal' | 'feasible';
};

function currentModelEvent(events: LiveEvent[]): LiveEvent | undefined {
  const seen = new Set<string>();
  const latest: LiveEvent[] = [];
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    const site = str(event.site) ?? '';
    if (!seen.has(site)) { seen.add(site); latest.push(event); }
  }
  return latest.find((event) => {
    const state = str(event.state);
    if (state === 'ok' || state === 'normal') return false;
    const klass = str(event.class);
    return state === 'flagged' || state === 'unsure' || state === 'replan'
      || event.abstain === true || (klass !== undefined && klass !== 'normal');
  }) ?? latest[0];
}

export function models(d: DeriveInput): ModelView[] {
  const evs = d.models ?? [];
  return MODELS.map((m) => {
    const mine = evs.filter((e) => str(e.model) === m.id);
    const ev = currentModelEvent(mine);
    const v: ModelView = { id: m.id, label: m.label, event: ev };
    if (!ev) return v;
    if (m.id === 'M1') v.score = num(ev.score) ?? num(ev.anomaly_score);
    if (m.id === 'M3') {
      v.klass = str(ev.class);
      const c = num(ev.confidence);
      v.abstain = ev.abstain === true || v.klass === 'abstain';
      v.confidence = v.abstain ? undefined : c;
    }
    if (m.id === 'M2') {
      v.minutesToFailure = num(ev.horizon_min) ?? num(ev.minutes_to_failure) ?? num(ev.mtf);
      v.forecastWindow = num(ev.forecast_window_min);
      v.spark = mine.filter((e) => e.site === ev.site && e.metric === ev.metric)
        .map((e) => num(e.horizon_min) ?? num(e.minutes_to_failure) ?? num(e.mtf))
        .filter((n): n is number => n !== undefined);
    }
    if (m.id === 'M4') {
      const alloc = ev.allocation ?? ev.allocations;
      v.allocation = arr<Record<string, unknown>>(alloc)
        .map((a) => ({ site: str(a.site) ?? '', service:str(a.service) ?? '', mbps: num(a.granted_mbps) ?? num(a.mbps), demand:num(a.demand_mbps), pct:num(a.pct) }))
        .filter((a): a is { site:string; service:string; mbps:number; demand:number|undefined; pct:number|undefined } => Boolean(a.site && a.service) && a.mbps !== undefined);
      const sol = str(ev.solution) ?? str(ev.status);
      v.solution = sol === 'optimal' ? 'optimal' : sol === 'feasible' ? 'feasible' : undefined;
    }
    return v;
  });
}

/** Most recent M3 event with a non-normal class (ignores warming/abstain), so pages agree with alerts. */
export function latestM3Flag(d: DeriveInput): LiveEvent | undefined {
  const evs = d.models ?? [];
  for (let i = evs.length - 1; i >= 0; i--) {
    const e = evs[i];
    if (str(e.model) !== 'M3' || e.abstain === true) continue;
    const klass = str(e.class);
    if (klass && klass !== 'normal' && klass !== 'abstain' && str(e.state) !== 'warming') return e;
  }
  return undefined;
}

export function forecastText(model: ModelView): string {
  if (model.minutesToFailure !== undefined) return `${model.minutesToFailure} min to failure`;
  if (model.forecastWindow !== undefined) return `No failure within ${model.forecastWindow} min (median)`;
  return 'Time to failure unavailable';
}

/* ------------------------------------------------------------------ *
 * Agents (6 operators + gap analyst + commander). Models are excluded.
 * ------------------------------------------------------------------ */
export type AgentView = RoleMeta & { busy?: boolean; queue?: number; lastAction?: string; status: 'running' | 'waiting' | 'idle' };
export function agents(d: DeriveInput): AgentView[] {
  const map = d.agents ?? {};
  return AGENT_ROLES.map((r) => {
    const a = map[r.role];
    const busy = a?.busy === true;
    const queue = a?.queue ?? 0;
    const status: AgentView['status'] = busy ? 'running' : queue > 0 ? 'waiting' : 'idle';
    const la = a?.lastAction;
    const lastAction = la && la !== '[object Object]' ? la : undefined;
    return { ...r, busy, queue, lastAction, status };
  });
}
/** Operators online "n/6" — any operator role seen in the agents map. */
export function operatorsOnline(d: DeriveInput): { online: number; total: number } {
  const map = d.agents ?? {};
  const online = OPERATOR_ROLES.filter((r) => map[r.role] !== undefined).length;
  return { online, total: OPERATOR_ROLES.length };
}

/* ------------------------------------------------------------------ *
 * Phases → bottom stepper.
 * ------------------------------------------------------------------ */
export type StepView = { id: PhaseId; label: string; status: 'seen' | 'current' | 'pending'; isLatest: boolean; at?: string };
export function phaseSteps(d: DeriveInput): StepView[] {
  const phaseTasks: Record<PhaseId, string[]> = {
    predict:['detect','classify'], heal:['clean','heal'], coordinate:['coordinate','rules'],
    contain:['decision','contain'], fix:['rollout','reattack'], report:['gap','approval'],
  };
  const steps = PHASES.map((phase) => {
    const evidence = phaseTasks[phase.id].map((id) => taskEvidence(id,d));
    const visited = (d.phaseHistory ?? []).find((e) => e.latest === phase.id || arr<string>(e.active).includes(phase.id));
    const observed = evidence.find((item) => item.event);
    const status: StepView['status'] = evidence.some((item) => item.status === 'current') ? 'current' : observed || visited ? 'seen' : 'pending';
    return { id:phase.id, label:phase.label, status, isLatest:false, at:str(observed?.event?.ts) ?? str(visited?.ts) };
  });
  const primary = steps.filter((step) => step.status === 'current').at(-1);
  return steps.map((step) => ({ ...step, isLatest:step.id === primary?.id }));
}

/* ------------------------------------------------------------------ *
 * Incident timings (summary.timings + clock_obligation).
 * ------------------------------------------------------------------ */
export type TimingView = {
  /** All cumulative/elapsed minute values; undefined means UNAVAILABLE (never render as 0 or success). */
  detectMin?: number; notifyMin?: number; restoreMin?: number;
  /** True while in-progress (derived from events, before the final `summary` event). */
  inProgress: boolean;
  obligation?: { regime?: string; dueAt?: string; status?: string };
};
export function timings(d: DeriveInput): TimingView {
  const t = (d.summary?.timings ?? {}) as Record<string, unknown>;
  const ob = last((d.obligations ?? []));
  const notifications = t.time_to_notify_min;
  const notify = notifications && typeof notifications === 'object'
    ? Object.values(notifications).map(num).find((value) => value !== undefined) : undefined;
  return {
    inProgress: d.summary?.final !== true,
    detectMin: num(t.time_to_detect_min),
    notifyMin: notify,
    restoreMin: num(t.time_to_restore_min),
    obligation: ob ? { regime: str(ob.regime), dueAt: str(ob.due_at), status: str(ob.status) } : undefined,
  };
}

/* ------------------------------------------------------------------ *
 * Citations / KB. Only record ids (never free text).
 * ------------------------------------------------------------------ */
export function citationIds(d: DeriveInput): string[] {
  const ids = new Set<string>();
  const addIds = (value:unknown) => {
    for (const id of arr(value)) if (typeof id === 'string') ids.add(id);
  };
  for (const v of d.verdicts ?? []) { addIds(v.records); addIds(v.record_ids); }
  for (const g of d.gaps ?? []) {
    addIds(g.records);
    addIds(g.evidence);
    const india = (g as Record<string, unknown>).india;
    if (india && typeof india === 'object') addIds((india as Record<string, unknown>).records);
    for (const ex of arr<Record<string, unknown>>((g as Record<string, unknown>).global_examples)) {
      const rid = str(ex.record) ?? str(ex.id);
      if (rid) ids.add(rid);
    }
  }
  return [...ids];
}
/** KB record count from a session manifest, when present. */
export function kbRecordCount(d: DeriveInput): number | undefined {
  const sess = (d.session ?? {}) as Record<string, unknown>;
  return num((sess.kb_manifest as Record<string, unknown> | undefined)?.records) ?? num(sess.kb_records);
}

/* ------------------------------------------------------------------ *
 * Incidents / alerts.
 * ------------------------------------------------------------------ */
export function openApprovals(d: DeriveInput): Approval[] {
  return (d.approvals ?? []).filter((a) => a.status === 'requested' || a.status === 'pending');
}
export function openGaps(d: DeriveInput): LiveEvent[] {
  return (d.gaps ?? []).filter((g) => {
    const s = str(g.status);
    return s === 'candidate' || s === 'confirmed' || s === undefined;
  });
}
/** Bell count = open approvals + new gaps (UI_MOCKUP_BUILD_PLAN §1). */
export function bellCount(d: DeriveInput): number {
  return openApprovals(d).length + openGaps(d).length;
}
/** Active incidents = distinct open alert ids (Home KPI). */
export function activeIncidents(d: DeriveInput): number {
  const ids = new Set<string>();
  for (const a of d.alerts ?? []) { const id = str(a.id); if (id) ids.add(id); }
  return ids.size;
}

/* ------------------------------------------------------------------ *
 * Scenario / session context.
 * ------------------------------------------------------------------ */
export type ScenarioCtx = { id?: string; title?: string; kind?: string; region: string; emulated: true };
export function scenarioCtx(d: DeriveInput): ScenarioCtx {
  const sess = (d.session ?? {}) as Record<string, unknown>;
  return {
    id: str(sess.scenario)?.toUpperCase(),
    title: str(sess.title),
    kind: str(sess.kind),
    region: 'Chennai, IN',
    emulated: true,
  };
}

/* ------------------------------------------------------------------ *
 * Live binding to the store.
 * ------------------------------------------------------------------ */
export function selectInput(s: ReturnType<typeof useLiveStore.getState>): DeriveInput {
  return {
    session: s.session,
    sites: s.sites,
    gateways: s.gateways,
    tickHistory: s.tickHistory,
    phaseHistory: s.phaseHistory,
    events: s.events,
    models: s.models,
    alerts: s.alerts,
    approvals: s.approvals,
    gaps: s.gaps,
    verdicts: s.verdicts,
    obligations: s.obligations,
    agents: s.agents,
    impact: s.impact,
    summary: s.summary,
    autonomy: s.autonomy,
    kill: s.kill,
    ts: s.ts,
    t: s.t,
  };
}

/** Hook: read the live store as a derive input. Pages build all numbers from this. */
export function useDerived(): DeriveInput {
  return useLiveStore(useShallow(selectInput));
}

/* ------------------------------------------------------------------ *
 * Catalogue manifest counts (KB records / gaps / roles / scenarios).
 * Exposed by the engine on /api/catalogue; read defensively so the UI still
 * works against an engine that has not yet shipped the counts.
 * ------------------------------------------------------------------ */
export type CatalogueCounts = { records?: number; gaps?: number; roles?: number; scenarios?: number };

function readCounts(c: Record<string, unknown>): CatalogueCounts {
  const kb = (c.kb ?? {}) as Record<string, unknown>;
  const counts = (c.counts ?? {}) as Record<string, unknown>;
  const len = (v: unknown) => (Array.isArray(v) ? v.length : undefined);
  return {
    records: num(kb.records) ?? num(counts.records) ?? num(c.kb_records) ?? len(c.records),
    gaps: num(kb.gaps) ?? num(counts.gaps) ?? num(c.kb_gaps) ?? len(c.gaps),
    roles: num(counts.roles) ?? num(c.roles_count) ?? len(c.roles),
    scenarios: len(c.scenarios),
  };
}

let catalogueRevision = 0;
let catalogueCounts: { key:string; counts:CatalogueCounts } | null = null;
let catalogueRequest: { key:string; promise:Promise<CatalogueCounts> } | null = null;
useLiveStore.subscribe((state, previous) => {
  if (state.session.kb !== previous.session.kb) {
    catalogueRevision += 1;
    catalogueCounts = null;
    catalogueRequest = null;
  }
});

function catalogueKey(): string {
  const fake = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fake') === '1';
  return `${fake ? 'fixture' : 'live'}:${String(useLiveStore.getState().session.kb ?? 'unknown')}:${catalogueRevision}`;
}

/** Cache counts only for the current source and knowledge-base revision. */
export function fetchCatalogueCounts(): Promise<CatalogueCounts> {
  const key = catalogueKey();
  if (catalogueCounts?.key === key) return Promise.resolve(catalogueCounts.counts);
  if (catalogueRequest?.key !== key) {
    const promise = api.catalogue()
      .then((c) => {
        const counts = readCounts(c);
        if (catalogueKey() === key) catalogueCounts = { key, counts };
        return counts;
      })
      .finally(() => { if (catalogueRequest?.key === key) catalogueRequest = null; });
    catalogueRequest = { key, promise };
  }
  return catalogueRequest.promise;
}

/** Hook: catalogue counts for the active KB; old-jurisdiction counts are never shown. */
export function useCatalogueCounts(): CatalogueCounts {
  useLiveStore((state) => state.session.kb);
  const key = catalogueKey();
  const [result, setResult] = useState<{ key:string; counts:CatalogueCounts }>(() => ({
    key, counts:catalogueCounts?.key === key ? catalogueCounts.counts : {},
  }));
  useEffect(() => {
    let live = true;
    fetchCatalogueCounts().then((counts) => { if (live) setResult({ key, counts }); }).catch((error: unknown) => {
      if (live) console.error('Unable to load catalogue counts:', error);
    });
    return () => { live = false; };
  }, [key]);
  return result.key === key ? result.counts : {};
}
