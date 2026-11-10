import { useState, type KeyboardEvent } from 'react';
import { BookOpen, FileSearch, Globe2, ListChecks, Scale, Sparkles } from 'lucide-react';
import type { DeriveInput } from '../derive';
import { GapCard } from '../inbox/GapCard';
import { Code, Empty, Panel, StatusBadge } from '../shell';
import type { LiveEvent } from '../types';
import {
  actualVerdicts, object, objects, recommendationText, recordBinding, recordIdsForGap,
  recordInForce, roleLabel, strings, text, VERDICTS, verdictTone,
  timeIST, type CatalogueGap, type PolicyCatalogue, type RecordInfo,
} from './data';

type Tab = 'india' | 'global' | 'comparison' | 'gaps' | 'recommendation';
const TABS: { id: Tab; label: string; icon: typeof Scale }[] = [
  { id: 'india', label: 'Active KB regulations', icon: Scale },
  { id: 'global', label: 'Global references', icon: Globe2 },
  { id: 'comparison', label: 'Country comparison', icon: BookOpen },
  { id: 'gaps', label: 'Policy gaps', icon: FileSearch },
  { id: 'recommendation', label: 'Recommendation', icon: Sparkles },
];

export function PolicyWorkspace({ catalogue, error, data }: { catalogue: PolicyCatalogue | null; error: string | null; data: DeriveInput }) {
  const [tab, setTab] = useState<Tab>('india');
  const gaps = (data.gaps ?? []).filter((gap) => gap.audience !== 'control');
  const active = data.session?.kb === 'eu' ? 'EU' : data.session?.kb === 'india' ? 'IN' : undefined;
  const activeName = active === 'EU' ? 'EU' : active === 'IN' ? 'Indian' : 'Active KB';
  const activeRecords = catalogue?.records.filter((record) => record.jurisdiction === active) ?? [];
  const global = catalogue?.records.filter((record) => record.jurisdiction && record.jurisdiction !== active) ?? [];
  const tabLabel = (id: Tab, label: string) => id === 'india' ? `${activeName} regulations` : label;
  const count = (id: Tab) => id === 'india' ? active && catalogue ? activeRecords.length : null : id === 'global' ? catalogue && global.length : id === 'gaps' ? gaps.length : null;
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1
      : (index + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    document.getElementById(`policy-tab-${TABS[next].id}`)?.focus();
  };
  return (
    <>
      <Panel title="Regulatory context and evidence" icon={Scale} pad={false}>
        <div className="policy-workspace">
          <div className="policy-tabs" role="tablist" aria-label="Policy evidence" aria-orientation="vertical">
            {TABS.map(({ id, label, icon: Icon }, index) => (
              <button
                type="button" role="tab" id={`policy-tab-${id}`} aria-selected={tab === id}
                aria-controls="policy-tab-panel" tabIndex={tab === id ? 0 : -1}
                className={`policy-tab${tab === id ? ' is-selected' : ''}`} key={id}
                onClick={() => setTab(id)} onKeyDown={(event) => onTabKey(event, index)}
              >
                <Icon size={16} aria-hidden="true" /><span>{tabLabel(id, label)}</span>
                {count(id) !== null && <span className="policy-tab__count">{count(id)}</span>}
              </button>
            ))}
          </div>
          <div className="policy-tab-panel" id="policy-tab-panel" role="tabpanel" aria-labelledby={`policy-tab-${tab}`}>
            {error && <p className="policy-error" role="alert">{error}</p>}
            {!catalogue && !error && <p className="policy-muted" role="status">Loading the policy catalogue.</p>}
            {tab === 'india' && catalogue && (active
              ? <RecordTable records={activeRecords} title={`${activeName} records (active knowledge base)`} />
              : <Empty>No active knowledge base is reported by the session.</Empty>)}
            {tab === 'global' && catalogue && <RecordTable records={global} title="Reference records from other jurisdictions" />}
            {tab === 'comparison' && catalogue && <CountryComparison gaps={gaps} register={catalogue.gaps} />}
            {tab === 'gaps' && <GapList gaps={gaps} expanded />}
            {tab === 'recommendation' && <Recommendations data={data} gaps={gaps} />}
          </div>
        </div>
      </Panel>
      {tab !== 'gaps' && (
        <Panel title="Candidate policy gaps" icon={FileSearch} right={<span className="policy-muted">Raised by the rule engine</span>}>
          <GapList gaps={gaps} />
        </Panel>
      )}
      <VerdictPanel verdicts={data.verdicts ?? []} rules={data.session?.rules} />
    </>
  );
}

