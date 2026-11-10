/**
 * Page-specific flow configurations for the right-hand flow panel.
 * Nodes map to lifecycle phases (derive.PhaseId) so the panel can light the live
 * node from the engine's real phase history. Decision diamonds use `branches`.
 * Pages may import these or pass their own FlowConfig to <PageFrame flow=…>.
 */
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle, Database, GitBranch, Scale, ShieldCheck, Stethoscope, UserCheck, Wrench, Activity,
} from 'lucide-react';
import type { PhaseId } from '../derive';

export type FlowNodeKind = 'pill-start' | 'pill-end' | 'step' | 'decision';
export type FlowNode = {
  id: string;
  kind: FlowNodeKind;
  label: string;
  sub?: string;
  icon?: LucideIcon;
  phase?: PhaseId;
  branches?: { id: string; label: string; nodes?: FlowNode[]; joins?: boolean }[];
};
export type FlowConfig = { title: string; nodes: FlowNode[] };

/** The canonical end-to-end response flow (Operations / default). */
export const FLOW_RESPONSE: FlowConfig = {
  title: 'Response flow',
  nodes: [
    { id: 'start', kind: 'pill-start', label: 'Anomaly detected', icon: AlertTriangle },
    { id: 'detect', kind: 'step', label: 'Detect & ingest', sub: 'M1 · M2', icon: Database, phase: 'predict' },
    { id: 'classify', kind: 'decision', label: 'Attack or fault?', sub: 'M3', icon: GitBranch, phase: 'predict',
      branches: [{ id: 'attack', label: 'Attack' }, { id: 'fault', label: 'Fault' }, { id: 'abstain', label: 'Abstain' }] },
    { id: 'coordinate', kind: 'step', label: 'Coordinate agents', sub: 'Operator agents', icon: Activity, phase: 'coordinate' },
    { id: 'rules', kind: 'step', label: 'Rule engine verdict', sub: 'Cited policy evidence', icon: Scale, phase: 'coordinate' },
    { id: 'decision', kind: 'decision', label: 'Commander decision', sub: 'Human confirmation', icon: UserCheck, phase: 'contain',
      branches: [
        { id: 'approve', label: 'Approve', nodes: [{ id: 'contain', kind: 'step', label: 'Execute approved playbook', sub: 'Owner only', icon: ShieldCheck, phase: 'contain' }] },
        { id: 'reject', label: 'Reject / modify', joins: false, nodes: [{ id: 'revise', kind: 'step', label: 'Return for revision', icon: UserCheck, phase: 'coordinate' }] },
      ] },
    { id: 'clean', kind: 'step', label: 'Check clean path', sub: 'Verify before failover', icon: ShieldCheck, phase: 'heal' },
    { id: 'heal', kind: 'step', label: 'Heal & recover', sub: 'Clean-path failover', icon: Wrench, phase: 'heal' },
    { id: 'validate', kind: 'step', label: 'Validate recovery', icon: ShieldCheck, phase: 'fix' },
    { id: 'policy', kind: 'pill-end', label: 'Report gaps', sub: 'Candidate findings · human review separate', icon: Scale, phase: 'report' },
  ],
};

/** Investigation flow (root-cause oriented). */
export const FLOW_INVESTIGATION: FlowConfig = {
  title: 'Investigation flow',
  nodes: [
    { id: 'start', kind: 'pill-start', label: 'Incident detected', icon: AlertTriangle },
    { id: 'collect', kind: 'step', label: 'Collect & correlate evidence', sub: 'Telemetry · logs · RF · weather', icon: Database, phase: 'predict' },
    { id: 'classify', kind: 'decision', label: 'Attack or network fault?', sub: 'M3', icon: GitBranch, phase: 'predict',
      branches: [
        { id: 'attack', label: 'Attack', nodes: [
          { id: 'rootcause', kind: 'step', label: 'Determine root cause', icon: Stethoscope, phase: 'coordinate' },
          { id: 'impact', kind: 'step', label: 'Assess impact', icon: Activity, phase: 'coordinate' },
          { id: 'recommend', kind: 'step', label: 'Recommend response', icon: Wrench, phase: 'contain' },
        ] },
        { id: 'fault', label: 'Network fault', nodes: [
          { id: 'fault-validation', kind: 'step', label: 'Validate fault', icon: Stethoscope, phase: 'coordinate' },
          { id: 'fault-restore', kind: 'step', label: 'Restore capacity', icon: Wrench, phase: 'heal' },
        ] },
        { id: 'abstain', label: 'Abstain', joins: false, nodes: [
          { id: 'more-evidence', kind: 'step', label: 'Collect more evidence', icon: Database, phase: 'predict' },
        ] },
      ] },
    { id: 'complete', kind: 'pill-end', label: 'Investigation complete', icon: ShieldCheck },
  ],
};

/** Policy & Gaps flow. */
export const FLOW_POLICY: FlowConfig = {
  title: 'Policy evidence flow',
  nodes: [
    { id:'start', kind:'pill-start', label:'Incident observations', icon:AlertTriangle },
    { id:'retrieve', kind:'step', label:'Analyse & retrieve', sub:'Cited laws · guidance · cases', icon:Database, phase:'coordinate' },
    { id:'rules', kind:'step', label:'Rule engine verdict', sub:'Applicability and reporting duties', icon:Scale, phase:'coordinate' },
    { id:'gap', kind:'step', label:'Record candidate gaps', sub:'Bounded search evidence', icon:GitBranch, phase:'report' },
    { id:'approval', kind:'step', label:'Human gap review', sub:'Confirm or reject the candidate', icon:UserCheck, phase:'report' },
    { id:'done', kind:'pill-end', label:'Audit record', sub:'Separate from recovery permission', icon:ShieldCheck },
  ],
};

/** Recovery flow. */
export const FLOW_RECOVERY: FlowConfig = {
  title: 'Recovery flow',
  nodes: [
    { id: 'start', kind: 'pill-start', label: 'Response approved', icon: ShieldCheck },
    { id: 'contain', kind: 'step', label: 'Contain', sub: 'Owner-only playbook', icon: ShieldCheck, phase: 'contain' },
    { id: 'clean', kind: 'step', label: 'Clean-path check', icon: ShieldCheck, phase: 'heal' },
    { id: 'heal', kind: 'step', label: 'Heal', sub: 'Clean-path failover', icon: Wrench, phase: 'heal' },
    { id: 'rollout', kind: 'step', label: 'Staged rollout', sub: '5 → 25 → 100%', icon: Activity, phase: 'fix' },
    { id: 'reattack', kind: 'decision', label: 'Re-attack blocked?', sub: 'Verification', icon: GitBranch, phase: 'fix',
      branches: [
        { id: 'blocked', label: 'Blocked' },
        { id: 'rollback', label: 'Rollback', joins: false, nodes: [{ id: 'rollback-step', kind: 'step', label: 'Roll back changes', icon: Wrench, phase: 'fix' }] },
      ] },
    { id: 'validate', kind: 'pill-end', label: 'Service restored', icon: ShieldCheck },
  ],
};

export const FLOW_BY_ROUTE: Record<string, FlowConfig> = {
  '/operations': FLOW_RESPONSE,
  '/investigation': FLOW_INVESTIGATION,
  '/policy': FLOW_POLICY,
  '/recovery': FLOW_RECOVERY,
};
