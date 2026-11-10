import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, LockKeyhole, ShieldCheck, Box, RotateCcw } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Architecture } from '../../home/Architecture';
import { EvidenceGraph } from '../../home/EvidenceGraph';
import { Lifecycle } from '../../home/Lifecycle';
import { MethodFilm } from '../../home/MethodFilm';
import { NetworkMark } from '../../home/NetworkMark';
import '@fontsource/geist-sans/latin-700.css';
import '@fontsource/geist-sans/latin-800.css';
import '../../home/learn.css';

const NetworkScene = lazy(() => import('../../scenes/NetworkScene').then(module => ({ default: module.NetworkScene })));

class LearnSceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function InteractiveNetwork() {
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reset, setReset] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !viewport.current) return;
    const element = viewport.current;
    const onLost = () => { setFailed(true); setActive(false); };
    element.addEventListener('webglcontextlost', onLost, true);
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting), { rootMargin: '160px' });
    observer.observe(element);
    return () => { element.removeEventListener('webglcontextlost', onLost, true); observer.disconnect(); };
  }, [active]);

  return <section className="learn-section learn-interactive" id="learn-network" aria-labelledby="interactive-network-title">
    <div className="learn-section__heading"><div><span className="learn-kicker">Explore / Interactive 3D</span><h2 id="interactive-network-title">Explore the network.<br />Follow the connections.</h2></div><div><p>Orbit the satellite, gateways and six Chennai sites using the project’s 3D models. The scene shows the selected recording’s observed state. Every link is emulated.</p><a className="learn-text-link" href="#learn-film">Watch the narrated explanation <ArrowRight size={17} /></a></div></div>
    <figure className="learn-interactive__figure">
      <div className={`learn-interactive__viewport${active ? ' is-active' : ''}`} ref={viewport}>
        {active && visible ? <LearnSceneBoundary key={reset} onFailure={() => { setFailed(true); setActive(false); }}><Suspense fallback={<p className="learn-interactive__loading" role="status">Loading the interactive network…</p>}><NetworkScene truth={false} compact /></Suspense></LearnSceneBoundary> : <div className="learn-interactive__static"><NetworkMark /><div><span className="learn-kicker">Emulated Chennai network</span><h3>{active ? '3D pauses outside the viewport.' : 'Your view of the network.'}</h3><p>Satellite backhaul, operator ground infrastructure and local services share a trust boundary. Enable 3D to rotate and zoom, or keep this lighter diagram.</p>{!active && <button type="button" className="learn-button" onClick={() => { setFailed(false); setVisible(true); setActive(true); }}><Box size={17} />Enable interactive 3D</button>}</div></div>}
      </div>
      <figcaption className="learn-interactive__controls"><span>{failed ? '3D could not load. The lighter view and network description remain available.' : active ? 'Drag to rotate · scroll or pinch to zoom · all links emulated' : '3D loads only when enabled. Keep the static view for lighter playback.'}</span><div>{active && <button type="button" onClick={() => setReset(value => value + 1)}><RotateCcw size={15} />Reset view</button>}<button type="button" onClick={() => { setFailed(false); setVisible(true); setActive(value => !value); }}>{active ? 'Use static view' : failed ? 'Retry 3D' : 'Enable 3D'}</button></div></figcaption>
    </figure>
    <details className="learn-interactive__description"><summary>Read the network description</summary><p>The emulated topology contains one satellite, main and backup Indian ground stations, a restricted foreign ground station, and the operator’s ground management network. Six Chennai sites represent Park Town, T. Nagar, Adyar, Guindy, Ennore and OMR. The interactive scene reads observed session state; it does not reveal hidden simulator attack labels or execute any network change. Use the static view or this description if 3D is unavailable.</p></details>
  </section>;
}

