/**
 * FlowPanel — the right-hand, page-specific vertical flow (the mockup centrepiece).
 * Rounded steps, true decision diamonds (label inside), diverging branch edges, pill
 * start/end. Each node lights from the engine's real phase history (derive.phaseSteps);
 * the *current* node is the only one that pulses — done nodes are calm, not glowing.
 * Decision branches resolve from live engine signals (M3 class, gaps, rollback) so the
 * taken edge is solid and the untaken edge is greyed. Clicking any node opens live
 * evidence (model explanation, latest verdict, related record ids).
 *
 * Owned by the shell so Console/Stage keep using pipeline/FlowGraph unchanged.
 */
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, CheckCircle2, ChevronRight, Circle, CircleDot, FileText, Info, Workflow } from 'lucide-react';
import { citationIds, models as deriveModels, openGaps, useDerived } from '../derive';
import type { DeriveInput } from '../derive';
import { useLiveStore } from '../store';
import type { FlowConfig, FlowNode } from './flowConfig';
import { Code } from './primitives';
import { simClockIST } from './ContextStrip';
import { currentApproval, taskEvidence } from '../workflow';

type NodeStatus = 'done' | 'current' | 'pending' | 'failed';

function FlowStatus({ status }: { status: NodeStatus }) {
  const states = {
    done: { Icon: CheckCircle2, label: 'Observed' },
    current: { Icon: CircleDot, label: 'Active' },
    pending: { Icon: Circle, label: 'Not observed' },
    failed: { Icon: AlertCircle, label: 'Failed' },
  };
  const { Icon, label } = states[status];
  return <span className={`sh-flow-status is-${status}`}><Icon size={11} strokeWidth={2} aria-hidden />{label}</span>;
}

/** Which branch id the engine actually took at a decision node (undefined = not yet). */
export function activeBranch(node: FlowNode, d: DeriveInput): string | undefined {
  const ids = (node.branches ?? []).map((b) => b.id);
  if (ids.includes('attack') || ids.includes('fault')) {
    const model = deriveModels(d).find((m) => m.id === 'M3');
    const klass = String(model?.klass ?? '').toLowerCase();
    if (model?.abstain || klass === 'abstain') return 'abstain';
    if (klass.startsWith('attack')) return 'attack';
    if (klass.startsWith('fault')) return 'fault';
    return undefined;
  }
  if (ids.includes('approve') || ids.includes('reject')) {
    const approval = currentApproval(d);
    if (approval?.status === 'approved' || approval?.status === 'auto') return 'approve';
    if (approval?.status === 'rejected') return 'reject';
    return undefined;
  }
  if (ids.includes('yes') || ids.includes('no')) {
    if (openGaps(d).length) return 'no';
    const verdicts = d.verdicts ?? [];
    return d.summary?.final === true && verdicts.length > 0 && verdicts.every((v) => v.verdict === 'COMPLIANT') ? 'yes' : undefined;
  }
  if (ids.includes('blocked') || ids.includes('rollback')) {
    const verification = taskEvidence('reattack', d).event;
    if (verification?.kind === 'rollback') return 'rollback';
    return verification?.kind === 'reattack' && verification.blocked === true ? 'blocked' : undefined;
  }
  return undefined;
}

export function flowNodeStatus(n: FlowNode, d: DeriveInput, _statuses?: Record<string, NodeStatus>): NodeStatus {
  if (n.kind === 'pill-start' && n.label === 'Response approved') return ['approved','auto'].includes(currentApproval(d)?.status ?? '') ? 'done' : 'pending';
  return taskEvidence(n.id,d).status;
}

