import { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowLeftRight, ArrowUpRight, ShieldCheck } from 'lucide-react';

const REPO = 'https://github.com/CharanVelavan/ORCA/blob/main/';
type Node = { id: string; tag: string; title: string; caption: string; detail: string; source: string };
const LANES: { label: string; nodes: Node[] }[] = [
  { label: 'Detect', nodes: [
    { id: 'network', tag: 'SRC', title: 'Emulated network', caption: 'Six Chennai sites + ground network', detail: 'The simulator produces SNR, rain, battery, loss, login and GNSS signals. All satellite and terrestrial links are emulated. The satellite operator’s ground management network is an explicit attack surface.', source: 'orca/sim/engine.py' },
    { id: 'prepare', tag: 'C / PP', title: 'Collect & prepare', caption: 'Posture scan + 36 telemetry features', detail: 'Configuration scans flag weak posture. Telemetry windows produce 36 features, including an ITU-R P.838 rain-fade residual. Hidden attack labels are kept outside operator evidence.', source: 'orca/models/features.py' },
    { id: 'models', tag: 'M1–M4', title: 'Model the evidence', caption: 'Anomaly · forecast · cause · capacity', detail: 'M1 flags anomalies. M2 forecasts failure with intervals. M3 assesses seven cause classes plus abstention. M4 solves a HiGHS capacity MILP with an explicit priority order and a greedy fallback. Role permissions route M1/M3 to the satellite operator, M2/M4 to mobile and M2 to the power utility.', source: 'orca/models/detector.py' },
  ] },
  { label: 'Decide', nodes: [
    { id: 'rules', tag: 'TYPED FACTS → P', title: 'Check verified rules', caption: 'Typed facts + YAML → verdict + KB ID', detail: 'The policy engine evaluates typed facts against deterministic YAML rules linked to verified KB records. It alone issues COMPLIANT, VIOLATION, AMBIGUITY, CONFLICT, POTENTIAL_GAP or INSUFFICIENT_EVIDENCE. Broad RAG does not set verdicts.', source: 'orca/rules.py' },
    { id: 'agents', tag: 'ROLE AGENTS', title: 'Coordinate a response', caption: 'Permitted facts + cited explanations', detail: 'Mobile and satellite operators, power utility, CERT, regulator, policy adviser and gap analyst exchange permitted evidence. Fine-tuned Qwen3.6-35B-A3B explains and drafts; the incident commander remains human.', source: 'orca/agents.py' },
    { id: 'rag', tag: 'RAG ↔ AGENTS', title: 'Retrieve the evidence', caption: 'Broad corpus · hybrid search · citations', detail: 'Chroma cosine-vector search and BM25 are fused with reciprocal-rank fusion. bge-reranker-base reranks the pool. A citation router promotes exact provisions. Parent sections add context; low-evidence results can abstain.', source: 'orca/kbvec/retrieve.py' },
  ] },
  { label: 'Act', nodes: [
    { id: 'plan', tag: 'OWNER + HUMAN', title: 'Authorise the plan', caption: 'Owned playbook · exact scope · expiry', detail: 'The owner selects a catalogue playbook. The commander authorises the exact plan with a hashed, expiring token, or explicitly scopes AUTO operation. Agents call execute_playbook; prose never grants authority.', source: 'orca/remediation.py' },
    { id: 'test', tag: 'GUARDED EXECUTION', title: 'Check before change', caption: 'Fresh verdict · clone test · clean path', detail: 'Execution rechecks ownership, token, expiry and current policy. A cloned sandbox tests the proposal. Failover checks the backup path is clean before moving traffic.', source: 'orca/remediation.py' },
    { id: 'recover', tag: 'D', title: 'Recover & verify', caption: '5% → 25% → 100% · rollback', detail: 'Staged deployment playbooks roll out at 5%, 25% and 100%. Outcome verification and re-attack checks can trigger automatic rollback. Doubt, conflict or integrity failure can downgrade AUTO to ASSISTED.', source: 'orca/remediation.py' },
  ] },
  { label: 'Report', nodes: [
    { id: 'notices', tag: 'NOTICE DRAFTS', title: 'Track each duty', caption: 'Separate triggers · separate clocks', detail: 'Notice drafts retain their own recipients, legal triggers and deadlines. The rule engine supplies the duties; agents explain why each applies. Humans review and send external notices.', source: 'orca/rules.py' },
    { id: 'gaps', tag: 'POLICY REVIEW', title: 'Document a candidate gap', caption: 'Search record · comparisons · recommendation', detail: 'A gap records the bounded search and nearby evidence, then proposes a recommendation for human review. “Not found in the sources we checked” does not establish that no rule exists. Only a human confirms the gap.', source: 'kb/gaps/COVERAGE.md' },
    { id: 'audit', tag: 'SINK', title: 'Preserve the trail', caption: 'Facts · citations · decisions · outcomes', detail: 'The hash-chained audit keeps reasoning, citations, authorisation and recovery outcomes inspectable. This evidence supports replay, verification and policy review after the incident.', source: 'orca/audit.py' },
  ] },
];

