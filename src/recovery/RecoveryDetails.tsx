import { useState } from 'react';
import { ClipboardList, GitCompareArrows, RotateCcw, Shield, ShieldCheck } from 'lucide-react';
import { SITE_STATE, type DeriveInput, type SiteStateName } from '../derive';
import { finite, minuteDuration, object, objects, reportingClocks, text, timeIST } from '../policy/data';
import { Code, Empty, Panel, StatusBadge } from '../shell';
import type { LiveEvent } from '../types';
import { latestRollout, measurementSummary, recoveryChecks, rollbackPlaybook, siteMeasurements } from './data';

const publicEvents = (data: DeriveInput) => (data.events ?? []).filter((event) => event.audience !== 'control');
const value = (amount: number | undefined, unit: string) => amount === undefined ? 'Unavailable' : `${amount.toFixed(unit === '%' ? 1 : 2)} ${unit}`;

export function ServiceSummary({ data }: { data: DeriveInput }) {
  const rows = measurementSummary(data);
  return <Panel title="Service delivery summary" icon={ClipboardList} right={<span className="recovery-muted">Emulated measurements</span>}>
    {!rows.length ? <Empty>Service measurements are unavailable.</Empty> : <>
      <p className="recovery-caption">Current demand coverage, observed minimum and cumulative demand coverage are distinct measures.</p>
      <div className="recovery-table-wrap" role="region" aria-label="Service delivery table" tabIndex={0}>
        <table className="recovery-table">
          <thead><tr><th scope="col">Service</th><th scope="col">Delivered now</th><th scope="col">Demand now</th><th scope="col">Coverage now</th><th scope="col">Minimum observed</th><th scope="col">Cumulative coverage</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><th scope="row">{row.label}</th><td>{value(row.delivered, 'Mbps')}</td><td>{value(row.demand, 'Mbps')}</td><td>{value(row.pct, '%')}</td><td>{value(row.minPct, '%')}</td><td>{value(row.cumulativePct, '%')}</td></tr>)}</tbody>
        </table>
      </div>
    </>}
  </Panel>;
}

