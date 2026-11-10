import { api } from '../api';
import { useUi } from '../stage/uiStore';
import type { ExerciseConfig } from '../stage/uiStore';

const plain = (error: unknown, fallback: string): Error => {
  const text = error instanceof Error ? error.message : '';
  return new Error(text ? `${fallback} (${text})` : fallback);
};

/** IST wall-clock time, HH:MM:SS. */
export function istNow(): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
}

export async function startExercise(config: ExerciseConfig): Promise<void> {
  // Demo: the stage replays a recorded run (stage/DataBridge.tsx); the engine is not touched.
  if (config.run === 'demo') { useUi.getState().start(); return; }
  // Switch the stage to running first so the new session's first events are not dropped as "setup" noise.
  useUi.getState().start();
  try {
    // Live uses the real LLM. '?llm=mock' (rehearsal without the GPU tunnel) swaps in the scripted agents.
    const llm = new URLSearchParams(window.location.search).get('llm') === 'mock' ? 'mock' : 'local';
    await api.session({ scenario: config.scenario, llm, rules: true, kb: 'india', autoplay: true, sync: true });
    await api.clock({ action: 'play', speed: config.speed });
  } catch (error) {
    useUi.getState().end();
    throw plain(error, 'Could not start the live run. Is the engine running with the LLM?');
  }
}

export async function stopInject(injector: string): Promise<void> {
  try {
    await api.stopInject({ kind: injector });
  } catch (error) {
    throw plain(error, 'Could not stop that event.');
  }
}

export async function fireInject(injector: string, target: string, durationMin = 15): Promise<void> {
  try {
    await api.inject({ kind: injector, target, duration_min: durationMin });
  } catch (error) {
    throw plain(error, 'Could not fire that event.');
  }
  useUi.getState().markFired({ injector, target, at: istNow() });
}

export async function endExercise(): Promise<void> {
  try {
    if (useUi.getState().config.run === 'live') await api.clock({ action: 'pause' });
  } catch (error) {
    throw plain(error, 'Could not pause the clock.');
  } finally {
    useUi.getState().end();
  }
}