const MODELS = [
  ['M1', 'Notice the unusual.', 'Isolation Forest + ECOD', 'Turn site telemetry into an anomaly signal. A flag starts an investigation; it does not prove an attack.'],
  ['M2', 'See the exposure window.', 'LightGBM quantiles + conformal intervals', 'Forecast link and battery failure to the minute. A separate daily tier uses Turkcell radio-link data. Keep uncertainty visible.'],
  ['M3', 'Distinguish fault from attack.', 'Calibrated LightGBM + SHAP', 'Seven cause classes cover normal operation, faults and attacks. An eighth output abstains when evidence is insufficient.'],
  ['M4', 'Keep essential traffic moving.', 'MILP · HiGHS', 'Allocate scarce capacity with an explicit priority order. Use a greedy fallback if the optimiser cannot solve.'],
];
const ROLES = [
  ['Mobile operator', 'Owns tower and backhaul responses. Warns dependent services and proposes clean-path failover.'],
  ['Satellite operator', 'Investigates the ground management network. Owns its credentials, terminals and management playbooks.'],
  ['Power utility', 'Shares power and battery evidence. Advises the response; its current role owns no execution playbooks.'],
  ['National CERT', 'Triages released reports, preserves evidence and drafts advisories for a human officer.'],
  ['Telecom regulator', 'Checks reporting and authorisation duties. Drafts directions for human review.'],
  ['Policy adviser', 'Answers from cited knowledge-base evidence. Explains clauses without issuing verdicts.'],
  ['Gap analyst', 'Documents candidate gaps and comparisons. A human confirms or rejects each finding.'],
];

