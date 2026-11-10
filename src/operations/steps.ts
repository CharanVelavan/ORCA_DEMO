import type { LiveEvent } from '../types';
import { number, text } from './data';

export type StepState = 'done' | 'current' | 'failed' | 'pending';
export type RemediationStep = { id: string; label: string; state: StepState; detail?: string; at?: string };

/** Remediation steps from observed engine events only; a step without an event stays pending. */
export function remediationSteps(events: LiveEvent[]): RemediationStep[] {
  const seen = events.filter((event) => event.audience !== 'control');
  const lastOf = (kind: string, test: (event: LiveEvent) => boolean = () => true) => [...seen].reverse().find((event) => event.kind === kind && test(event));
  const approval = lastOf('approval', (event) => text(event.status) !== 'requested') ?? lastOf('approval');
  const execute = lastOf('execute');
  const stages = seen.filter((event) => event.kind === 'patch_stage');
  const stage = stages[stages.length - 1];
  const rollback = lastOf('rollback');
  const heal = lastOf('heal');
  const reattack = lastOf('reattack');
  const approvalStatus = text(approval?.status);
  const executeResult = text(execute?.result);
  const stageHealth = text(stage?.health);
  const stagePct = number(stage?.pct);
  const healCheck = heal?.check && typeof heal.check === 'object' ? heal.check as Record<string, unknown> : undefined;
  const steps: RemediationStep[] = [
    { id: 'approve', label: 'Commander approval', at: approval?.ts,
      state: !approval ? 'pending' : approvalStatus === 'approved' || approvalStatus === 'auto' ? 'done' : approvalStatus === 'rejected' || approvalStatus === 'expired' ? 'failed' : 'current',
      detail: approval ? `${text(approval.playbook) ?? ''} ${approvalStatus ?? ''}`.trim() : undefined },
    { id: 'execute', label: 'Owner executes playbook', at: execute?.ts,
      state: !execute ? 'pending' : executeResult === 'refused' || executeResult === 'rolled_back' ? 'failed' : 'done',
      detail: execute ? text(execute.playbook) ?? text(execute.detail) : undefined },
    { id: 'rollout', label: 'Staged rollout', at: stage?.ts ?? rollback?.ts,
      state: rollback ? 'failed' : !stage ? 'pending' : stageHealth === 'fail' ? 'failed' : stagePct !== undefined && stagePct >= 100 ? 'done' : 'current',
      detail: rollback ? 'Rolled back' : stages.length ? stages.map((event) => number(event.pct)).filter((pct) => pct !== undefined).map((pct) => `${pct}%`).join(' → ') : undefined },
    { id: 'heal', label: 'Failover on a clean path', at: heal?.ts,
      state: !heal ? 'pending' : healCheck?.clean === false ? 'failed' : 'done',
      detail: heal ? [text(heal.site), text(heal.from_path) && text(heal.to_path) ? `path ${heal.from_path} → ${heal.to_path}` : undefined].filter(Boolean).join(' ') : undefined },
    { id: 'reattack', label: 'Re-attack check', at: reattack?.ts,
      state: !reattack ? 'pending' : reattack.blocked === true ? 'done' : 'failed',
      detail: reattack ? reattack.blocked === true ? `Blocked${text(reattack.blocked_by) ? ` by ${reattack.blocked_by}` : ''}` : 'Not blocked' : undefined },
  ];
  const firstPending = steps.findIndex((step) => step.state === 'pending');
  const started = steps.some((step) => step.state !== 'pending');
  if (started && firstPending >= 0 && !steps.some((step) => step.state === 'current' || step.state === 'failed')) steps[firstPending] = { ...steps[firstPending], state: 'current', detail: steps[firstPending].detail ?? 'Waiting for the next event' };
  return steps;
}