export function FlowPanel({ config }: { config: FlowConfig }) {
  const d = useDerived();
  const [selected, setSelected] = useState<string | null>(null);

  const statusFor = (n: FlowNode): NodeStatus => flowNodeStatus(n, d);

  const allNodes = config.nodes.flatMap((n) => [n, ...(n.branches ?? []).flatMap((b) => b.nodes ?? [])]);
  const selectedNode = allNodes.find((n) => n.id === selected) ?? null;

  return (
    <div className="sh-flow">
      <header className="sh-flow__head">
        <div className="sh-flow__title"><Workflow size={15} strokeWidth={2} /><span>{config.title}</span></div>
        {config.nodes.some(n => n.label === 'Response approved') && <small>Current response: {currentApproval(d)?.playbook ?? 'Awaiting a plan'}{currentApproval(d)?.status ? ` · ${currentApproval(d)?.status}` : ''}</small>}
      </header>

      <div className="sh-flow__canvas" role="list">
        {config.nodes.map((n, i) => {
          const st = statusFor(n);
          const active = selected === n.id;
          const taken = n.kind === 'decision' ? activeBranch(n, d) : undefined;
          return (
            <div key={n.id} className="sh-flow__row" role="listitem">
              {i > 0 && <span className={`sh-flow__edge is-${st}`} aria-hidden />}
              {n.kind === 'decision'
                ? <DiamondView node={n} status={st} active={active} taken={taken} onClick={() => setSelected(active ? null : n.id)} />
                : <FlowNodeView node={n} status={st} active={active} onClick={() => setSelected(active ? null : n.id)} />}
              {n.kind === 'decision' && n.branches && (
                <Diverge branches={n.branches} taken={taken} selected={selected} statusFor={statusFor}
                  onSelect={(id) => setSelected(selected === id ? null : id)} />
              )}
            </div>
          );
        })}
      </div>

      {selectedNode && <FlowDetails node={selectedNode} />}
    </div>
  );
}

/** True decision diamond — rotated square, counter-rotated label inside. */
function DiamondView({ node, status, active, taken, onClick }: { node: FlowNode; status: NodeStatus; active: boolean; taken?: string; onClick: () => void }) {
  const Icon = node.icon;
  const reduced = useReducedMotion();
  const cls = `sh-diamond is-${status}${active ? ' is-selected' : ''}${taken ? ' is-resolved' : ''}`;
  return (
    <motion.button type="button" className={cls} onClick={onClick} initial={false} whileTap={reduced ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.18 }}>
      <span className="sh-diamond__face" aria-hidden />
      <span className="sh-diamond__content">
        {Icon && <Icon size={14} strokeWidth={2} />}
        <span className="sh-diamond__label">{node.label}</span>
        {node.sub && <span className="sh-diamond__sub">{node.sub}</span>}
        <FlowStatus status={status} />
      </span>
    </motion.button>
  );
}

function Diverge({ branches, taken, selected, statusFor, onSelect }: {
  branches: NonNullable<FlowNode['branches']>; taken?: string; selected:string | null;
  statusFor:(node:FlowNode) => NodeStatus; onSelect:(id:string) => void;
}) {
  const columns = { gridTemplateColumns: `repeat(${branches.length}, minmax(0, 1fr))` };
  const x = (index:number) => (index + 0.5) * 200 / branches.length;
  const state = (id:string) => taken === id ? ' is-taken' : taken ? ' is-untaken' : '';
  return (
    <div className="sh-diverge">
      <svg className="sh-diverge__edges" viewBox="0 0 200 44" preserveAspectRatio="none" aria-hidden>
        {branches.map((b, i) => <path key={b.id} pathLength={1} d={`M100 0 C100 26, ${x(i)} 18, ${x(i)} 44`} className={`sh-diverge__line${state(b.id)}`} />)}
      </svg>
      <div className="sh-diverge__labels" style={columns}>
        {branches.map((b) => (
          <span key={b.id}
            className={`sh-flow__branch sh-flow__branch--${b.id}${state(b.id)}`}>
            {b.label}
          </span>
        ))}
      </div>
      {branches.some((b) => b.nodes?.length) && <div className="sh-diverge__lanes" style={columns}>
        {branches.map((b) => <div key={b.id} className={`sh-diverge__lane${state(b.id)}${b.joins === false ? ' is-terminal' : ''}`}>
          {(b.nodes ?? []).map((node) => <div key={node.id} className="sh-diverge__step">
            <span className={`sh-flow__edge is-${taken === b.id ? statusFor(node) : 'pending'}`} aria-hidden />
            <FlowNodeView node={node} status={taken === b.id ? statusFor(node) : 'pending'} active={selected === node.id} onClick={() => onSelect(node.id)} />
          </div>)}
        </div>)}
      </div>}
      <svg className="sh-diverge__edges sh-diverge__join" viewBox="0 0 200 44" preserveAspectRatio="none" aria-hidden>
        {branches.map((b, i) => b.joins !== false && <path key={b.id} pathLength={1} d={`M${x(i)} 0 C${x(i)} 26, 100 18, 100 44`} className={`sh-diverge__line${state(b.id)}`} />)}
      </svg>
    </div>
  );
}

