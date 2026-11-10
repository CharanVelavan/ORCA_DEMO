import { FileJson, Fingerprint, Link2, ShieldCheck, ShieldQuestion, ShieldX } from 'lucide-react';
import { actorLabel, hashState, summarize, type AuditEntry } from './audit';
import type { AuditChain } from '../types';

function printable(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(printable).join(', ');
  return value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'Not recorded');
}

function references(payload: Record<string, unknown>) {
  const output = new Map<string, string>();
  const collect = (object: Record<string, unknown>) => {
    for (const field of ['record_ids', 'records', 'citations', 'citations_accepted', 'sources']) {
      const value = object[field];
      if (!Array.isArray(value)) continue;
      value.forEach(item => {
        if (typeof item === 'string' && item.trim()) output.set(item, field);
        else if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          const id = record.record_id ?? record.chunk_id ?? record.source_id ?? record.id;
          if (typeof id === 'string' && id.trim()) output.set(id, field);
        }
      });
    }
  };
  collect(payload);
  if (payload.result && typeof payload.result === 'object' && !Array.isArray(payload.result)) collect(payload.result as Record<string, unknown>);
  return [...output].map(([id, field]) => ({ id, field }));
}

export function eventTitle(entry: AuditEntry) {
  return entry.kind.replace(/_/g, ' ').replace(/^./, value => value.toUpperCase());
}

export function eventTime(ts?: string) {
  if (!ts || !Number.isFinite(Date.parse(ts))) return 'Timestamp not recorded';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(ts)) + ' IST';
}

export function ChainStatus({ chain }: { chain?: AuditChain | null }) {
  const Icon = chain?.ok === true ? ShieldCheck : chain?.ok === false ? ShieldX : ShieldQuestion;
  return <span className={`au-chain-status au-chain-status--${chain?.ok === true ? 'ok' : chain?.ok === false ? 'broken' : 'unknown'}`}><Icon size={14} />{chain?.ok === true ? 'Verified' : chain?.ok === false ? `Broken at ${chain.bad_seq ?? 'unknown entry'}` : 'Unverified'}</span>;
}

export function AuditInspector({ entry, chain, omitted, chainOpen, setChainOpen }: {
  entry?: AuditEntry; chain?: AuditChain | null; omitted: number; chainOpen: boolean; setChainOpen: (open: boolean) => void;
}) {
  const citations = entry ? references(entry.payload) : [];
  const p = entry?.payload ?? {};
  const rowState = entry ? hashState(entry, chain) : 'unknown';
  const explanation = ['explanation', 'rationale', 'detail', 'reason', 'text', 'task'].map(key => p[key]).find(value => typeof value === 'string' && value.trim());
  const scope = p.scope ?? p.targets ?? p.target ?? p.site ?? p.sites;
  const metadata = [['Actor', entry ? actorLabel(entry.actor) : 'Not recorded'], ['Scope', scope === undefined ? 'Not recorded' : printable(scope)], ...['playbook', 'tool', 'rule_id', 'verdict'].filter(key => p[key] !== undefined).map(key => [key.replace('_', ' '), printable(p[key])])];
  const raw = entry ? JSON.stringify({ seq: entry.seq, ts: entry.ts, actor: entry.actor, kind: entry.kind, payload: entry.payload, hash: entry.hash, prev_hash: entry.prev_hash }, null, 2) : '';
  return <section className="au-region au-inspector" aria-labelledby="audit-inspector-title">
    <header className="au-region__header"><h2 id="audit-inspector-title">{entry ? eventTitle(entry) : 'Event inspector'}</h2>{entry && <span>#{entry.seq}</span>}</header>
    <div className="au-region__scroll au-inspector__body">
      {!entry ? <div className="au-empty"><Fingerprint size={28} /><h3>Inspect recorded evidence</h3><p>Select a recording, then an event. Its timestamp, actor, citations and integrity evidence appear here.</p></div> : <>
        <p className="au-inspector__summary">{summarize(entry)}</p>
        <dl className="au-metadata"><div><dt>Timestamp</dt><dd><time dateTime={entry.ts}>{eventTime(entry.ts)}</time></dd></div>{metadata.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
        {typeof explanation === 'string' && <section className="au-inspector__section"><h3>Recorded evidence</h3><p>{explanation}</p></section>}
        <section className="au-inspector__section"><h3><Link2 size={14} />Source references <span>{citations.length}</span></h3>{citations.length ? <ul className="au-citations">{citations.map(citation => <li key={citation.id}><code>{citation.id}</code><small>{citation.field === 'citations_accepted' ? 'Accepted by the citation guard' : 'Reference recorded in this event'}</small></li>)}</ul> : <p className="au-muted">No source references recorded in this event.</p>}<p className="au-inspector__note">A recorded reference is not independent verification of its source.</p></section>
        <details className="au-inspector__details"><summary><FileJson size={15} />Raw JSON <small>read only</small></summary><pre>{raw.length > 16000 ? `${raw.slice(0, 16000)}\n… Truncated for display. Export JSONL for the full public entry.` : raw}</pre></details>
        <details className="au-inspector__details" open={chainOpen} onToggle={event => setChainOpen(event.currentTarget.open)}><summary><Link2 size={15} />Hash-chain integrity <ChainStatus chain={chain} /></summary><div className="au-integrity"><p>{chain?.note ?? 'The recording has no available chain verification.'}</p><dl><div><dt>This entry</dt><dd>{rowState === 'ok' ? 'Covered by verified chain' : rowState === 'broken' ? 'At or after the broken link' : 'Unverified'}</dd></div><div><dt>Hash</dt><dd><code>{entry.hash ?? 'Not recorded'}</code></dd></div><div><dt>Previous hash</dt><dd><code>{entry.prev_hash ?? 'Not recorded'}</code></dd></div></dl><p className="au-inspector__note">The server checks the original recording. {omitted} exercise-control entries were withheld. The public export is redacted and cannot verify the full chain.</p></div></details>
      </>}
    </div>
  </section>;
}
