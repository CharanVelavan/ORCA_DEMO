import { models, serviceSeries, services, type DeriveInput } from '../derive';
import { finite, object, text, timestampMs } from '../policy/data';
import type { LiveEvent } from '../types';

export type AvailabilityPoint = { t: number; ts?: string; value: number };
export type Marker = { t: number; ts?: string; kind: 'alert' | 'degradation' | 'execute' | 'fix' | 'rollback'; label: string; seq: number };
export type ServicePoint = { t: number; ts?: string; value: number };
export type ServiceTrace = { id: string; label: string; points: ServicePoint[] };
export type SiteMeasurement = {
  id: string;
  state?: string;
  delivered?: number;
  demand?: number;
  capacity?: number;
  activePath?: string;
  gateway?: string;
};
export type Check = { label: string; status: 'pass' | 'fail' | 'unknown'; detail: string };

export const serviceLabel = (id: string): string => {
  const labels: Record<string, string> = { '112': '112', hospital: 'Hospital', upi_atm: 'UPI / ATM', grid: 'Grid', general: 'General' };
  return labels[id] ?? id.replace(/_/g, ' ');
};

const publicCache = new WeakMap<readonly LiveEvent[], LiveEvent[]>();
const publicOnly = (list: readonly LiveEvent[] | undefined): LiveEvent[] => {
  if (!list) return [];
  let hit = publicCache.get(list);
  if (!hit) {
    hit = list.some((event) => event.audience === 'control') ? list.filter((event) => event.audience !== 'control') : list as LiveEvent[];
    publicCache.set(list, hit);
    publicCache.set(hit, hit);
  }
  return hit;
};
const publicEvents = (data: DeriveInput): LiveEvent[] => publicOnly(data.events);

export function publicRecoveryInput(data: DeriveInput): DeriveInput {
  return {
    ...data,
    tickHistory: publicOnly(data.tickHistory),
    events: publicEvents(data),
    models: publicOnly(data.models),
    impact: data.impact?.audience === 'control' ? null : data.impact,
    summary: data.summary?.audience === 'control' ? null : data.summary,
  };
}

export function availabilitySeries(data: DeriveInput): AvailabilityPoint[] {
  const impacts = new Map<number, LiveEvent>();
  for (const event of publicEvents(data)) {
    const t = finite(event.t);
    if (event.kind === 'impact' && t !== undefined) impacts.set(t, event);
  }
  const result = new Map<number, AvailabilityPoint>();
  for (const tick of data.tickHistory ?? []) {
    if (tick.audience === 'control') continue;
    const t = finite(tick.t);
    if (t === undefined) continue;
    const impact = impacts.get(t);
    const delivery = object(object(object(impact?.real).delivery).now);
    const value = finite(object(delivery.network).pct) ?? finite(object(impact?.instantaneous).network_availability_pct);
    if (value !== undefined) result.set(t, { t, ts: text(tick.ts) ?? text(impact?.ts), value });
  }
  return [...result.values()].sort((a, b) => a.t - b.t);
}

export function deliverySeries(data: DeriveInput): ServiceTrace[] {
  const ticks = (data.tickHistory ?? []).filter((tick) => tick.audience !== 'control' && finite(tick.t) !== undefined);
  return serviceSeries({ ...data, tickHistory: ticks }).map((series) => ({
    ...series, label: serviceLabel(series.id),
    points: series.points.filter((point) => Number.isFinite(point.t) && Number.isFinite(point.value)),
  })).filter((series) => series.points.length > 0);
}

export function siteMeasurements(data: DeriveInput): SiteMeasurement[] {
  const tick = (data.tickHistory ?? []).filter((event) => event.audience !== 'control' && event.kind === 'tick').at(-1);
  const sites = object(tick?.sites);
  return Object.entries(sites).map(([id, value]) => {
    const site = object(value);
    return {
      id,
      state: text(site.state),
      delivered: finite(site.delivered_mbps),
      demand: finite(site.demand_mbps),
      capacity: finite(site.capacity_mbps),
      activePath: text(site.active_path),
      gateway: text(site.gateway),
    };
  });
}

