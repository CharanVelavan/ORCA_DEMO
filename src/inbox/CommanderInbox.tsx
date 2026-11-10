import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLiveStore } from '../store';
import type { LiveEvent } from '../types';
import { ApprovalCard } from './ApprovalCard';
import { GapCard } from './GapCard';
import { AgentsSaying, WarRoomLog } from './WarRoomLog';
import { Chip } from './parts';
import { istTime, mergeApprovals } from './format';
import { useSimNow } from './simClock';
import './inbox.css';

const WORD: Record<string, string> = { approved: 'Approved', rejected: 'Rejected', auto: 'Auto-approved', expired: 'Expired' };

/** Commander inbox: decisions on the left, what the agents are saying on the right. Fills its parent. */
export function CommanderInbox() {
  const approvals = useLiveStore((s) => s.approvals), verdicts = useLiveStore((s) => s.verdicts), gapEvents = useLiveStore((s) => s.gaps);
  const obligations = useLiveStore((s) => s.obligations), raw = useLiveStore((s) => s.raw);
  const now = useSimNow();
  const [full, setFull] = useState(false);

  const merged = useMemo(() => mergeApprovals(approvals), [approvals]);
  const open = merged.filter((a) => a.status === 'requested' && !(Date.parse(a.expires_at) <= now));
  const resolved = merged.filter((a) => !open.includes(a)).slice(-4).reverse();

  const gaps = useMemo(() => {
    const byId = new Map<string, LiveEvent>();
    for (const g of gapEvents) byId.set(String(g.gap_id), g);
    for (const v of verdicts) if (v.gap_id) byId.set(String(v.gap_id), v);
    return [...byId.values()];
  }, [verdicts, gapEvents]);
  const decidedIds = new Set(raw.filter((e) => e.kind === 'gap_human_decision').map((e) => String(e.draft_id ?? e.gap_id)));
  const gapsWaiting = gaps.filter((g) => !decidedIds.has(String(g.gap_id)));
  const waiting = open.length + gapsWaiting.length;
  const clocks = obligations.filter((o) => String(o.status ?? 'open') === 'open').length;

  return (
    <div className="inbox-root">
      <header className="inbox-head">
        <h2 className="inbox-head__title">Commander inbox</h2>
        <div className="inbox-head__counts">
          <Chip tone={waiting ? 'warn' : 'unknown'}><span className="mono inbox-big">{waiting}</span> decisions waiting</Chip>
          <Chip tone={clocks ? 'accent' : 'unknown'}><span className="mono inbox-big">{clocks}</span> reporting clocks</Chip>
        </div>
      </header>
      <div className="inbox-grid">
        <div className="inbox-col inbox-col--decide">
          <h3 className="inbox-col__title">Decisions for the commander</h3>
          {waiting === 0 && <p className="inbox-empty">No decisions waiting. Agents are monitoring the emulated network.</p>}
          <AnimatePresence initial={false}>
            {open.map((a) => <ApprovalCard key={a.hash} approval={a} />)}
          </AnimatePresence>
          {gapsWaiting.length > 0 && (
            <>
              <h3 className="inbox-col__title">Candidate policy gaps</h3>
              <AnimatePresence initial={false}>
                {gapsWaiting.map((g) => <GapCard key={String(g.gap_id)} gap={g} />)}
              </AnimatePresence>
            </>
          )}
          {resolved.length > 0 && (
            <ul className="inbox-done" aria-label="Resolved decisions">
              {resolved.map((a) => {
                const by = String(a.actor ?? '').replace(/^human:/, '') || 'system';
                const line = `${WORD[a.status] ?? a.status} ${a.playbook} at ${istTime(a.resolved_at || a.requested_at).slice(0, 5)} by ${by}`;
                return <li key={a.hash} className={`inbox-done__row inbox-done__row--${a.status}`} title={line}>{line}</li>;
              })}
            </ul>
          )}
        </div>
        <div className="inbox-col inbox-col--log">
          <div className="inbox-say__head">
            <h3 className="inbox-col__title">{full ? 'Full log' : 'What the agents are saying'}</h3>
            <button type="button" className="inbox-link" aria-pressed={full} onClick={() => setFull((f) => !f)}>{full ? 'Brief' : 'Full log'}</button>
          </div>
          {full ? <WarRoomLog /> : <AgentsSaying limit={6} />}
        </div>
      </div>
    </div>
  );
}
