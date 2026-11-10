import { useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { useOperatorData } from '../operations/useOperatorData';
import { taskEvidence } from '../workflow';
import { simClockIST } from './ContextStrip';

// Each task is projected from observed operator evidence, never director truth.
const STAGES = [
  { title: 'Predict', tasks: [['detect', 'Detect'], ['forecast', 'Forecast'], ['classify', 'Classify'], ['impact', 'Impact']] },
  { title: 'Heal', tasks: [['clean', 'Clean path'], ['heal', 'Failover'], ['allocate', 'Allocate']] },
  { title: 'Coordinate', tasks: [['coordinate', 'Agents'], ['rules', 'Policy'], ['clocks', 'Clocks'], ['recommend', 'Plan']] },
  { title: 'Contain', tasks: [['decision', 'Approval'], ['clone', 'Clone'], ['contain', 'Contain'], ['revise', 'Revise']] },
  { title: 'Fix', tasks: [['rollout5', '5%'], ['rollout25', '25%'], ['rollout100', '100%'], ['reattack', 'Re-attack'], ['validate', 'Restore'], ['rollback-step', 'Rollback']] },
  { title: 'Report gaps', tasks: [['gap', 'Find gap'], ['approval', 'Human review']] },
];
const LABELS = { done: 'Observed', current: 'Active', pending: 'Not observed', failed: 'Failed' };
export function CompactFlow({ onExpand }: { onExpand: () => void }) {
  const data = useOperatorData();
  const [selected, setSelected] = useState<{id:string; label:string} | null>(null);
  const evidence = selected ? taskEvidence(selected.id, data) : null;
  return <section className="compact-flow" data-tour="execution-flow" aria-label="Complete response flow">
    <header><strong title="Workstreams can overlap. Choose a task to inspect its observed evidence.">Response flow</strong><span>○ Not observed · ● Active · ✓ Observed · ! Failed</span><button className="sh-btn sh-btn--sm" type="button" onClick={onExpand}><Maximize2 size={13} /> Detailed graph</button></header>
    <div className="compact-flow__stages">{STAGES.map(stage => <div className="compact-flow__stage" key={stage.title}><b>{stage.title}</b><div>{stage.tasks.map(([id,label]) => { const status = taskEvidence(id,data).status; return <button key={id} type="button" className={`compact-flow__node is-${status}`} title={`${label}: ${LABELS[status]}`} aria-label={`${label}: ${LABELS[status]}`} aria-pressed={selected?.id === id} onClick={() => setSelected({id,label})}><span aria-hidden="true" className="compact-flow__mark">{status === 'done' ? '✓' : status === 'current' ? '●' : status === 'failed' ? '!' : '○'}</span><span>{label}</span></button>; })}</div></div>)}</div>
    {selected && evidence && <aside className="compact-flow__drawer" aria-label={`${selected.label} evidence`}><button type="button" aria-label="Close evidence" onClick={() => setSelected(null)}><X size={15} /></button><strong>{selected.label}</strong><p>{LABELS[evidence.status]}</p><p>{evidence.event ? <>Latest evidence: {evidence.event.kind} · {simClockIST(evidence.event.ts)} IST</> : 'No related operator evidence has been observed.'}</p></aside>}
  </section>;
}
