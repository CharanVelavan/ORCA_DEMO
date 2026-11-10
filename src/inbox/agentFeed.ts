import { useLiveStore } from '../store';
import type { LiveEvent } from '../types';

/** agent_step and agent_final events of the current run, kept by the live store (control events never enter it). */
export function useAgentFeed(): LiveEvent[] {
  return useLiveStore((s) => s.agentSteps);
}
