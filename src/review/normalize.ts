import type { LiveEvent } from '../types';

// A replay is derived from the audit chain (orca/live/server.py _replay_events). It differs from the live stream:
//  - `run_meta` instead of `session`, `net_state` instead of `tick`
//  - `t` is mostly 0, so the real sim clock is `ts`; we rewrite `t` to whole minutes since the first event
//  - approval requests carry `hash`, the human decision carries `plan_hash` and no `status`
//  - agent events carry `actor`, the Pipeline reads `role`
// This file maps one shape to the other so the Pipeline can be driven unchanged.

export const scenarioFromFile = (file: string): string => {
  const m = /-(s\d+|n\d+|cap)-/i.exec(file);
  return m ? m[1].toUpperCase() : 'S1';
};

const minutesBetween = (ts: unknown, t0: number): number => {
  const ms = new Date(String(ts)).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.round((ms - t0) / 60000)) : 0;
};

export function normalizeEvents(raw: LiveEvent[], file: string): LiveEvent[] {
  const first = raw.find((e) => typeof e.ts === 'string');
  const t0 = first ? new Date(String(first.ts)).getTime() : 0;
  const owners = new Map<string, Record<string, unknown>>();
  const out: LiveEvent[] = [];
  raw.forEach((e, i) => {
    const t = minutesBetween(e.ts, t0);
    const base: LiveEvent = { ...e, seq: typeof e.seq === 'number' ? e.seq : i + 1, t };
    const actor = String(e.actor ?? '');
    switch (e.kind) {
      case 'run_meta':
        out.push({ ...base, kind: 'session', scenario: String(e.scenario ?? scenarioFromFile(file)).toUpperCase() });
        return;
      case 'net_state':
        out.push({ ...base, kind: 'tick' });
        return;
      case 'agent_task': case 'agent_step': case 'agent_final': case 'agent_busy':
        out.push({ ...base, role: e.role ?? actor });
        return;
      case 'approval': {
        if (typeof e.status === 'string') { out.push(base); return; }
        if (typeof e.hash === 'string') {
          owners.set(e.hash, e);
          out.push({ ...base, status: 'requested', owner: e.owner ?? actor });
          return;
        }
        const hash = String(e.plan_hash ?? '');
        const req = owners.get(hash);
        const human = actor.startsWith('human');
        const status = actor.startsWith('auto') || e.mode === 'auto' ? 'auto' : human ? 'approved' : 'rejected';
        out.push({ ...base, status, hash, owner: req?.owner ?? e.owner, playbook: e.playbook ?? req?.playbook, targets: e.targets ?? req?.targets });
        return;
      }
      case 'execute':
        out.push({ ...base, result: e.ok === false ? 'refused' : 'ok' });
        return;
      default:
        out.push(base);
    }
  });
  return out;
}
