import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { isReadOnlyNow } from '../sim/readOnly';
import { useLiveStore } from '../store';

type Llm = 'mock' | 'local' | '';
type Kb = 'india' | 'eu' | '';
type ClockAction = 'play' | 'pause' | 'step';

export function useDirectorControls(readOnly: boolean) {
  const session = useLiveStore((s) => s.session);
  const [running, setRunning] = useState<boolean | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [rules, setRules] = useState<boolean | null>(null);
  const [kb, setKb] = useState<Kb>('');
  const [llm, setLlm] = useState<Llm>('');
  const [sync, setSync] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const locked = useRef(false);
  const commandVersion = useRef(0);

  useEffect(() => {
    setRules(typeof session.rules === 'boolean' ? session.rules : null);
    setKb(session.kb === 'india' || session.kb === 'eu' ? session.kb : '');
  }, [session.scenario, session.rules, session.kb]);
  useEffect(() => {
    setLlm(session.llm === 'mock' || session.llm === 'local' ? session.llm : '');
    setSync(typeof session.sync === 'boolean' ? session.sync : null);
  }, [session.scenario, session.llm, session.sync]);
  useEffect(() => {
    if (typeof session.speed === 'number') setSpeed(session.speed);
  }, [session.scenario, session.speed]);

  useEffect(() => {
    if (readOnly) {
      setRunning(null);
      setConnected(false);
      setConnectionError(null);
      return;
    }
    let active = true;
    const refresh = async () => {
      const version = commandVersion.current;
      try {
        const state = await api.state();
        if (!active || isReadOnlyNow() || locked.current || version !== commandVersion.current) return;
        const meta = state.session && typeof state.session === 'object'
          ? state.session as Record<string, unknown> : {};
        setRunning(typeof state.running === 'boolean' ? state.running : null);
        if (typeof meta.speed === 'number') setSpeed(meta.speed);
        setConnected(true);
        setConnectionError(null);
      } catch (reason) {
        if (!active || isReadOnlyNow() || locked.current || version !== commandVersion.current) return;
        setRunning(null);
        setConnected(false);
        setConnectionError(reason instanceof Error ? reason.message : 'Engine state unavailable.');
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, [readOnly, session.scenario]);

  const perform = useCallback(async (name: string, action: () => Promise<string>) => {
    if (readOnly || isReadOnlyNow()) {
      setError('Playback is read-only. No engine command was sent.');
      return false;
    }
    if (locked.current) return false;
    locked.current = true;
    commandVersion.current += 1;
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `${name} failed.`);
      return false;
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }, [readOnly]);

  const updateClock = useCallback((action: ClockAction, nextSpeed?: number) => perform('Clock', async () => {
    if (isReadOnlyNow()) throw new Error('Playback is read-only. No engine command was sent.');
    const result = await api.clock({ action, ...(nextSpeed !== undefined ? { speed: nextSpeed } : {}) });
    if (typeof result.running === 'boolean') setRunning(result.running);
    if (typeof result.speed === 'number') setSpeed(result.speed);
    return action === 'step' ? 'Advanced one simulation minute.' : action === 'pause' ? 'Simulation paused.' : 'Simulation playing.';
  }), [perform]);

  const changeSpeed = useCallback((next: number) => {
    if (readOnly || isReadOnlyNow() || running === null) return;
    void updateClock(running ? 'play' : 'pause', next);
  }, [readOnly, running, updateClock]);

  const changeRules = useCallback((next: boolean) => perform('Rules', async () => {
    if (isReadOnlyNow()) throw new Error('Playback is read-only. No engine command was sent.');
    await api.rules(next);
    setRules(next);
    return `Rule engine ${next ? 'on' : 'off'}.`;
  }), [perform]);

  const changeKb = useCallback((next: 'india' | 'eu') => perform('Knowledge base', async () => {
    if (isReadOnlyNow()) throw new Error('Playback is read-only. No engine command was sent.');
    await api.kb(next);
    setKb(next);
    return `Knowledge base changed to ${next === 'india' ? 'India' : 'EU'}.`;
  }), [perform]);

  const start = useCallback((scenario: string) => perform('Start exercise', async () => {
    if (isReadOnlyNow()) throw new Error('Playback is read-only. No engine command was sent.');
    if (!scenario || !llm || rules === null || sync === null) throw new Error('Select a scenario and complete the session settings.');
    await api.session({ scenario, llm, rules, kb: 'india', autoplay: true, sync });
    if (isReadOnlyNow()) throw new Error('The session was created, but playback became read-only before its clock started.');
    let result: Record<string, unknown>;
    try {
      result = await api.clock({ action: 'play', ...(speed !== null ? { speed } : {}) });
    } catch (reason) {
      throw new Error(`The exercise was created, but its clock did not start: ${reason instanceof Error ? reason.message : 'clock request failed.'}`);
    }
    if (typeof result.running === 'boolean') setRunning(result.running);
    if (typeof result.speed === 'number') setSpeed(result.speed);
    if (result.running !== true) throw new Error('The exercise was created, but the backend did not confirm a running clock.');
    return 'Exercise started.';
  }), [perform, llm, rules, sync, speed]);

  const inject = useCallback((kind: string, target: string, durationMin: number) => perform('Injection', async () => {
    if (isReadOnlyNow()) throw new Error('Playback is read-only. No engine command was sent.');
    if (!kind || !target || !Number.isInteger(durationMin) || durationMin < 1) {
      throw new Error('Select an injector, target and positive whole-minute duration.');
    }
    await api.inject({ kind, target, duration_min: durationMin });
    return 'Injection requested. Check the director ground-truth lane for the recorded event.';
  }), [perform]);

  const chooseLlm = useCallback((next: Llm) => {
    if (readOnly || isReadOnlyNow()) return;
    setLlm(next);
  }, [readOnly]);
  const chooseSync = useCallback((next: boolean) => {
    if (readOnly || isReadOnlyNow()) return;
    setSync(next);
  }, [readOnly]);

  return {
    running, speed, rules, kb, llm, sync, connected, connectionError, busy, error, notice,
    canCommand: !readOnly && connected && busy === null,
    draftChanged: (llm !== '' && llm !== session.llm) || (sync !== null && sync !== session.sync),
    updateClock, changeSpeed, changeRules, changeKb, start, inject, chooseLlm, chooseSync,
  };
}

export type DirectorControls = ReturnType<typeof useDirectorControls>;
