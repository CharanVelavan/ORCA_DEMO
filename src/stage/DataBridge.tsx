import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { playFake } from '../fake/play';
import { connectStream } from '../stream';
import { useLiveStore } from '../store';
import { usePipeline } from '../pipeline/pipelineStore';
import type { LiveEvent } from '../types';
import { useUi } from './uiStore';
import { present } from './presenter';

/** Smooth over engine shape differences once, before any store sees the event. */
export function normalize(e: LiveEvent): LiveEvent {
  const out: LiveEvent = { ...e };
  if (typeof out.scenario === 'string') out.scenario = out.scenario.toUpperCase();
  if (String(out.kind).startsWith('agent_') && out.role == null && typeof out.actor === 'string') out.role = out.actor;
  if (out.kind === 'approval' && out.hash == null && out.plan_hash) out.hash = out.plan_hash;
  return out;
}

/** Which routes may see ground truth (audience 'control'). The Console never does. */
export const truthRoute = (path: string) => path === '/simulator' || path === '/control';

export function createStreamGate(isReplay: () => boolean) {
  let active = true;
  return {
    accepting: () => active && !isReplay(),
    close: () => { active = false; },
  };
}

const PACE: Record<number, number> = { 0.5: 2600, 1: 1600, 2: 800 }; // ms per recorded sim minute (Demo)

/**
 * Feeds the live store and the Pipeline. Stage: Demo replays a recorded run (public/fixtures), Live follows the
 * engine stream; both go through the presenter so the run is shown step by step. Review drives its own replay.
 */
export function DataBridge() {
  const location = useLocation();
  const uiMode = useUi((s) => s.mode);
  const run = useUi((s) => s.config.run);
  const scenario = useUi((s) => s.config.scenario);
  const source = useLiveStore((s) => s.source);
  const stage = location.pathname === '/stage';
  const q = new URLSearchParams(location.search);
  const urlFake = q.get('fake') === '1';
  const demo = stage && (urlFake || run === 'demo');
  const demoKey = demo ? `${uiMode}|${urlFake ? q.get('scn') ?? 'S1' : scenario}` : 'live';
  const truth = truthRoute(location.pathname);
  const review = location.pathname === '/review';
  useEffect(() => {
    const state = useLiveStore.getState();
    const events = truth ? [...state.events, ...state.truth, ...state.schedules] : state.events;
    usePipeline.getState().reset();
    usePipeline.setState({ truth });
    for (const event of [...events].sort((a, b) => a.seq - b.seq)) usePipeline.getState().ingest(event, truth);
  }, [truth]);
  useEffect(() => {
    if (review || source === 'replay') return;
    useLiveStore.getState().reset();
    usePipeline.getState().reset();
    usePipeline.setState({ truth });
    if (urlFake && stage && useUi.getState().mode !== 'running') {
      const scn = (q.get('scn') ?? 'S1').toUpperCase();
      useUi.getState().setConfig({ scenario: scn, run: 'demo' });
      useUi.getState().start();
      return;
    }
    const gate = createStreamGate(() => useLiveStore.getState().source === 'replay');
    const accepting = gate.accepting;
    const apply = (event: LiveEvent) => {
      if (!accepting()) return;
      if (event.kind === 'session') useLiveStore.getState().reset(); // a new run starts: drop the old one
      const s = useLiveStore.getState();
      s.addControl(event);
      usePipeline.getState().ingest(event, usePipeline.getState().truth);
    };
    // The Stage is presented step by step (presenter.ts); other routes get events as they come.
    const guided = stage ? present(apply, { live: !demo }) : null;
    const receive = (raw: LiveEvent) => {
      if (!accepting()) return;
      useLiveStore.setState((state) => state.errors.some((event) => event.where === 'stream')
        ? { errors:state.errors.filter((event) => event.where !== 'stream') } : {});
      const e = normalize(raw);
      // On the Stage, a finished run's history must not paint the setup screen; Start sends a fresh session.
      if (guided && useUi.getState().mode !== 'running' && e.kind !== 'tick' && e.kind !== 'session') return;
      if (guided) guided.push(e, truth); else apply(e);
    };
    // Back to setup: clear the last run so the scene and flowchart start clean.
    const offUi = useUi.subscribe((u, prev) => { if (accepting() && u.mode === 'setup' && prev.mode === 'running') { useLiveStore.getState().reset(); usePipeline.getState().reset(); } });
    let stop: () => void = () => undefined;
    if (demo || urlFake) {
      if (!stage || useUi.getState().mode === 'running') {
        const scn = urlFake ? (q.get('scn') ?? 'S1').toUpperCase() : useUi.getState().config.scenario;
        const pace = urlFake && q.get('pace') ? Number(q.get('pace')) : PACE[useUi.getState().config.speed] ?? 1600;
        stop = playFake(receive, scn, pace);
      }
    } else {
      stop = connectStream(0, receive, (error) => {
        if (!accepting()) return;
        useLiveStore.setState((state) => ({
          errors:[...state.errors.filter((event) => event.where !== 'stream'), {
            kind:'error',seq:state.seq,t:state.t,ts:state.ts,where:'stream',message:error.message,
          }],
        }));
      });
    }
    return () => { gate.close(); stop(); guided?.stop(); offUi(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review, source, location.search, demo, demoKey]);
  return null;
}
