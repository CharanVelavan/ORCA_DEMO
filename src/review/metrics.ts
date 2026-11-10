import type { LiveEvent } from '../types';

export type Threat = { id: string; label: string; target: string; start: number; end: number | null; truthClass: string };
export type Timing = { threat: Threat; detect: number | null; detectSource: string; contain: number | null; heal: number | null };
export type Decision = { minute: number; ts: string; playbook: string; owner: string; targets: string; who: string; status: string };
export type GapRow = { id: string; verdict: string; minute: number; text: string; decision: string | null };
export type Metrics = {
  file: string; scenario: string; events: number; lastMinute: number;
  threats: Threat[]; timings: Timing[]; decisions: Decision[]; gaps: GapRow[];
  impact: { key: string; real: number; shadow: number }[] | null;
};

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const targetsOf = (e: LiveEvent): string[] => (Array.isArray(e.targets) ? (e.targets as unknown[]).map(String) : []);
const short = (s: string, n = 110) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}...` : t; };

export function computeMetrics(events: LiveEvent[], file: string, scenario: string): Metrics {
  const lastMinute = events.reduce((m, e) => Math.max(m, num(e.t)), 0);
  const threats: Threat[] = events.filter((e) => e.kind === 'inject').map((e, i) => ({
    id: str(e.id) || `INJ-${i + 1}`, label: str(e.label) || str(e.injector) || 'Injected threat', target: str(e.target),
    start: typeof e.start === 'number' ? e.start : num(e.t), end: typeof e.end === 'number' ? e.end : null, truthClass: str(e.truth_class),
  }));

  const timings: Timing[] = threats.map((th) => {
    const after = (e: LiveEvent) => num(e.t) >= th.start;
    const alert = events.find((e) => (e.kind === 'alert' || (e.kind === 'model' && (e.state === 'flagged' || e.class))) && str(e.site) === th.target && after(e));
    const task = events.find((e) => e.kind === 'agent_task' && str(e.task).includes(th.target) && after(e));
    const det = alert ?? task ?? null;
    const detectSource = alert ? 'alert' : task ? 'agent tasked (inferred)' : '';
    const from = det ? num(det.t) : th.start;
    const execs = events.filter((e) => e.kind === 'execute' && e.result !== 'refused' && num(e.t) >= from);
    const contain = execs.find((e) => targetsOf(e).includes(th.target)) ?? execs[0] ?? null;
    const healEv = events.find((e) => e.kind === 'heal' && str(e.site) === th.target && after(e));
    let healMin: number | null = healEv ? num(healEv.t) : null;
    if (healMin === null && contain) {
      let seenBad = false;
      for (const e of events) {
        if (e.kind !== 'tick' || num(e.t) < th.start) continue;
        const st = ((e.sites ?? {}) as Record<string, { state?: string }>)[th.target]?.state;
        if (st && st !== 'ok') seenBad = true;
        else if (st === 'ok' && seenBad && num(e.t) >= num(contain.t)) { healMin = num(e.t); break; }
      }
    }
    const d = (m: number | null) => (m === null ? null : Math.max(0, m - th.start));
    return { threat: th, detect: d(det ? num(det.t) : null), detectSource, contain: d(contain ? num(contain.t) : null), heal: d(healMin) };
  });

  const decisions: Decision[] = events.filter((e) => e.kind === 'approval' && e.status !== 'requested').map((e) => ({
    minute: num(e.t), ts: str(e.ts), playbook: str(e.playbook), owner: str(e.owner), targets: targetsOf(e).join(', '),
    status: str(e.status), who: e.status === 'auto' ? 'Auto (inside granted scope)' : e.status === 'rejected' ? 'Human (rejected)' : 'Human (commander click)',
  }));

  const humanChoice = new Map<string, string>();
  events.filter((e) => e.kind === 'gap_human_decision').forEach((e) => humanChoice.set(str(e.draft_id), str(e.decision)));
  const seen = new Set<string>();
  const gaps: GapRow[] = [];
  for (const e of events) {
    const id = str(e.gap_id);
    if (e.kind !== 'verdict' || !id || seen.has(id)) continue;
    seen.add(id);
    gaps.push({ id, verdict: str(e.verdict), minute: num(e.t), text: short(str(e.explanation) || str(e.topic)), decision: humanChoice.get(id) ?? null });
  }

  const lastImpact = [...events].reverse().find((e) => e.kind === 'impact');
  let impact: Metrics['impact'] = null;
  if (lastImpact) {
    const real = (lastImpact.real ?? {}) as Record<string, unknown>;
    const shadow = (lastImpact.shadow ?? {}) as Record<string, unknown>;
    const keys = Array.from(new Set([...Object.keys(real), ...Object.keys(shadow)])).filter((k) => typeof real[k] === 'number' || typeof shadow[k] === 'number');
    impact = keys.map((key) => ({ key, real: num(real[key]), shadow: num(shadow[key]) }));
  }
  return { file, scenario, events: events.length, lastMinute, threats, timings, decisions, gaps, impact };
}
