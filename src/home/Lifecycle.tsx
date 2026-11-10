import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Activity, ChartNoAxesCombined, Fingerprint, MessagesSquare, ShieldCheck, BookOpenCheck, type LucideIcon } from 'lucide-react';

const STEPS: { title: string; subtitle: string; body: string; evidence: string; icon: LucideIcon }[] = [
  { title: 'Observe', subtitle: 'Read the network.', body: 'Collect site telemetry and scan device posture. Keep the signals each operator can see separate from the simulator’s hidden ground truth.', evidence: 'Emulated telemetry · configuration evidence · 36 features', icon: Activity },
  { title: 'Anticipate', subtitle: 'See the exposure window.', body: 'Forecast link and battery failure. A predicted outage is also a window of cyber risk: traffic may soon need a different route.', evidence: 'M1 anomaly signals · M2 forecasts and uncertainty', icon: ChartNoAxesCombined },
  { title: 'Assess', subtitle: 'Fault, attack—or uncertainty?', body: 'Classify the likely cause, including management-plane intrusion, jamming, GNSS and signalling attacks. Abstain when evidence is insufficient.', evidence: 'M3 cause assessment · deterministic policy checks', icon: Fingerprint },
  { title: 'Coordinate', subtitle: 'Make responsibilities visible.', body: 'Role agents exchange permitted evidence, explain duties and draft notices. Reporting clocks keep their own triggers; a generated explanation cannot create a legal verdict.', evidence: 'Role agents · cited clauses · independent reporting clocks', icon: MessagesSquare },
  { title: 'Recover', subtitle: 'Restore service through guards.', body: 'Allocate scarce capacity and propose an owned playbook. Execution checks authorisation, a clone test and backup integrity. Staged changes can roll back.', evidence: 'M4 capacity plan · execute_playbook · approval and verification', icon: ShieldCheck },
  { title: 'Improve policy', subtitle: 'Turn uncertainty into evidence.', body: 'Preserve the search record, nearby clauses and global comparisons. Agents propose a gap; a human confirms it and signs any recommendation.', evidence: 'Gap register · bounded search · human judgement', icon: BookOpenCheck },
];

export function Lifecycle() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 60%'] });
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return <section className="learn-section learn-lifecycle" id="learn-method" data-tour="learn-method" ref={ref} aria-labelledby="lifecycle-title">
    <div className="learn-lifecycle__intro">
      <span className="learn-kicker">What ORCA does</span>
      <h2 id="lifecycle-title">From vigilance<br />to recovery.<br /><span>Then better policy.</span></h2>
      <p>ORCA-NTN means <strong>Orchestrated Response and Coordination Agents for Non-Terrestrial Networks.</strong></p>
      <p>One method connects network resilience, cyber incident coordination and evidence for policy review.</p>
      <a className="learn-text-link" href="#learn-architecture">Explore the architecture <span aria-hidden="true">↗</span></a>
    </div>
    <div className="learn-lifecycle__sequence"><div className="learn-lifecycle__track" aria-hidden="true"><motion.div style={{ scaleY: reduced ? 1 : scaleY }} /></div><ol className="learn-lifecycle__steps">
      {STEPS.map(({ title, subtitle, body, evidence, icon: Icon }, i) => <motion.li key={title}
        initial={reduced ? false : { opacity: .5, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .4 }} transition={{ duration: .45, ease: [.165, .84, .44, 1] }}>
        <div className="learn-lifecycle__marker"><Icon size={19} strokeWidth={1.5} /></div>
        <span className="learn-kicker">0{i + 1} / {title}</span><h3>{subtitle}</h3><p>{body}</p><small>{evidence}</small>
      </motion.li>)}
    </ol></div>
  </section>;
}
