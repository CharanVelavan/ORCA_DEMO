const STAGES = [
  { title:'Scenario and emulated network', items:['Progressive scenario releases → six Chennai sites', 'Emulated NTN paths, gateways and ground management', 'Posture scanner → telemetry and feature windows'] },
  { title:'Four model outputs', items:['M1 · Isolation Forest anomaly detection', 'M2 · Minute failure forecast; separate daily tier', 'M3 · Fault / attack classes, with abstention', 'M4 · Capacity allocation with MILP and fallback'] },
  { title:'Facts, rules and evidence', items:['Observed facts → deterministic YAML rule engine', 'Verified KB records → six cited verdicts', 'Independent reporting triggers and deadlines', 'Insufficient evidence → collect more observations'] },
  { title:'Role agents and retrieval', items:['Mobile operator · satellite operator · power utility', 'CERT-In · regulator · policy adviser · gap analyst', 'RAG retrieval → accepted citations → explanation', 'Plans belong to the responsible network owner'] },
  { title:'Authorization and guarded execution', items:['Exact plan → scoped autonomy or human approval', 'Reject / expire / refuse → revise; no change applied', 'Clone test → clean-path checks → staged rollout', '5% → 25% → 100% → re-attack verification', 'Failed health check → rollback → review again'] },
  { title:'Evidence and policy review', items:['Service delivery and recovery evidence', 'Hash-chained audit → replay and human rationale', 'Candidate gap → search evidence and comparison', 'Human confirms or rejects; KB is not rewritten'] },
];
export function Architecture() {
  return <section className="architecture" aria-label="Detailed ORCA-NTN architecture">
    <p className="architecture-note">System methodology · a conceptual map, not a completed run. Every NTN link is emulated.</p>
    <ol>{STAGES.map((stage, index) => <li key={stage.title}><span className="architecture-index">{index + 1}</span><div><h3>{stage.title}</h3><ul>{stage.items.map((item) => <li key={item}>{item}</li>)}</ul></div></li>)}</ol>
    <p className="architecture-note">Response, coordination and policy review can run in parallel. Live node states are shown in the Execution view.</p>
  </section>;
}