export function SiteSummary({ data }: { data: DeriveInput }) {
  const rows = siteMeasurements(data);
  return <Panel title="Site delivery" right={<span className="recovery-muted">Latest tick.sites snapshot, emulated</span>}>
    {!rows.length ? <Empty>Per-site delivery measurements are unavailable.</Empty> : (
      <div className="recovery-table-wrap" role="region" aria-label="Site delivery table" tabIndex={0}>
        <table className="recovery-table recovery-table--sites">
          <thead><tr>
            <th scope="col">Site</th><th scope="col">State</th><th scope="col">Delivered</th>
            <th scope="col">Demand</th><th scope="col">Capacity</th><th scope="col">Active path</th><th scope="col">Gateway</th>
          </tr></thead>
          <tbody>{rows.map((row) => {
            const state = row.state && Object.hasOwn(SITE_STATE, row.state)
              ? SITE_STATE[row.state as SiteStateName]
              : SITE_STATE.unknown;
            return <tr key={row.id}>
              <th scope="row"><Code>{row.id}</Code></th>
              <td><StatusBadge tone={state.tone} word={state.word} size="sm" /></td>
              <td>{value(row.delivered, 'Mbps')}</td>
              <td>{value(row.demand, 'Mbps')}</td>
              <td>{value(row.capacity, 'Mbps')}</td>
              <td>{row.activePath ?? 'Unavailable'}</td>
              <td>{row.gateway ?? 'Unavailable'}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    )}
  </Panel>;
}

export function NotificationComparison({ data }: { data: DeriveInput }) {
  const clocks = reportingClocks(data);
  return <Panel title="Notification against each reporting window" icon={ClipboardList}>
    {!clocks.length ? <Empty>No reporting clocks raised yet. Notification timing is unavailable.</Empty> : (
      <div className="recovery-table-wrap" role="region" aria-label="Notification comparison table" tabIndex={0}>
        <table className="recovery-table">
          <thead><tr><th scope="col">Rule / record</th><th scope="col">Trigger</th><th scope="col">Window</th><th scope="col">Notified</th><th scope="col">Elapsed</th><th scope="col">Outcome</th></tr></thead>
          <tbody>{clocks.map((clock) => <tr key={`${clock.regime}-${clock.event.seq}`}>
            <th scope="row">{clock.regime}<div className="recovery-ids">{clock.recordIds.length ? clock.recordIds.map((id) => <Code key={id}>{id}</Code>) : 'Record id unavailable'}</div></th>
            <td>{clock.trigger ?? 'Unavailable'}</td>
            <td>{minuteDuration(clock.windowMin)}</td>
            <td>{timeIST(clock.notifiedAt)}</td>
            <td>{clock.notifiedBeforeStart ? 'Before trigger' : minuteDuration(clock.notifyMin)}</td>
            <td><StatusBadge tone={clock.status === 'met' ? 'ok' : clock.status === 'missed' || clock.status === 'overdue' ? 'critical' : clock.status === 'open' ? 'warn' : 'unknown'} word={clock.status === 'overdue' ? 'Overdue; notification unobserved' : clock.status} size="sm" /></td>
          </tr>)}</tbody>
        </table>
      </div>
    )}
  </Panel>;
}

export function RolloutAndRollback({ data }: { data: DeriveInput }) {
  const rollout = latestRollout(data);
  const events = publicEvents(data);
  const history = events.filter((event) => event.kind === 'patch_stage');
  const rollbacks = events.filter((event) => event.kind === 'rollback');
  const rollbackOk = object(data.summary?.timings).rollback_ok;
  return <Panel title="Staged rollout and rollback" icon={RotateCcw}>
    {rollout.playbook ? <p className="recovery-caption">Latest recorded rollout: <Code>{rollout.playbook}</Code>
      {rollout.attempts > 1 ? ` / attempt ${rollout.attempt} of ${rollout.attempts}` : ''}
      {rollout.earlierFailed ? ` / ${rollout.earlierFailed} earlier attempt${rollout.earlierFailed > 1 ? 's' : ''} failed a health check` : ''}
      {rollout.rolledBack ? ' / subsequently rolled back' : ''}</p>
      : <p className="recovery-caption">No rollout stage has been emitted.</p>}
    <div className="recovery-stages">
      {rollout.stages.map(({ pct, event }) => {
        const health = text(event?.health);
        const tone = health === 'ok' ? 'ok' : health === 'fail' ? 'critical' : 'unknown';
        const word = health === 'ok' ? 'Health passed' : health === 'fail' ? 'Health failed' : 'Not observed';
        return <div className="recovery-stage" key={pct}>
          <strong>{pct}%</strong><StatusBadge tone={tone} word={word} size="sm" />
          <small>{event ? timeIST(event.ts) : 'Time unavailable'}</small>
        </div>;
      })}
    </div>
    {history.length > 0 && <details className="recovery-details">
      <summary>All recorded stage checks ({history.length})</summary>
      <ul>{history.map((event) => <li key={event.seq}>{timeIST(event.ts)} / {text(event.playbook) ?? 'Playbook unavailable'} / {finite(event.pct) === undefined ? 'Stage unavailable' : `${finite(event.pct)}%`} / {text(event.health) ?? 'Health unavailable'}</li>)}</ul>
    </details>}
    <div className="recovery-section-divider">
      <div className="recovery-section-title">
        <strong>Rollback outcome</strong>
        <StatusBadge tone={rollbackOk === true ? 'ok' : rollbackOk === false ? 'critical' : 'unknown'} word={rollbackOk === true ? 'Reverted' : rollbackOk === false ? 'Not verified' : 'Unavailable'} size="sm" />
      </div>
      {!rollbacks.length ? <p className="recovery-muted">No rollback event has been recorded.</p> : rollbacks.map((event) => <details className="recovery-details" key={event.seq}>
        <summary>{timeIST(event.ts)} / {rollbackPlaybook(event, events) ?? 'Playbook unavailable'} / {text(event.why) ?? 'Reason unavailable'}</summary>
        {text(event.hash) && <p><Code>{text(event.hash)}</Code></p>}
        {text(event.revert_diff) ? <DiffLines value={String(event.revert_diff)} /> : <p className="recovery-muted">Revert diff unavailable.</p>}
      </details>)}
    </div>
  </Panel>;
}

export function ConfigDiff({ data }: { data: DeriveInput }) {
  const executions = publicEvents(data).filter((event) => event.kind === 'execute');
  const [selected, setSelected] = useState<number | null>(null);
  const execution = executions.find((event) => event.seq === selected) ?? executions.at(-1);
  const list = execution ? objects(execution.diffs) : [];
  const single = object(execution?.diff);
  const diffs = list.length ? list : Object.keys(single).length ? [single] : [];
  return <Panel title="Emulated configuration changes" icon={GitCompareArrows}>
    {!executions.length ? <Empty>No playbook execution has been recorded.</Empty> : <>
      <label className="recovery-select">
        Execution
        <select value={execution?.seq ?? ''} onChange={(event) => setSelected(Number(event.target.value))}>
          {executions.slice().reverse().map((event) => <option value={event.seq} key={event.seq}>{text(event.playbook) ?? 'Playbook unavailable'} / {timeIST(event.ts)} / {text(event.result) ?? 'Result unavailable'}</option>)}
        </select>
      </label>
      {execution && <p className="recovery-muted">Result: {text(execution.result) ?? 'Unavailable'}{text(execution.why) ? ` / ${text(execution.why)}` : ''}</p>}
      {!diffs.length ? <Empty>Before/after configuration evidence is unavailable for this execution.</Empty> : diffs.map((diff, index) => {
        const unified = typeof diff.unified === 'string' ? diff.unified : undefined;
        const before = typeof diff.before === 'string' ? diff.before : undefined;
        const after = typeof diff.after === 'string' ? diff.after : undefined;
        return <article className="recovery-diff" key={`${text(diff.target) ?? 'target'}-${index}`}>
          <strong>{text(diff.target) ?? 'Target unavailable'}</strong>
          {unified ? <DiffLines value={unified} /> : unified === '' ? <p className="recovery-muted">No changed lines were recorded.</p> : null}
          <details className="recovery-details" open={unified === undefined}>
            <summary>Before and after configuration</summary>
            <div className="recovery-before-after">
              <div><strong>Before</strong><pre>{before ?? 'Unavailable'}</pre></div>
              <div><strong>After</strong><pre>{after ?? 'Unavailable'}</pre></div>
            </div>
          </details>
        </article>;
      })}
    </>}
  </Panel>;
}

function DiffLines({ value: diff }: { value: string }) {
  return <pre className="recovery-diff-code" aria-label="Configuration diff">{diff.split('\n').map((line, index) => {
    const type = line.startsWith('+++') || line.startsWith('---') ? 'meta' : line.startsWith('+') ? 'add' : line.startsWith('-') ? 'remove' : 'context';
    return <span className={`recovery-diff-line recovery-diff-line--${type}`} key={index}>{line || ' '}{'\n'}</span>;
  })}</pre>;
}

export function ValidationChecks({ data }: { data: DeriveInput }) {
  const checks = recoveryChecks(data);
  const events = publicEvents(data);
  const reattacks = events.filter((event) => event.kind === 'reattack');
  const heals = events.filter((event) => event.kind === 'heal');
  return <Panel title="Validation and evidence" icon={ShieldCheck}>
    <div className="recovery-checks">
      {checks.map((check) => <div className="recovery-check" key={check.label}>
        <div><strong>{check.label}</strong><p>{check.detail}</p></div>
        <StatusBadge tone={check.status === 'pass' ? 'ok' : check.status === 'fail' ? 'critical' : 'unknown'} word={check.status === 'pass' ? 'Observed pass' : check.status === 'fail' ? 'Observed fail' : 'Unavailable'} size="sm" />
      </div>)}
    </div>
    <div className="recovery-section-divider">
      <div className="recovery-section-title"><strong>Re-attack checks</strong><Shield size={15} aria-hidden="true" /></div>
      {!reattacks.length ? <p className="recovery-muted">No re-attack result has been emitted.</p> : <ul className="recovery-evidence-list">
        {reattacks.map((event) => <li key={event.seq}>
          <div><strong>{text(event.attack) ?? 'Attack unavailable'}</strong> / {text(event.target) ?? 'Target unavailable'}<small>{timeIST(event.ts)} / {text(event.playbook) ?? 'Playbook unavailable'}{text(event.blocked_by) ? ` / ${text(event.blocked_by)}` : ''}</small></div>
          <StatusBadge tone={event.blocked === true ? 'ok' : event.blocked === false ? 'critical' : 'unknown'} word={event.blocked === true ? 'Blocked' : event.blocked === false ? 'Not blocked' : 'Unavailable'} size="sm" />
        </li>)}
      </ul>}
    </div>
    <div className="recovery-section-divider">
      <strong>Emulated path checks</strong>
      {!heals.length ? <p className="recovery-muted">No clean-path check has been emitted.</p> : heals.map((heal) => {
        const check = object(heal.check);
        const details = objects(check.checks);
        return <details className="recovery-details" key={heal.seq}>
          <summary>{text(heal.site) ?? 'Site unavailable'} / {text(heal.from_path) ?? 'Path unavailable'} to {text(heal.to_path) ?? 'Path unavailable'} / {timeIST(heal.ts)}</summary>
          {!details.length ? <p className="recovery-muted">Individual path checks are unavailable.</p> : <ul className="recovery-evidence-list">
            {details.map((item, index) => <li key={index}><div>{text(item.check) ?? 'Check unavailable'}{text(item.why) && <small>{text(item.why)}</small>}</div>
              <StatusBadge tone={item.ok === true ? 'ok' : item.ok === false ? 'critical' : 'unknown'} word={item.ok === true ? 'Passed' : item.ok === false ? 'Failed' : 'Unavailable'} size="sm" />
            </li>)}
          </ul>}
        </details>;
      })}
    </div>
  </Panel>;
}