function RecordTable({ records, title }: { records: RecordInfo[]; title: string }) {
  if (!records.length) return <Empty>No records were returned for this catalogue view.</Empty>;
  return (
    <>
      <div className="policy-section-head">
        <div><h2>{title}</h2><p>Topics are catalogue metadata, not legal applicability determinations.</p></div>
        <span className="policy-muted">{records.length} records</span>
      </div>
      <div className="policy-table-wrap policy-table-wrap--records" role="region" aria-label={`${title} catalogue table`} tabIndex={0}>
        <table className="policy-table policy-table--records">
          <thead><tr><th scope="col">Instrument / authority</th><th scope="col">Topic</th><th scope="col">Binding / in force</th><th scope="col">Citation / tier</th></tr></thead>
          <tbody>
            {records.map((record) => {
              const binding = recordBinding(record);
              return (
                <tr key={record.id}>
                  <td><strong>{record.instrument ?? 'Instrument unavailable'}</strong><small>{record.authority ?? 'Authority unavailable'}</small></td>
                  <td>{record.topic?.replace(/_/g, ' ') ?? 'Unavailable'}</td>
                  <td><StatusBadge tone={binding.tone} word={binding.word} size="sm" /><small>{recordInForce(record)}</small></td>
                  <td><Code>{record.id}</Code><small>{record.pinpoint ?? record.clause ?? 'Pinpoint unavailable'}</small><small>{record.verified === true ? 'Verified record' : record.verified === false ? 'Unverified record' : 'Verification unavailable'}</small></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CountryComparison({ gaps, register }: { gaps: LiveEvent[]; register: CatalogueGap[] }) {
  const entries: Record<string, unknown>[] = gaps.length ? gaps : register;
  if (!entries.length) return <Empty>No comparison records are available in the catalogue.</Empty>;
  return (
    <div className="policy-comparisons">
      <div className="policy-section-head">
        <div><h2>Active knowledge base and global examples</h2><p>{gaps.length ? 'Examples attached to gaps raised in this session.' : 'Register references only. No current gap assessment has been raised.'}</p></div>
      </div>
      {entries.map((gap) => {
        const id = text(gap.gap_id) ?? text(gap.id) ?? 'Id unavailable';
        const examples = objects(gap.global_examples);
        const evidence = recordIdsForGap(gap);
        return (
          <details className="policy-comparison" key={id} open={entries.length === 1 || undefined}>
            <summary><Code>{id}</Code><strong>{text(gap.title) ?? text(gap.topic) ?? 'Gap title unavailable'}</strong></summary>
            <div className="policy-comparison__body">
              <div><strong>Cited records</strong><div className="policy-records">{evidence.length ? evidence.map((record) => <Code key={record}>{record}</Code>) : <span className="policy-muted">Record ids unavailable</span>}</div></div>
              <div><strong>Global examples</strong>
                {!examples.length ? <p className="policy-muted">No example was supplied for this gap.</p> : (
                  <ul className="policy-example-list">{examples.map((example, index) => {
                    const ref = text(example.record) ?? text(example.staged);
                    return <li key={`${ref ?? 'example'}-${index}`}>
                      <strong>{text(example.jurisdiction) ?? 'Jurisdiction unavailable'}</strong>
                      {' / '}{text(example.instrument) ?? 'Instrument unavailable'}
                      {text(example.clause) && <> / {text(example.clause)}</>}
                      <small>{text(example.tier) ?? 'Tier unavailable'}{text(example.binding_status) ? ` / ${text(example.binding_status)}` : ''}{ref ? ` / ${ref}` : ''}</small>
                      {text(example.shows) && <p>{text(example.shows)}</p>}
                    </li>;
                  })}</ul>
                )}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}

function GapList({ gaps, expanded = false }: { gaps: LiveEvent[]; expanded?: boolean }) {
  if (!gaps.length) return <Empty>No gap raised yet. The absence of a gap event is not a finding that policy is adequate.</Empty>;
  return <div className="policy-gap-list">{gaps.map((gap, index) =>
    <GapCard key={String(gap.gap_id ?? gap.seq)} gap={gap} defaultExpanded={expanded || index === 0} />
  )}</div>;
}

function Recommendations({ data, gaps }: { data: DeriveInput; gaps: LiveEvent[] }) {
  const drafts = (data.events ?? []).filter((event) => event.audience !== 'control' && event.kind === 'agent_final'
    && (event.role === 'policy_adviser' || event.role === 'gap_analyst') && text(event.text)).slice(-3).reverse();
  return (
    <div className="policy-recommendations">
      <div className="policy-section-head"><div><h2>Recommendations and human review</h2><p>Agents can explain citations and prepare drafts. A human interprets ambiguity and confirms or rejects a gap.</p></div></div>
      {gaps.map((gap) => {
        const recommendation = recommendationText(gap.recommendation);
        if (!recommendation) return null;
        const regulators = strings(object(gap.recommendation).regulator);
        return <article className="policy-recommendation" key={String(gap.gap_id ?? gap.seq)}>
          <Code>{text(gap.gap_id) ?? 'Id unavailable'}</Code>
          <strong>KB recommendation for human review</strong>
          <p>{recommendation}</p>
          {regulators.length > 0 && <small>Addressed to: {regulators.join(', ')}</small>}
        </article>;
      })}
      {!gaps.some((gap) => recommendationText(gap.recommendation)) && <Empty>No recommendation has been emitted for a current gap.</Empty>}
      {drafts.length > 0 && <div className="policy-drafts">
        {drafts.map((draft) => <article key={draft.seq}>
          <strong>Draft by {roleLabel(draft.role) ?? 'agent'}</strong>
          <p>{text(draft.text)}</p>
          <div className="policy-records">{strings(draft.citations).map((id) => <Code key={id}>{id}</Code>)}</div>
        </article>)}
      </div>}
    </div>
  );
}

function VerdictPanel({ verdicts, rules }: { verdicts: LiveEvent[]; rules: unknown }) {
  const actual = actualVerdicts(verdicts).slice().reverse();
  return (
    <Panel title="Rule engine verdicts" icon={ListChecks} right={<span className="policy-muted">{rules === true ? 'Rule engine active' : rules === false ? 'Rules off' : 'Rule engine status unavailable'}</span>}>
      <p className="policy-muted">Each explanation is an immutable evaluation. Its timing may differ from the current reporting countdown.</p><p className="policy-muted">Verdict vocabulary</p>
      <div className="policy-verdict-legend">{VERDICTS.map((verdict) => <StatusBadge key={verdict} tone={verdictTone(verdict)} word={verdict} size="sm" />)}</div>
      {!actual.length ? <Empty>No rule verdict emitted yet.</Empty> : (
        <div className="policy-verdicts">
          {actual.map((event) => {
            const records = [...new Set([...strings(event.records), ...strings(event.record_ids)])];
            return <article className="policy-verdict" key={event.seq}>
              <div className="policy-verdict__top">
                <StatusBadge tone={verdictTone(event.verdict)} word={String(event.verdict)} size="sm" />
                <Code>{text(event.rule) ?? text(event.rule_id) ?? 'Rule id unavailable'}</Code><span className="policy-muted">Evaluated {timeIST(event.ts)}</span>
              </div>
              {text(event.explanation) && <p>{text(event.explanation)}</p>}
              <div className="policy-records">{records.length ? records.map((id) => <Code key={id}>{id}</Code>) : <span className="policy-muted">Record ids unavailable. This event is not fully evidenced.</span>}</div>
            </article>;
          })}
        </div>
      )}
    </Panel>
  );
}