function rollbackPlaybookMap(events: LiveEvent[]): Map<string, string> {
  const byHash = new Map<string, string>();
  for (const event of events) {
    if (event.kind !== 'approval' && event.kind !== 'execute') continue;
    const hash = text(event.hash);
    const playbook = text(event.playbook);
    if (hash && playbook) byHash.set(hash, playbook);
  }
  return byHash;
}

export function rollbackPlaybook(event: LiveEvent, events: LiveEvent[]): string | undefined {
  return text(event.playbook) ?? rollbackPlaybookMap(events).get(text(event.hash) ?? '');
}

export function recoveryMarkers(data: DeriveInput): Marker[] {
  const markers: Marker[] = [];
  const events = publicEvents(data);
  for (const event of events) {
    const t = finite(event.t);
    if (t === undefined) continue;
    const base = { t, ts: text(event.ts), seq: event.seq };
    if (event.kind === 'alert' && event.source === 'M3') {
      markers.push({ ...base, kind: 'alert', label: `M3 detection: ${text(event.label) ?? 'class unavailable'}` });
    } else if (event.kind === 'execute' && (event.result === 'ok' || object(event.result).ok === true)) {
      markers.push({ ...base, kind: 'execute', label: `Execute: ${text(event.playbook) ?? 'playbook unavailable'}` });
    } else if (event.kind === 'patch_stage' && finite(event.pct) === 100 && event.health === 'ok') {
      markers.push({ ...base, kind: 'fix', label: `Patch stage complete: ${text(event.playbook) ?? 'playbook unavailable'}` });
    } else if (event.kind === 'rollback') {
      markers.push({ ...base, kind: 'rollback', label: `Rollback: ${rollbackPlaybook(event, events) ?? 'playbook unavailable'}` });
    }
  }
  const summary = publicRecoveryInput(data).summary;
  const degraded = object(object(summary?.timings).degraded);
  const degradedAt = finite(degraded.t);
  if (summary && degradedAt !== undefined) markers.push({
    t: degradedAt, ts: text(degraded.ts), kind: 'degradation',
    label: 'Observed service degradation', seq: summary.seq,
  });
  return markers.sort((a, b) => a.t - b.t || a.seq - b.seq);
}

export function observedOutageMinutes(data: DeriveInput): number | undefined {
  const timing = object(publicRecoveryInput(data).summary?.timings);
  const start = timestampMs(object(timing.degraded).ts);
  const end = timestampMs(timing.restored_at);
  return start !== undefined && end !== undefined && end >= start ? (end - start) / 60000 : undefined;
}

export function availabilityAfter(data: DeriveInput, samples: AvailabilityPoint[]): number | undefined {
  const restored = timestampMs(object(publicRecoveryInput(data).summary?.timings).restored_at);
  if (restored === undefined) return undefined;
  return samples.find((point) => {
    const at = timestampMs(point.ts);
    return at !== undefined && at >= restored;
  })?.value;
}

