import type { Approval, LiveEvent } from '../types';

const istFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

/** Sim timestamp (ISO string or epoch ms) as IST HH:MM:SS. */
export function istTime(value: unknown): string {
  const ms = toMs(value);
  return Number.isFinite(ms) ? istFmt.format(new Date(ms)) : '--:--:--';
}

export function toMs(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value);
  return NaN;
}

/** m:ss under an hour, h:mm:ss above. Input in ms, must be >= 0. */
export function clockText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function roleName(role: unknown): string {
  const text = String(role ?? '').replace(/^human:/, '').replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown';
}

/** Plain error text for a failed command. api.ts drops the server text, so keep this generic. */
export function plainError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? '');
  if (/^API 4\d\d/.test(message)) return 'The console did not accept that. Try again.';
  if (/^API 5\d\d/.test(message)) return 'The console reported a fault. Try again.';
  if (/failed to fetch|networkerror|load failed/i.test(message)) return 'Cannot reach the console server.';
  return message || 'Something went wrong. Try again.';
}

export type ApprovalView = Approval & { actor?: string; resolved_at?: string };

/**
 * The stream sends one `approval` event per audit entry. The request carries `hash`; the later
 * `approved` and `rejected` entries carry `plan_hash` and a status. Fold them into one row per plan.
 */
export function mergeApprovals(list: Approval[]): ApprovalView[] {
  const byHash = new Map<string, ApprovalView>();
  for (const raw of list) {
    const e = raw as unknown as Record<string, unknown>;
    const key = String(e.hash ?? e.plan_hash ?? '');
    if (!key) continue;
    const prev = byHash.get(key);
    const status = String(e.status ?? 'requested');
    if (!prev) {
      const base = { ...(raw as ApprovalView), hash: key, status } as ApprovalView;
      if (status === 'approved') { const actor = String(e.actor ?? ''); base.status = actor && !actor.startsWith('human:') ? 'auto' : 'approved'; }
      if (status !== 'requested') { base.actor = String(e.actor ?? ''); base.resolved_at = String(e.ts ?? e.requested_at ?? ''); }
      byHash.set(key, base); continue;
    }
    const next: ApprovalView = { ...prev };
    if (status === 'approved') {
      const actor = String(e.actor ?? '');
      next.status = actor && !actor.startsWith('human:') ? 'auto' : 'approved';
      next.actor = actor; next.resolved_at = String(e.ts ?? prev.requested_at ?? '');
    } else if (status === 'rejected') {
      next.status = 'rejected'; next.actor = String(e.actor ?? ''); next.resolved_at = String(e.ts ?? prev.requested_at ?? '');
      if (e.reason) next.reject_reason = e.reason;
    } else if (status === 'expired') next.status = 'expired';
    if (e.mode && !next.mode) next.mode = String(e.mode);
    byHash.set(key, next);
  }
  return [...byHash.values()];
}

export function latestTs(events: LiveEvent[]): number {
  let best = NaN;
  for (const e of events) { const v = toMs(e?.ts); if (Number.isFinite(v) && !(v <= best)) best = v; }
  return best;
}