export function Architecture() {
  const [selected, setSelected] = useState('rules');
  const node = LANES.flatMap(l => l.nodes).find(n => n.id === selected)!;
  return <section className="learn-section learn-architecture" id="learn-architecture" aria-labelledby="architecture-title">
    <div className="learn-section__heading"><div><span className="learn-kicker">Inside the system / ITU-T Y.3172</span><h2 id="architecture-title">A clear path.<br />Explicit boundaries.</h2></div><p>Explore the implemented pipeline. Select a component to see its job, its authority and the code behind it.</p></div>
    <div className="learn-architecture__layout">
      <div className="learn-architecture__map" aria-label="Interactive architecture, read top to bottom">
        {LANES.map((lane, laneIndex) => <div className="learn-architecture__lane" key={lane.label}>
          <span className="learn-architecture__label"><b>0{laneIndex + 1}</b>{lane.label}</span>
          <div className="learn-architecture__row">{lane.nodes.map((n, i) => <div className="learn-architecture__cell" key={n.id}>
            <button type="button" aria-pressed={selected === n.id} aria-controls={`architecture-detail architecture-mobile-${n.id}`} onClick={() => setSelected(n.id)}>
              <span>{n.tag}</span><strong>{n.title}</strong><small>{n.caption}</small>
            </button>{selected === n.id && <div className="learn-architecture__mobile-detail" id={`architecture-mobile-${n.id}`} aria-live="polite"><p>{n.detail}</p><a className="learn-text-link" href={`${REPO}${n.source}`} target="_blank" rel="noreferrer">Inspect implementation <ArrowUpRight size={16} /></a></div>}{i < lane.nodes.length - 1 && (lane.label === 'Decide' && i === 1 ? <ArrowLeftRight className="learn-architecture__arrow" size={16} aria-hidden="true" /> : <ArrowRight className="learn-architecture__arrow" size={16} aria-hidden="true" />)}
          </div>)}</div>{lane.label === 'Decide' && <div className="learn-architecture__relationship">Typed facts → policy rules → agent explanations · agents ↔ retrieved evidence</div>}{laneIndex < LANES.length - 1 && <ArrowDown className="learn-architecture__down" size={18} aria-hidden="true" />}
        </div>)}
        <div className="learn-architecture__audit"><ShieldCheck size={17} /><span>Hash-chained evidence across every stage</span></div>
      </div>
      <aside className="learn-architecture__detail" id="architecture-detail" aria-live="polite" aria-atomic="true">
        <span className="learn-kicker">Selected component / {node.tag}</span><h3>{node.title}</h3><p>{node.detail}</p>
        <a className="learn-text-link" href={`${REPO}${node.source}`} target="_blank" rel="noreferrer">Inspect implementation <ArrowUpRight size={17} /></a><code>{node.source}</code>
      </aside>
    </div>
    <p className="learn-architecture__note">The architecture follows the report’s Detect → Decide → Act → Report lanes. Retrieval informs explanations; verified rules determine verdicts. Execution code enforces the guard boundary.</p>
  </section>;
}
