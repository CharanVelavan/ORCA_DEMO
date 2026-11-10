import type { DeriveInput } from '../derive';
import type { LiveEvent } from '../types';
import { isControlEntry } from '../review/audit';

export type JudgeId = 'network' | 'models' | 'policy' | 'decision' | 'recovery' | 'gap';
export type JudgeCheckpoint = { id: JudgeId; title: string; route: string; tab?: string; instruction: string; evidence?: LiveEvent; detail: string };
const refs = (event: LiveEvent) => [event.record_ids, event.records, event.citations].some(value => Array.isArray(value) && value.some(id => typeof id === 'string' && id.trim()));
/** Review availability comes only from public events in the current live-store projection. */
export function judgeCheckpoints(d: DeriveInput): JudgeCheckpoint[] {
  const events = typeof d.session?.scenario === 'string' ? (d.events ?? []).filter(event => !isControlEntry(event)) : [];
  const last = (test: (event: LiveEvent) => boolean) => [...events].reverse().find(test);
  const network = last(event => event.kind === 'tick' && event.sites !== null && typeof event.sites === 'object' && Object.keys(event.sites as object).length > 0);
  const models = last(event => event.kind === 'model' && /^M[1-4]$/.test(String(event.model)));
  const policy = last(event => event.kind === 'verdict' && typeof event.verdict === 'string' && refs(event));
  const decision = last(event => event.kind === 'approval' && ['requested', 'pending', 'approved', 'rejected', 'auto', 'expired'].includes(String(event.status)) && Boolean(event.hash || event.plan_hash));
  const recovery = last(event => event.kind === 'execute' && (['ok','refused','failed','rolled_back'].includes(String(event.result)) || typeof event.ok === 'boolean' || event.result !== null && typeof event.result === 'object' && typeof (event.result as Record<string,unknown>).ok === 'boolean') || event.kind === 'heal' && event.check !== null && typeof event.check === 'object' && typeof (event.check as Record<string,unknown>).clean === 'boolean' || event.kind === 'reattack' && typeof event.blocked === 'boolean' || event.kind === 'rollback');
  const gap = last(event => event.kind === 'verdict' && ['POTENTIAL_GAP', 'AMBIGUITY', 'CONFLICT'].includes(String(event.verdict)) && Boolean(event.gap_id) && refs(event) || event.kind === 'gap' && event.source === 'candidate' && Array.isArray(event.evidence) && event.evidence.length > 0);
  return [
    { id:'network', title:'Read the observed network', route:'/workspace', instruction:'Inspect site and service telemetry. Separate observations from director truth.', evidence:network, detail:network ? `${Object.keys(network.sites as object).length} site observations recorded.` : 'Waiting for a public telemetry tick.' },
    { id:'models', title:'Inspect a model result', route:'/workspace', tab:'models', instruction:'Read an actual model output and its uncertainty. Available output does not imply every model ran.', evidence:models, detail:models ? `${String(models.model)} output recorded${typeof models.class === 'string' ? ` · ${models.class}` : ''}.` : 'Waiting for a public M1–M4 result.' },
    { id:'policy', title:'Check a cited policy finding', route:'/policy', instruction:'Follow the engine verdict to its recorded KB references and reporting trigger.', evidence:policy, detail:policy ? `${String(policy.verdict)} with recorded source references.` : 'Waiting for a cited rule-engine verdict.' },
    { id:'decision', title:'Inspect the human boundary', route:'/workspace', tab:'approvals', instruction:'Inspect the exact plan and its recorded decision state. A pending request remains pending.', evidence:decision, detail:decision ? `Approval state: ${String(decision.status)}. Review does not approve the plan.` : 'Waiting for a hashed approval request or decision.' },
    { id:'recovery', title:'Check the recorded outcome', route:'/recovery', instruction:'Inspect execution, clean-path, re-attack or rollback evidence. Keep each outcome as recorded.', evidence:recovery, detail:recovery ? `${recovery.kind} evidence recorded; inspect its outcome.` : 'Waiting for an execution or verification record.' },
    { id:'gap', title:'Review the policy gap evidence', route:'/policy', instruction:'Inspect the candidate finding and its bounded search evidence. Human confirmation is separate.', evidence:gap, detail:gap ? 'A cited candidate policy finding is available.' : 'Waiting for an evidence-backed candidate gap finding.' },
  ];
}
export const checkpointKey = (checkpoint: JudgeCheckpoint) => checkpoint.evidence ? `${checkpoint.evidence.kind}:${checkpoint.evidence.seq}:${checkpoint.evidence.ts}` : '';

export function reviewProofPresent(key: string | undefined, d: DeriveInput, id?: JudgeId): boolean {
  if (!key || typeof d.session?.scenario !== 'string') return false;
  const event = (d.events ?? []).find(event => !isControlEntry(event) && `${event.kind}:${event.seq}:${event.ts}` === key);
  return Boolean(event && (!id || judgeCheckpoints({ ...d, events: [event] }).some(checkpoint => checkpoint.id === id && checkpoint.evidence)));
}
