import { models as derivedModels, type DeriveInput } from '../derive';
import { taskEvidence } from '../workflow';
import type { NodeInfo } from './pipelineStore';
import { NODES } from './pipelineNodes';
export function graphEvidence(data: DeriveInput): Record<string, NodeInfo> {
  const output: Record<string, NodeInfo> = {};
  const taskIds: Record<string,string> = { rules:'rules', clocks:'clocks', 'threat:anomaly':'start', human:'decision', 'exec:clone':'clone', 'exec:r5':'rollout', 'exec:r25':'rollout', 'exec:r100':'rollout', 'exec:cleanpath':'clean', 'exec:failover':'heal', 'exec:reattack':'reattack', 'exec:rollback':'rollback-step', 'exec:return':'validate' };
  for (const node of NODES) {
    let value: NodeInfo = {phase:'idle',tone:'unknown',word:'Not observed'};
    if (node.band === 'network') {
      const site = node.id.startsWith('site:') ? data.sites?.[node.id.slice(5)] : undefined;
      const gateway = node.id.startsWith('gw:') ? data.gateways?.[node.id.slice(3)] : undefined;
      const state = site?.state ?? gateway;
      value = {phase:state ? 'done' : 'idle',word:state ?? (node.id === 'sat' ? 'Emulated' : 'Not observed'),tone:state === 'ok' || state === 'up' ? 'ok' : state === 'down' ? 'critical' : 'unknown',at:data.ts};
    } else if (node.id.startsWith('model:')) {
      const event = derivedModels(data).find(m => m.id === node.id.slice(6))?.event;
      value = {phase:event ? 'done' : 'idle',tone:event?.state === 'flagged' ? 'warn' : 'unknown',word:event ? `${String(event.class ?? event.state ?? 'Output received')}` : 'Not observed',at:event?.ts};
    } else if (node.id.startsWith('agent:')) {
      const role = node.id.slice(6); const state = data.agents?.[role];
      const event = (data.events ?? []).filter((e) => e.role === role && e.kind === 'agent_final').at(-1);
      value = {phase:state?.busy ? 'active' : event ? 'done' : 'idle',word:state?.busy ? 'Active' : event ? 'Response received' : 'Not observed',tone:state?.busy ? 'accent' : 'unknown',at:event?.ts};
    } else if (node.id.startsWith('gap:')) {
      const event = (data.gaps ?? []).find((e) => typeof e.gap_id === 'string' && e.gap_id.startsWith(node.id.slice(4)));
      value = {phase:event ? 'done' : 'idle',word:event ? 'Candidate recorded' : 'Not observed',tone:event ? 'warn' : 'unknown',at:event?.ts};
    } else {
      const evidence = taskEvidence(taskIds[node.id] ?? node.id,data);
      value = {phase:evidence.status === 'done' || evidence.status === 'failed' ? 'done' : evidence.status === 'current' ? 'active' : 'idle',tone:evidence.status === 'failed' ? 'critical' : evidence.status === 'current' ? 'accent' : 'unknown',word:evidence.status === 'done' ? 'Observed' : evidence.status === 'current' ? 'Active' : evidence.status === 'failed' ? 'Failed / blocked' : 'Not observed',at:evidence.event?.ts};
      if (node.id.startsWith('exec:r') && /^exec:r\d/.test(node.id)) {
        const pct = Number(node.id.slice(6));
        const evidence = taskEvidence(`rollout${pct}`,data);
        value = {phase:evidence.status === 'pending' ? 'idle' : 'done',word:evidence.status === 'done' ? 'Passed' : evidence.status === 'failed' ? 'Failed' : 'Not observed',tone:evidence.status === 'failed' ? 'critical' : 'unknown',at:evidence.event?.ts};
      }
    }
    output[node.id] = value;
  }
  return output;
}
