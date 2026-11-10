import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { usePipeline } from '../pipeline/pipelineStore';
import { useLiveStore } from '../store';
import type { LiveEvent, ReplayAudit } from '../types';
import { isControlEntry } from './audit';
import { normalizeEvents, scenarioFromFile } from './normalize';

export type Speed = 1 | 4 | 10;

/** Real-time gap before event i+1 plays: 1.2 s per sim minute at x1, 250 ms inside a minute, scaled by speed. */
export const gapMs = (a: LiveEvent, b: LiveEvent, speed: Speed): number => {
  const dm = Math.max(0, Number(b.t) - Number(a.t));
  const base = dm > 0 ? Math.min(3000, dm * 1200) : 250;
  return Math.max(30, base / speed);
};

/** Exercise-control (ground-truth) events belong to the Simulator only; a replay never feeds them to any page. */
export const isControlEvent = (event: LiveEvent): boolean => isControlEntry(event);

/** The last opened recording and cursor survive navigation, so the replayed state can be inspected on every page. */
const memory: { file: string | null; cursor: number } = { file: null, cursor: -1 };

const applyEvent = (event: LiveEvent) => {
  useLiveStore.getState().add(event);
  usePipeline.setState({ truth: false });
  usePipeline.getState().ingest(event, false);
};

/** Leave replay: clear the replayed state and let the live stream reconnect. */
export function exitReplay() {
  memory.file = null;
  memory.cursor = -1;
  useLiveStore.getState().reset();
  usePipeline.getState().reset();
  usePipeline.getState().setMode('live');
  useLiveStore.getState().setSource('live');
}

export function useReplay(file: string | null) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [audit, setAudit] = useState<ReplayAudit | null>(null);
  const [replaySource, setReplaySource] = useState<'stream' | 'audit' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0); // number of events applied
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const applied = useRef(0);
  const eventsRef = useRef<LiveEvent[]>([]);

  const scenario = useMemo(() => {
    const s = events.find((e) => e.kind === 'session');
    return s ? String(s.scenario) : scenarioFromFile(file ?? '');
  }, [events, file]);
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;

  const rebuild = useCallback((target: number, sc: string) => {
    const list = eventsRef.current;
    usePipeline.getState().reset(sc);
    // Pipeline state defaults to truth-enabled for Simulator; audit replay is always observational.
    usePipeline.setState({ truth: false, mode: 'replay' });
    useLiveStore.getState().reset();
    for (let i = 0; i < target; i++) applyEvent(list[i]);
    usePipeline.setState({ queue: [], current: null }); // silent: no packets for a seek
    applied.current = target;
  }, []);

  const seek = useCallback((raw: number) => {
    const list = eventsRef.current;
    const target = Math.max(0, Math.min(list.length, Math.round(raw)));
    if (target !== applied.current) {
      if (target < applied.current || target - applied.current > 1) rebuild(target, scenarioRef.current);
      else { applyEvent(list[applied.current]); applied.current = target; }
    }
    memory.cursor = target;
    setCursor(target);
  }, [rebuild]);

  useEffect(() => {
    if (!file) { eventsRef.current = []; setEvents([]); setAudit(null); setPlaying(false); return; }
    let live = true;
    setLoading(true); setError(null); setPlaying(false);
    api.replay(file).then((res) => {
      if (!live) return;
      const raw = (Array.isArray(res.events) ? res.events : []) as LiveEvent[];
      const publicRaw = raw.filter((event) => !isControlEvent(event));
      const list = normalizeEvents(publicRaw, file).filter((event) => !isControlEvent(event));
      useLiveStore.getState().setSource('replay');
      usePipeline.getState().setMode('replay');
      eventsRef.current = list; setEvents(list);
      setAudit(res.audit ?? null);
      setReplaySource(res.source ?? null);
      const sc = (list.find((e) => e.kind === 'session')?.scenario as string | undefined) ?? scenarioFromFile(file);
      scenarioRef.current = sc;
      const start = memory.file === file && memory.cursor >= 0 ? Math.min(memory.cursor, list.length) : Math.min(1, list.length);
      memory.file = file;
      applied.current = -1;
      rebuild(start, sc);
      memory.cursor = start;
      setCursor(start);
    }).catch((err: unknown) => { if (live) { eventsRef.current = []; setEvents([]); setAudit(null); setError(err instanceof Error ? err.message : 'Cannot load recording'); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [file, rebuild]);

  useEffect(() => {
    if (!playing) return;
    const list = eventsRef.current;
    if (cursor >= list.length) { setPlaying(false); return; }
    const delay = cursor === 0 ? 200 : gapMs(list[cursor - 1], list[cursor], speed);
    const id = window.setTimeout(() => seek(cursor + 1), delay);
    return () => window.clearTimeout(id);
  }, [playing, cursor, speed, seek]);

  const play = useCallback(() => {
    if (!eventsRef.current.length) return;
    if (applied.current >= eventsRef.current.length) seek(0);
    setPlaying(true);
  }, [seek]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, play, pause]);
  const step = useCallback((delta: number) => { setPlaying(false); seek(applied.current + delta); }, [seek]);
  const jump = useCallback((i: number) => { setPlaying(false); seek(i); }, [seek]);

  return { events, audit, replaySource, loading, error, cursor, playing, speed, scenario, setSpeed, play, pause, toggle, step, seek: jump };
}

export const rememberedReplayFile = () => memory.file;
