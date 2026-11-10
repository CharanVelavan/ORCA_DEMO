import { useEffect, useState } from 'react';
import { useLiveStore } from '../store';
import { latestTs, toMs } from './format';

/*
 * Sim time estimate. The store keeps no tick events, so the newest sim timestamp it holds can lag.
 * We take that anchor, then advance it by wall time at the session speed (1 sim minute per
 * 2 s / speed, as in orca/live/session.py) while store events keep arriving. When events stop
 * (paused clock), the estimate stops after 1.5 tick periods. It never moves backwards unless the
 * session restarts.
 */
let est = NaN, lastCall = 0, lastSeq = -1, lastSeqWall = 0;

function anchor(): number {
  const s = useLiveStore.getState();
  const own = [...s.alerts.slice(-3), ...s.messages.slice(-3), ...s.verdicts.slice(-3), ...s.obligations.slice(-3),
    ...s.approvals.slice(-3) as unknown as typeof s.alerts, ...s.raw.slice(-5), ...s.models.slice(-3), ...s.errors.slice(-2)];
  if (s.autonomy) own.push(s.autonomy);
  if (s.kill) own.push(s.kill);
  let a = latestTs(own);
  const start = toMs(s.session?.start);
  if (Number.isFinite(start) && !(a >= start)) a = start;
  return a;
}

export function getSimNowMs(): number {
  const s = useLiveStore.getState();
  const wall = performance.now();
  const a = anchor();
  if (s.seq < lastSeq || !Number.isFinite(est)) est = a;
  if (s.seq !== lastSeq) { lastSeq = s.seq; lastSeqWall = wall; }
  const speed = Number((s.session as Record<string, unknown>)?.speed) || 1;
  const tickMs = 2000 / speed;
  if (lastCall && wall - lastSeqWall < tickMs * 1.5) est += (wall - lastCall) * (60000 / tickMs);
  lastCall = wall;
  if (Number.isFinite(a) && a > est) est = a;
  return Number.isFinite(est) ? est : Date.now();
}

/** Re-renders every second with the sim-time estimate (ms since epoch). */
export function useSimNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => getSimNowMs());
  useEffect(() => {
    setNow(getSimNowMs());
    const id = window.setInterval(() => setNow(getSimNowMs()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
