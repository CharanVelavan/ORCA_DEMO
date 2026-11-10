import type { AuditChain, LiveEvent } from '../types';

export type AuditEntry = {
  seq: number;
  ts?: string;
  actor: string;
  kind: string;
  hash?: string;
  prev_hash?: string;
  payload: Record<string, unknown>;
  raw: Record<string, unknown>;
};

export type ActorType = 'agent' | 'model' | 'human' | 'autonomy' | 'rule' | 'system';
export const ACTOR_TYPES: { id: ActorType; label: string }[] = [
  { id: 'agent', label: 'Agent' },
  { id: 'model', label: 'Model' },
  { id: 'human', label: 'Human' },
  { id: 'autonomy', label: 'Autonomy grant' },
  { id: 'rule', label: 'Rule engine' },
  { id: 'system', label: 'System' },
];

const CONTROL_KINDS = new Set(['inject', 'scheduled', 'inject_stop', 'inject_stopped', 'truth']);

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined);
const list = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
const clip = (value: string, max = 140) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

/** Defence in depth: the server already withholds control entries; never show any that slip through. */
export function isControlEntry(entry: Record<string, unknown>): boolean {
  const payload = obj(entry.payload);
  return CONTROL_KINDS.has(String(entry.kind))
    || entry.audience === 'control'
    || payload.audience === 'control'
    || entry.truth === true
    || payload.truth === true;
}

export function toEntries(rows: Record<string, unknown>[] | undefined): AuditEntry[] {
  return (rows ?? []).filter((row) => !isControlEntry(row)).map((row, index) => ({
    seq: typeof row.seq === 'number' ? row.seq : index + 1,
    ts: str(row.ts),
    actor: str(row.actor) ?? 'unknown',
    kind: str(row.kind) ?? 'unknown',
    hash: str(row.hash),
    prev_hash: str(row.prev_hash),
    payload: obj(row.payload),
    raw: row,
  }));
}

export function actorType(actor: string): ActorType {
  if (actor.startsWith('human:') || actor === 'commander') return 'human';
  if (actor.startsWith('autonomy:')) return 'autonomy';
  if (actor === 'rules' || actor.startsWith('rule')) return 'rule';
  if (/^(model:|M[1-4]\b)/.test(actor)) return 'model';
  if (actor === 'system' || actor === 'scenario' || actor === 'unknown') return 'system';
  return 'agent';
}

export function actorLabel(actor: string): string {
  if (actor.startsWith('human:')) return actor.slice(6).replace(/_/g, ' ');
  if (actor.startsWith('autonomy:')) return actor.slice(9);
  if (actor === 'rules') return 'rule engine';
  return actor.replace(/_/g, ' ');
}

/** AI (agents and models) vs human vs deterministic (rule engine, autonomy policy, system). */
export function split(entries: AuditEntry[]) {
  const counts = { ai: 0, human: 0, deterministic: 0 };
  for (const entry of entries) {
    const type = actorType(entry.actor);
    if (type === 'agent' || type === 'model') counts.ai += 1;
    else if (type === 'human') counts.human += 1;
    else counts.deterministic += 1;
  }
  return counts;
}

