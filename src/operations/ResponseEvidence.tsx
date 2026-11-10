import { AlertCircle, Check, ClipboardCheck, FileSearch, ListChecks, Loader2, Scale, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { models, openApprovals, openGaps, type DeriveInput, type Tone } from '../derive';
import { ApprovalCard } from '../inbox/ApprovalCard';
import { toMs } from '../inbox/format';
import { Empty, Panel, StatusBadge, simClockIST } from '../shell';
import type { LiveEvent } from '../types';
import { featurePairs, number, strings, text, type Catalogue } from './data';
import { remediationSteps, type StepState } from './steps';

const VERDICTS = new Set(['COMPLIANT', 'VIOLATION', 'AMBIGUITY', 'CONFLICT', 'POTENTIAL_GAP', 'INSUFFICIENT_EVIDENCE']);

export function Approvals({ data, catalogue }: { data: DeriveInput; catalogue: Catalogue }) {
  const now = toMs(data.ts);
  const pending = openApprovals(data).filter((approval) => {
    const expires = toMs(approval.expires_at);
    return !Number.isFinite(now) || !Number.isFinite(expires) || expires > now;
  });
  return (
    <Panel title="Approval requests" icon={ClipboardCheck} right={<StatusBadge tone={pending.length ? 'warn' : 'unknown'} word={pending.length ? `${pending.length} pending` : 'None pending'} size="sm" />}>
      {pending.length === 0 ? <Empty>No approval request has been received for a current plan.</Empty> : (
        <div className="ops-approvals">{pending.map((approval) => {
          const playbook = catalogue.playbooks.find((item) => item.id === approval.playbook);
          return <ApprovalCard key={approval.hash} approval={{ ...approval, title: text(approval.title) ?? playbook?.title, risk: playbook?.risk }} />;
        })}</div>
      )}
    </Panel>
  );
}

function description(event: LiveEvent): { label: string; tone: Tone; word: string; detail?: string } {
  const playbook = text(event.playbook);
  const suffix = playbook ? ` ${playbook}` : '';
  if (event.kind === 'approval') {
    const status = text(event.status) ?? 'unavailable';
    const tone: Tone = status === 'approved' || status === 'auto' ? 'ok' : status === 'rejected' ? 'critical' : status === 'requested' ? 'warn' : 'unknown';
    return { label: `Approval${suffix}`, tone, word: status };
  }
  if (event.kind === 'execute') {
    const result = text(event.result);
    return { label: `Execution${suffix}`, tone: result === 'ok' ? 'ok' : result === 'refused' || result === 'rolled_back' ? 'critical' : 'unknown', word: result ?? 'Unavailable', detail: text(event.why) ?? text(event.reason) ?? text(event.detail) };
  }
  if (event.kind === 'patch_stage') {
    const health = text(event.health);
    const pct = number(event.pct);
    return { label: `Rollout${suffix}${pct === undefined ? '' : ` ${pct}%`}`, tone: health === 'ok' ? 'ok' : health === 'fail' ? 'critical' : 'unknown', word: health ?? 'Unavailable' };
  }
  if (event.kind === 'heal') {
    const check = event.check && typeof event.check === 'object' ? event.check as Record<string, unknown> : {};
    return { label: `Failover${text(event.site) ? ` ${event.site}` : ''}`, tone: check.clean === true ? 'ok' : check.clean === false ? 'critical' : 'unknown', word: check.clean === true ? 'Clean path verified' : check.clean === false ? 'Path not clean' : 'Path check unavailable', detail: text(event.to_path) ? `Path ${event.to_path}` : undefined };
  }
  if (event.kind === 'rollback') return { label: `Rollback${suffix}`, tone: 'warn', word: 'Reported', detail: text(event.reason) ?? text(event.why) };
  if (event.kind === 'reattack') return { label: `Re-attack check${suffix}`, tone: event.blocked === true ? 'ok' : event.blocked === false ? 'critical' : 'unknown', word: event.blocked === true ? 'Blocked' : event.blocked === false ? 'Not blocked' : 'Unavailable' };
  return { label: event.kind, tone: 'unknown', word: 'Reported' };
}

function diffFor(event: LiveEvent): string | undefined {
  if (typeof event.diff === 'string') return event.diff;
  if (event.diff && typeof event.diff === 'object') {
    const diff = event.diff as Record<string, unknown>;
    if (typeof diff.unified === 'string') return diff.unified;
  }
  const candidates = Array.isArray(event.diffs) ? event.diffs : Array.isArray(event.network) ? event.network : [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const diff = candidate as Record<string, unknown>;
    if (typeof diff.unified === 'string') return diff.unified;
    if (typeof diff.diff === 'string') return diff.diff;
  }
  return undefined;
}

function redactDiff(diff: string): string {
  return diff.split('\n').map((line) => /(?:pin|password|secret|token|credential_ref)\s*:/i.test(line) ? line.replace(/:.*/, ': [redacted]') : line).join('\n');
}

const STEP_VIEW: Record<StepState, { tone: Tone; word: string }> = {
  done: { tone: 'ok', word: 'Done' }, current: { tone: 'accent', word: 'In progress' }, failed: { tone: 'critical', word: 'Failed' }, pending: { tone: 'unknown', word: 'Pending' },
};

export function RemediationTimeline({ data }: { data: DeriveInput }) {
  const timeline = (data.events ?? []).filter((event) => event.audience !== 'control' && ['approval', 'execute', 'patch_stage', 'heal', 'rollback', 'reattack'].includes(event.kind));
  const visible = timeline.slice(-12).reverse();
  const steps = remediationSteps(data.events ?? []);
  const done = steps.filter((step) => step.state === 'done').length;
  return (
    <Panel title="Remediation progress" icon={ListChecks} right={<span className="ops-progress" aria-label={`${done} of ${steps.length} steps done`}><span className="ops-progress__bar"><span style={{ transform: `scaleX(${done / steps.length})` }} /></span><span className="mono">{done} / {steps.length}</span></span>}>
      <ol className="ops-steps">
        {steps.map((step) => {
          const view = STEP_VIEW[step.state];
          const Icon = step.state === 'done' ? Check : step.state === 'failed' ? X : step.state === 'current' ? Loader2 : undefined;
          return <li key={step.id} data-state={step.state}>
            <span className="ops-steps__mark" aria-hidden>{Icon && <Icon size={12} strokeWidth={2.5} className={step.state === 'current' ? 'sh-spin' : undefined} />}</span>
            <span className="ops-steps__label"><strong>{step.label}</strong>{step.detail && <small>{step.detail}</small>}</span>
            <span className="ops-steps__state" data-tone={view.tone}>{view.word}{step.at && step.state !== 'pending' ? <time className="mono"> · {simClockIST(step.at)}</time> : null}</span>
          </li>;
        })}
      </ol>
      {!visible.length ? null : (
        <details className="ops-log"><summary>Event log ({timeline.length}) · IST simulation time</summary>
        <ol className="ops-timeline">
          {visible.map((event) => {
            const info = description(event);
            const diff = diffFor(event);
            return (
              <li key={`${event.seq}-${event.kind}`}>
                <time className="mono">{simClockIST(event.ts)} IST</time>
                <div><strong>{info.label}</strong>{info.detail && <p>{info.detail}</p>}{diff && <details><summary>Emulated config diff</summary><pre>{redactDiff(diff)}</pre></details>}</div>
                <StatusBadge tone={info.tone} word={info.word} size="sm" />
              </li>
            );
          })}
        </ol>
        {timeline.length > visible.length && <p className="ops-subtle">Showing the latest {visible.length} events of {timeline.length}.</p>}
        </details>
      )}
    </Panel>
  );
}

export function PolicyEvidence({ data, catalogue }: { data: DeriveInput; catalogue: Catalogue }) {
  const { search } = useLocation();
  const byId = new Map(catalogue.records.map((record) => [record.id, record]));
  const seen = new Set<string>();
  const verdicts = [...(data.verdicts ?? [])].reverse().filter((event) => {
    if (event.audience === 'control' || !VERDICTS.has(String(event.verdict))) return false;
    const key = JSON.stringify([event.verdict, event.rule ?? event.rule_id, [...new Set([...strings(event.records), ...strings(event.record_ids)])].sort()]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
  const gaps = openGaps(data);
  return (
    <Panel title="Policy evidence" icon={Scale} right={<Link className="ops-link" to={{ pathname: '/policy', search }}>View evidence</Link>}>
      {!verdicts.length ? <Empty>No rule-engine verdict has been received.</Empty> : (
        <ul className="ops-verdicts">
          {verdicts.map((verdict) => {
            const value = String(verdict.verdict);
            const tone: Tone = value === 'COMPLIANT' ? 'ok' : value === 'VIOLATION' || value === 'CONFLICT' ? 'critical' : 'warn';
            const ids = [...new Set([...strings(verdict.records), ...strings(verdict.record_ids)])];
            return <li key={verdict.seq}>
              <StatusBadge tone={tone} word={value} size="sm" />
              <div><strong>{text(verdict.rule) ?? text(verdict.rule_id) ?? 'Rule ID unavailable'}</strong>
                <div className="ops-record-list">{ids.length ? <>
                  <span className="ops-record-ids">{ids.map((id) => <code key={id} title={byId.get(id)?.instrument}>{id}</code>)}</span>
                  {[...new Set(ids.map((id) => byId.get(id)?.instrument).filter(Boolean))].map((instrument) => <span key={instrument}>{instrument}</span>)}
                </> : 'Record IDs unavailable'}</div>
              </div>
            </li>;
          })}
        </ul>
      )}
      <p className="ops-policy-foot">{gaps.length ? `${gaps.length} policy ${gaps.length === 1 ? 'gap' : 'gaps'} raised` : 'No gap event received yet'}</p>
      {catalogue.error && <p className="ops-subtle">Record titles unavailable: {catalogue.error}</p>}
    </Panel>
  );
}

export function TopEvidence({ data }: { data: DeriveInput }) {
  const alerts = (data.alerts ?? []).filter((event) => event.audience !== 'control').slice(-2).reverse();
  const m3 = models(data).find((model) => model.id === 'M3');
  const features = featurePairs(m3?.event?.top_features).slice(0, 4);
  return (
    <Panel title="Observed evidence" icon={FileSearch}>
      {!alerts.length && !features.length ? <Empty>No alert or model evidence has been reported.</Empty> : (
        <ul className="ops-evidence">
          {alerts.map((alert) => <li key={alert.seq}><AlertCircle size={14} /><span><strong>{text(alert.label) ?? 'Alert'}</strong>{text(alert.site) && ` at ${alert.site}`}<small>{text(alert.text) ?? text(alert.id)}</small></span></li>)}
          {features.map((feature) => <li key={feature.name}><span className="ops-evidence__icon">•</span><span>{feature.name}<small>Observed model input: {feature.value}</small></span></li>)}
        </ul>
      )}
    </Panel>
  );
}
