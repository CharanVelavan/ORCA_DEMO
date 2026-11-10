/** Shared evidence projection. A flagged condition is not an unfinished task. */
import type { DeriveInput } from './derive';
import type { LiveEvent } from './types';
export type TaskStatus = 'done' | 'current' | 'pending' | 'failed';
export type TaskEvidence = { status: TaskStatus; event?: LiveEvent };
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' ? v as Record<string, unknown> : {};
export function currentApproval(d: DeriveInput) {
  const request = (d.events ?? []).filter(e => e.audience !== 'control' && e.kind === 'approval' && ['requested','pending'].includes(String(e.status))).at(-1);
  const hash = request?.hash ?? request?.plan_hash;
  return (hash ? (d.approvals ?? []).find(a => a.hash === hash) : undefined) ?? (d.approvals ?? []).at(-1);
}
export function taskEvidence(id: string, d: DeriveInput): TaskEvidence {
  const events = (d.events ?? []).filter((e) => e.audience !== 'control');
  const last = (...kinds: string[]) => events.filter((e) => kinds.includes(e.kind)).at(-1);
  const finish = (event?: LiveEvent): TaskEvidence => ({ status:event ? 'done' : 'pending', event });
  const approval = currentApproval(d);
  const request = approval?.hash ? events.filter(e => e.kind === 'approval' && (e.hash ?? e.plan_hash) === approval.hash && ['requested','pending'].includes(String(e.status ?? 'requested'))).at(-1) : undefined;
  const work = events.filter(e => (!request || e.seq >= request.seq) && (!approval?.playbook || !e.playbook || e.playbook === approval.playbook) && (!approval?.hash || !e.plan_hash || e.plan_hash === approval.hash));
  const op = (...kinds: string[]) => work.filter((e) => kinds.includes(e.kind)).at(-1);
  const model = (name: string) => (d.models ?? []).filter((e) => e.audience !== 'control' && e.model === name).at(-1) ?? events.filter((e) => e.kind === 'model' && e.model === name).at(-1);
  if (id === 'detect' || id === 'collect') return finish(model('M1') ?? model('M2') ?? last('alert'));
  if (id === 'forecast') return finish(model('M2'));
  if (id === 'allocate') return finish(model('M4'));
  if (id === 'classify' || id === 'rootcause' || id === 'fault-validation') return finish(model('M3'));
  if (id === 'more-evidence') { const m = model('M3'); return {status:m && (m.class === 'abstain' || m.abstain === true) ? 'current' : 'pending',event:m}; }
  if (id === 'coordinate' || id === 'retrieve') return {status:Object.values(d.agents ?? {}).some((a) => a.busy || (a.queue ?? 0) > 0) ? 'current' : last('agent_final') ? 'done' : 'pending',event:last('agent_busy','agent_final','agent_step','agent_task')};
  if (id === 'clocks') return finish((d.obligations ?? []).at(-1));
  if (/^rollout(5|25|100)$/.test(id)) { const event = work.filter(e => e.kind === 'patch_stage' && e.pct === Number(id.slice(7))).at(-1); return {status:!event ? 'pending' : event.health === 'ok' ? 'done' : 'failed',event}; }
  if (id === 'rules' || id === 'adequate') return finish((d.verdicts ?? []).at(-1));
  if (id === 'impact') return finish(d.impact ?? last('impact'));
  if (id === 'recommend') return finish(last('agent_final','approval'));
  if (id === 'decision') return {status:!approval ? 'pending' : ['requested','pending'].includes(approval.status) ? 'current' : ['approved','auto','rejected'].includes(approval.status) ? 'done' : approval.status === 'expired' ? 'failed' : 'pending',event:last('approval')};
  if (id === 'approval') return finish([...(d.gaps ?? [])].reverse().find((e) => obj(e.decision).decision || obj(e.human_review).decision || e.status === 'confirmed' || e.status === 'rejected'));
  if (id === 'revise') return {status:approval?.status === 'rejected' ? 'current' : 'pending',event:last('approval')};
  if (id === 'clone') { const event = last('approval'); const result = obj(approval?.clone_test); return {status:result.passed === true ? 'done' : result.passed === false ? 'failed' : 'pending',event:result.passed !== undefined ? event : undefined}; }
  if (id === 'contain' || id === 'execute-recovery') {
    const event = op('execute'); if (!event) return {status:'pending'};
    const result = obj(event.result);
    return {status:event.ok === false || result.ok === false || event.result === 'refused' || event.result === 'failed' || event.result === 'rolled_back' ? 'failed' : event.ok === true || result.ok === true || event.result === 'ok' ? 'done' : 'pending',event};
  }
  if (id === 'clean' || id === 'heal' || id === 'fault-restore') {
    const event = op('heal'); const check = obj(event?.check);
    return {status:check.clean === false ? 'failed' : check.clean === true && (id === 'clean' || event?.to_path) ? 'done' : 'pending',event};
  }
  if (id === 'rollout') { const event = op('patch_stage','rollback'); return {status:!event ? 'pending' : event.kind === 'rollback' || event.health === 'fail' ? 'failed' : event.health === 'ok' ? event.pct === 100 ? 'done' : 'current' : 'pending',event}; }
  if (id === 'reattack' || id === 'validate') { const event = op('reattack','rollback'); if (id === 'validate' && typeof obj(d.summary?.timings).time_to_restore_min !== 'number' && event?.blocked === true) return {status:'pending',event}; return {status:!event ? 'pending' : event.kind === 'rollback' || event.blocked === false ? 'failed' : event.blocked === true ? 'done' : 'pending',event}; }
  if (id === 'rollback-step') return finish(op('rollback'));
  if (id === 'gap' || id === 'policy') return finish((d.gaps ?? []).at(-1));
  if (id === 'start') return finish((d.alerts ?? []).at(-1));
  if (id === 'complete' || id === 'done') return finish(d.summary?.final === true ? d.summary : undefined);
  return {status:'pending'};
}