export function recoveryChecks(data: DeriveInput): Check[] {
  const publicData = publicRecoveryInput(data);
  const rows = services(publicData);
  const valid = rows.length > 0 && rows.every((row) => row.delivered !== undefined && row.demand !== undefined);
  const hasDemand = valid && rows.some((row) => row.demand! > 0);
  const allMet = hasDemand && rows.every((row) => row.delivered! >= row.demand!);
  const selectedModels = models(publicData);
  const states = selectedModels.map((model) => text(model.event?.state));
  const flagged = states.some((state) => state === 'flagged' || state === 'replan');
  const allNormal = states.every((state) => state === 'ok' || state === 'normal');
  const heal = publicEvents(data).filter((event) => event.kind === 'heal').at(-1);
  const clean = object(heal?.check).clean;
  return [
    { label: 'Link stability', status: 'unknown', detail: 'No link-stability check was emitted.' },
    {
      label: 'Current service demand',
      status: !hasDemand ? 'unknown' : allMet ? 'pass' : 'fail',
      detail: !hasDemand ? 'Complete demand and delivery measurements are unavailable.'
        : allMet ? 'Each reported service currently meets its measured demand.'
          : 'At least one reported service receives less than its measured demand.',
    },
    {
      label: 'Reported model states',
      status: flagged ? 'fail' : allNormal ? 'pass' : 'unknown',
      detail: flagged ? 'At least one selected model reports a flagged state.'
        : allNormal ? 'The selected model reports have normal states. This is not a network-wide clearance.'
          : 'At least one model state is missing or requires review.',
    },
    { label: 'Resilience target', status: 'unknown', detail: 'No resilience threshold was emitted.' },
    {
      label: 'Clean-path check',
      status: clean === true ? 'pass' : clean === false ? 'fail' : 'unknown',
      detail: clean === true ? 'The latest recorded path check is clean.'
        : clean === false ? 'The latest recorded path check is not clean.' : 'No path-check result was emitted.',
    },
  ];
}

export type Rollout = { playbook?: string; stages: { pct: number; event?: LiveEvent }[]; rolledBack: boolean; attempt: number; attempts: number; earlierFailed: number };

export function latestRollout(data: DeriveInput): Rollout {
  const events = publicEvents(data);
  const playbooksByHash = rollbackPlaybookMap(events);
  const belongsToPlaybook = (event: LiveEvent) =>
    text(event.playbook) ?? playbooksByHash.get(text(event.hash) ?? '');
  const stages = events.filter((event) => event.kind === 'patch_stage');
  const latest = stages.at(-1);
  const playbook = text(latest?.playbook);
  if (!latest || !playbook) return { stages: [5, 25, 100].map((pct) => ({ pct })), rolledBack: false, attempt: 0, attempts: 0, earlierFailed: 0 };
  // A new attempt starts at the 5 % stage or after a rollback; the engine may flush rollbacks after later stages.
  const attempts: LiveEvent[][] = [];
  for (const event of events) {
    if (belongsToPlaybook(event) !== playbook) continue;
    if (event.kind === 'rollback') { if (attempts.at(-1)?.length) attempts.push([]); continue; }
    if (event.kind !== 'patch_stage') continue;
    if (!attempts.length || finite(event.pct) === 5) attempts.push([]);
    attempts.at(-1)!.push(event);
  }
  const filled = attempts.filter((attempt) => attempt.length);
  const current = filled.at(-1) ?? [];
  const failed = (attempt: LiveEvent[]) => attempt.some((event) => text(event.health) !== undefined && event.health !== 'ok');
  const earlierFailed = filled.slice(0, -1).filter(failed).length;
  const lateRollbacks = events.filter((event) =>
    event.kind === 'rollback' && belongsToPlaybook(event) === playbook && event.seq > latest.seq).length;
  return {
    playbook,
    stages: [5, 25, 100].map((pct) => ({ pct, event: current.filter((event) => finite(event.pct) === pct).at(-1) })),
    rolledBack: failed(current) ? lateRollbacks > 0 : lateRollbacks > earlierFailed,
    attempt: filled.length, attempts: filled.length, earlierFailed,
  };
}

export function measurementSummary(data: DeriveInput) {
  const publicData = publicRecoveryInput(data);
  const totals = object(publicData.summary?.services);
  return services(publicData).map((service) => {
    const historical = object(totals[service.id]);
    return {
      ...service,
      label: serviceLabel(service.id),
      pct: service.demand !== undefined && service.demand > 0 && service.delivered !== undefined
        ? service.delivered / service.demand * 100 : undefined,
      minPct: finite(historical.instant_pct_min),
      cumulativePct: finite(historical.cumulative_pct),
    };
  });
}