function FlowNodeView({ node, status, active, onClick }: { node: FlowNode; status: NodeStatus; active: boolean; onClick: () => void }) {
  const Icon = node.icon;
  const reduced = useReducedMotion();
  const cls = `sh-node sh-node--${node.kind.startsWith('pill') ? 'pill' : node.kind} is-${status}${active ? ' is-selected' : ''}`;
  return (
    <motion.button
      type="button"
      className={cls}
      onClick={onClick}
      initial={false}
      whileTap={reduced ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.18 }}
    >
      <span className="sh-node__inner">
        {Icon && <Icon size={15} strokeWidth={2} className="sh-node__icon" />}
        <span className="sh-node__text">
          <span className="sh-node__label">{node.label}</span>
          {node.sub && <span className="sh-node__sub">{node.sub}</span>}
          <FlowStatus status={status} />
        </span>
      </span>
    </motion.button>
  );
}

/** Flow details: evidence, model explanation, related record ids — all from events. */
function FlowDetails({ node }: { node: FlowNode }) {
  const d = useDerived();
  const reduced = useReducedMotion();
  const verdicts = useLiveStore((s) => s.verdicts);
  const records = citationIds(d).slice(0, 6);
  const m3 = deriveModels(d).find((m) => m.id === 'M3');
  const latestVerdict = verdicts[verdicts.length - 1];

  return (
    <motion.section className="sh-flow__details" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.18, ease: [0.165, 0.84, 0.44, 1] }}>
      <header className="sh-flow__details-head"><Info size={14} strokeWidth={2} /><span>Flow details: {node.label}</span></header>

      <div className="sh-flow__details-row">
        <FileText size={13} strokeWidth={2} />
        <div>
          <div className="sh-flow__details-label">Model explanation</div>
          <div className="sh-flow__details-val">
            {m3?.klass
              ? <>M3 class <b>{m3.klass}</b>{m3.abstain ? ' · abstained' : m3.confidence !== undefined ? ` · confidence ${(m3.confidence * 100).toFixed(0)}%` : ''}</>
              : <span className="sh-muted">No model output yet.</span>}
          </div>
        </div>
      </div>

      <div className="sh-flow__details-row">
        <ChevronRight size={13} strokeWidth={2} />
        <div>
          <div className="sh-flow__details-label">Latest verdict</div>
          <div className="sh-flow__details-val">
            {latestVerdict
              ? <><b>{String(latestVerdict.verdict)}</b> · {String(latestVerdict.rule_id ?? latestVerdict.rule ?? 'Rule id unavailable')}</>
              : <span className="sh-muted">No verdict yet.</span>}
          </div>
          <div className="sh-flow__details-row">
            <ChevronRight size={13} strokeWidth={2} />
            <div>
              <div className="sh-flow__details-label">Latest related event</div>
              <RelatedEvent node={node} />
            </div>
          </div>
        </div>
      </div>

      <div className="sh-flow__details-row">
        <ChevronRight size={13} strokeWidth={2} />
        <div>
          <div className="sh-flow__details-label">Related records</div>
          <div className="sh-flow__records">
            {records.length ? records.map((r) => <Code key={r}>{r}</Code>) : <span className="sh-muted">None cited yet.</span>}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function RelatedEvent({ node }: { node:FlowNode }) {
  const events = useLiveStore((s) => s.events);
  const kinds:Record<string,string[]> = {
    detect:['alert','model'], collect:['alert','model'], classify:['model'], rootcause:['model'],
    impact:['impact','tick'], recommend:['approval','agent_final'], coordinate:['agent_busy','agent_step'],
    rules:['verdict'], adequate:['verdict','gap'], gap:['gap'], policy:['gap','verdict'],
    decision:['approval'], approval:['approval'], contain:['execute'], clean:['heal'], heal:['heal'],
    rollout:['patch_stage','rollback'], reattack:['reattack','rollback'], validate:['impact','reattack'],
    'fault-validation':['model'], 'fault-restore':['heal'], 'execute-recovery':['execute'],
    'rollback-step':['rollback'], revise:['approval'], 'more-evidence':['alert','model'],
  };
  const relevant = kinds[node.id] ?? [];
  const event = [...events].reverse().find((e) => relevant.includes(e.kind)
    && (node.id !== 'classify' && node.id !== 'rootcause' || e.kind !== 'model' || e.model === 'M3'));
  if (!event) return <span className="sh-muted">No related event yet.</span>;
  const detail = typeof event.status === 'string' ? event.status : typeof event.result === 'string' ? event.result : '';
  return <div className="sh-flow__details-val">{event.kind}{detail ? `: ${detail}` : ''} · {simClockIST(event.ts)} IST</div>;
}
