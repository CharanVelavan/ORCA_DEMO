import type { LiveEvent } from '../types';

/**
 * ?fake=1[&scn=S1] plays a stream captured from the real engine (public/fixtures/<scn>.json),
 * paced by sim minute so the Pipeline can be checked without a running engine.
 * A fixture that cannot be loaded is reported as an error event (and onError), never as a success.
 */
export function playFake(onEvent: (event: LiveEvent) => void, scenario = 'S1', msPerMinute = 1200, onError?: (message: string) => void) {
  let stopped = false;
  const timers: number[] = [];
  const url = `/fixtures/${encodeURIComponent(scenario)}.json`;
  const fail = (message: string) => {
    if (stopped) return;
    onError?.(message);
    onEvent({ seq: -1, t: 0, ts: '', kind: 'error', where: 'fake', message, emulated: true });
  };
  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<LiveEvent[]>;
    })
    .then((events) => {
      let lastT = 0, at = 0;
      events.forEach((e, i) => {
        const t = Number(e.t ?? 0);
        at += t > lastT ? (t - lastT) * msPerMinute : i ? 40 : 0;
        lastT = Math.max(lastT, t);
        timers.push(window.setTimeout(() => { if (!stopped) onEvent(e); }, at));
      });
    })
    .catch((err: unknown) => fail(`Fixture ${url} could not be loaded: ${err instanceof Error ? err.message : String(err)}`));
  return () => { stopped = true; timers.forEach((t) => window.clearTimeout(t)); };
}