export function summarize(entry: AuditEntry): string {
  const p = entry.payload;
  const targets = list(p.targets);
  const onTargets = targets.length ? ` on ${targets.join(', ')}` : '';
  switch (entry.kind) {
    case 'run_meta':
      return `Run started: scenario ${String(p.scenario ?? 'unavailable').toUpperCase()}, KB ${str(p.kb) ?? 'unavailable'}, rule engine ${p.rules === true ? 'on' : p.rules === false ? 'off' : 'unavailable'}, LLM ${str(p.llm) ?? 'unavailable'}`;
    case 'net_state':
      return `Emulated network state snapshot (${Object.keys(obj(p.sites)).length} sites, ${Object.keys(obj(p.gateways)).length} gateways)`;
    case 'agent_task':
      return clip(str(p.task) ?? 'Task text unavailable');
    case 'agent_step': {
      const tool = str(p.tool) ?? 'tool unavailable';
      const why = str(p.rationale);
      return clip(`${tool}${why ? `: ${why}` : ''}`);
    }
    case 'verdict': {
      const ids = list(p.record_ids).length ? list(p.record_ids) : list(p.records);
      return clip(`${str(p.verdict) ?? 'Verdict unavailable'} · ${str(p.rule_id) ?? str(p.rule) ?? 'rule id unavailable'} · ${ids.length ? ids.join(', ') : 'record ids unavailable'}`);
    }
    case 'approval_requested':
      return clip(`Requested ${str(p.playbook) ?? 'playbook'}${str(p.title) ? ` (${str(p.title)})` : ''}${onTargets}`);
    case 'approved':
      return `Approved ${str(p.playbook) ?? 'playbook'}`;
    case 'rejected':
      return `Rejected ${str(p.playbook) ?? 'playbook'}`;
    case 'executed':
      return clip(`Executed ${str(p.playbook) ?? 'playbook'}${onTargets}${str(p.detail) ? `: ${str(p.detail)}` : ''}`);
    case 'execute_refused':
      return clip(`Refused ${str(p.playbook) ?? 'playbook'}${onTargets}${str(p.reason) ? `: ${str(p.reason)}` : ''}`);
    case 'rolled_back':
      return clip(`Rolled back ${str(p.playbook) ?? 'playbook'}${onTargets}${str(p.detail) ? `: ${str(p.detail)}` : ''}`);
    case 'autonomy_set':
      return `Autonomy ${str(p.mode) ?? 'mode unavailable'} granted by ${str(p.granted_by) ?? 'unavailable'} until ${str(p.expires) ?? 'unavailable'}`;
    case 'autonomy_downgraded':
      return `Autonomy downgraded ${str(p.from) ?? '?'} to ${str(p.to) ?? '?'} (${str(p.cause) ?? 'cause unavailable'})`;
    case 'msg_sent': case 'msg_rejected':
      return clip(`${entry.kind === 'msg_rejected' ? 'Rejected message' : 'Message'} to ${str(p.to) ?? (list(p.to).join(', ') || 'recipient')}${str(p.subject) ? `: ${str(p.subject)}` : str(p.text) ? `: ${str(p.text)}` : ''}`);
    case 'gap_decision': case 'gap_decided':
      return `Gap ${str(p.gap_id) ?? ''} ${str(p.decision) ?? ''}`.trim();
    case 'kill_switch':
      return `Kill switch engaged${str(p.reason) ? `: ${str(p.reason)}` : ''}`;
    case 'kill_switch_released':
      return 'Kill switch released';
    default: {
      const first = Object.entries(p).find(([, value]) => typeof value === 'string' && value.length > 0);
      return first ? clip(`${first[0]}: ${String(first[1])}`) : 'No summary fields';
    }
  }
}

export type HashState = 'ok' | 'broken' | 'unknown';
/** Per-row status from the server's verification of the original chain (before control entries were withheld). */
export function hashState(entry: AuditEntry, chain: AuditChain | null | undefined): HashState {
  if (!chain || chain.ok === null || !entry.hash) return 'unknown';
  if (chain.ok) return 'ok';
  return typeof chain.bad_seq === 'number' && entry.seq < chain.bad_seq ? 'ok' : 'broken';
}

export const toJsonl = (entries: AuditEntry[]): string =>
  entries.map((entry) => JSON.stringify(entry.raw)).join('\n') + (entries.length ? '\n' : '');

/** Index (number of events applied) at which each lifecycle phase first appears in the replay. */
export function phaseCursor(events: LiveEvent[], phase: string): number | undefined {
  const index = events.findIndex((event) => event.kind === 'phase'
    && (event.latest === phase || (Array.isArray(event.active) && event.active.includes(phase))));
  return index < 0 ? undefined : index + 1;
}

/** Index (number of events applied) of the last replay event at or before an audit timestamp. */
export function cursorForTs(events: LiveEvent[], ts: string | undefined): number | undefined {
  const at = ts ? Date.parse(ts) : NaN;
  if (!Number.isFinite(at)) return undefined;
  let found = 0;
  events.forEach((event, index) => {
    const t = typeof event.ts === 'string' ? Date.parse(event.ts) : NaN;
    if (Number.isFinite(t) && t <= at) found = index + 1;
  });
  return found;
}