export default function Home() {
  const { search } = useLocation();
  const reduced = useReducedMotion();
  return <div className="learn-page">
    <section className="learn-hero" aria-labelledby="learn-title">
      <div className="learn-hero__copy"><span className="learn-kicker">ORCA—NTN / Secure self-healing</span>
        <motion.h1 id="learn-title" initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, ease: [.19, 1, .22, 1] }}>Stay vigilant.<br /><span>Recover<br />with trust.</span></motion.h1>
        <p>Cyber-aware coordination for NTN. Detect threats, check recovery paths and keep every action accountable.</p>
        <div className="learn-actions"><Link className="learn-button learn-button--white" to={`/scenarios${search}`}>Choose a scenario <ArrowRight size={18} /></Link><a className="learn-text-link" href="#learn-network">Explore in 3D <ArrowRight size={17} /></a></div>
        <div className="learn-hero__context"><span>Team SolarSailor · SSN, Chennai</span><span>ITU AI for Good Sandbox / C1</span></div>
      </div><NetworkMark />
    </section>
    <div className="learn-hero-strip"><span><ShieldCheck size={17} />All network links are emulated.</span><a href="#learn-film">Watch the narrated method film <ArrowRight size={16} /></a></div>
    <section className="learn-section learn-story" id="learn-story" data-tour="learn-story" aria-labelledby="story-title">
      <div><span className="learn-kicker">Connectivity is only the beginning</span><h2 id="story-title">Everyday services.<br />A wider trust boundary.</h2></div>
      <div className="learn-story__body"><p><strong>Non-Terrestrial Networks (NTN)</strong> use platforms above the ground, including satellites, to extend connectivity. Satellite backhaul can support mobile coverage, remote operations and service continuity.</p><p>As these uses expand, availability and cyber security need to work together. A disrupted link may be weather, equipment failure or deliberate interference. A backup path needs its own integrity check.</p><p>Our sandbox brings that problem into six Chennai sites: emergency calls, hospital telemetry, UPI and ATM traffic, grid communications and everyday connectivity.</p></div>
      <div className="learn-questions">{[['Know the cause.', 'Separate a fault from an attack. Make uncertainty visible.'], ['Trust the recovery.', 'Check the backup path before moving traffic.'], ['Coordinate the response.', 'Explain who acts, who approves and which duties apply.']].map(([t, b], i) => <article key={t}><b>0{i + 1}</b><h3>{t}</h3><p>{b}</p></article>)}</div>
    </section>
    <MethodFilm />
    <InteractiveNetwork />
    <Lifecycle />
    <section className="learn-manifesto" aria-label="Responsibility boundaries"><span>Models detect.</span><span>Agents coordinate.</span><span>Code decides.</span><span>Humans approve.</span></section>
    <Architecture />
    <section className="learn-section learn-model-section" aria-labelledby="model-title"><div className="learn-section__heading"><div><span className="learn-kicker">M1–M4 / Evidence before action</span><h2 id="model-title">Four models.<br />Four specific jobs.</h2></div><p>Forecasts and classifications inform a response. Authorisation comes from the guarded execution path.</p></div><div className="learn-models">{MODELS.map(([id, t, m, b]) => <article key={id}><b>{id}</b><div><h3>{t}</h3><span>{m}</span><p>{b}</p></div></article>)}</div></section>
    <EvidenceGraph />
    <section className="learn-section learn-agent-section" aria-labelledby="agents-title"><div className="learn-section__heading"><div><span className="learn-kicker">Coordination with boundaries</span><h2 id="agents-title">A role for each agent.<br />Authority stays explicit.</h2></div><p>Evidence arrives progressively. Each participant sees permitted signals, requests missing information and acts within its ownership.</p></div><div className="learn-roles">{ROLES.map(([t, b]) => <article key={t}><h3>{t}</h3><p>{b}</p></article>)}</div><div className="learn-human"><LockKeyhole size={26} /><div><h3>The incident commander is human.</h3><p>AI explains signals, cites evidence and drafts proposals. The human explains the final judgement, resolves ambiguous duties, authorises scope and confirms policy gaps. Scoped AUTO operation is separately authorised and can downgrade as safety conditions change.</p></div></div></section>
    <section className="learn-policy"><div className="learn-section"><span className="learn-kicker">The second job / Improve the rulebook</span><h2>A policy gap<br />needs evidence.</h2><div className="learn-policy__columns"><div><p>Six verdicts come from code:</p><div className="learn-verdicts">{['COMPLIANT', 'VIOLATION', 'AMBIGUITY', 'CONFLICT', 'POTENTIAL_GAP', 'INSUFFICIENT_EVIDENCE'].map(v => <code key={v}>{v}</code>)}</div><p>Each verdict cites KB record IDs. Binding rules, advisory guidance and drafts retain their distinct legal status.</p></div><div><h3>From a finding to a recommendation.</h3><p>New exercises use Indian rules with EU and global sources available for comparison. Each source retains its own jurisdiction and legal status.</p><p>A candidate gap includes the search record, nearby clauses and a draft recommendation. Only a human confirms it.</p><Link className="learn-text-link" to={`/policy${search}`}>Open Policy &amp; Gaps <ArrowRight size={17} /></Link></div></div><p className="learn-policy__limit">“Not found in the sources we checked” describes a bounded search. It never proves that no rule exists.</p></div></section>
    <section className="learn-section" aria-labelledby="recovery-title"><div className="learn-section__heading"><div><span className="learn-kicker">Recovery is a controlled change</span><h2 id="recovery-title">Check the path.<br />Approve the plan.<br />Verify the outcome.</h2></div><p>Agents execute an approved playbook through <code>execute_playbook</code>. Approval binds the exact plan and expires.</p></div><ol className="learn-guards">{[['Authorise', 'Check owner, exact plan, fresh rule verdict and scoped token.'], ['Test safely', 'Test in a cloned sandbox. Check backup integrity before failover.'], ['Stage the change', 'Roll out at 5%, 25% and 100% for staged deployment playbooks.'], ['Verify & record', 'Re-attack check and rollback on failure. Preserve rationale and evidence.']].map(([t, b]) => <li key={t}><h3>{t}</h3><p>{b}</p></li>)}</ol><Link className="learn-button" to={`/recovery${search}`}>Inspect recovery evidence <ArrowRight size={18} /></Link></section>

    <section className="learn-section learn-limits"><div><span className="learn-kicker">Scope &amp; limits</span><h2>A sandbox.<br />An inspectable method.</h2></div><div><p>Every satellite and terrestrial link is emulated. Training includes synthetic data; the daily forecasting tier uses the ITU sandbox dataset. This prototype does not claim a deployed satellite system.</p><p>Live agents can be formulaic. Retrieval and abstention remain imperfect, and latency is a measured limitation. Results belong to the documented test conditions.</p><p>Start in the simulator, inspect a recorded replay, or run a compatible model endpoint.</p><div className="learn-actions"><Link className="learn-button" to={`/workspace${search}`}>Open recorded Console <ArrowRight size={18} /></Link><Link className="learn-text-link" to={`/audit${search}`}>Inspect a recorded run <ArrowRight size={17} /></Link></div></div></section>
    <footer className="learn-footer"><strong>ORCA—NTN</strong><p>Team SolarSailor · SSN, Chennai</p><Link to={`/guide${search}`}>Guide <ArrowRight size={16} /></Link><a href="https://github.com/CharanVelavan/ORCA" target="_blank" rel="noreferrer">Source code <ArrowUpRight size={16} /></a><a href="https://huggingface.co/datasets/CharanVelavan/orca-ntn-kb-v2" target="_blank" rel="noreferrer">Knowledge base <ArrowUpRight size={16} /></a><a href="https://huggingface.co/CharanVelavan/orca-ntn-qwen3.6-35b-a3b-ft-gguf" target="_blank" rel="noreferrer">Tuned model <ArrowUpRight size={16} /></a></footer>
  </div>;
}
