import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, ChevronDown, CircleSlash, FileSearch, HelpCircle, MessageSquare, Radar, XCircle } from 'lucide-react';
import { useLiveStore } from '../store';
import type { LiveEvent } from '../types';
import { ICON } from './parts';
import type { Tone } from './parts';
import { istTime, roleName, toMs } from './format';
import { useAgentFeed } from './agentFeed';
import './inbox.css';

type Row = { key: string; at: number; seq: number; tone: Tone; icon: ReactNode; actor: ReactNode; actorKey: string; line: string; full: string; brief: boolean; count?: number; lastAt?: number };
const MAX_ROWS = 200;

const VERDICT_TONE: Record<string, { tone: Tone; Icon: typeof CheckCircle2 }> = {
  COMPLIANT: { tone: 'ok', Icon: CheckCircle2 }, VIOLATION: { tone: 'critical', Icon: AlertTriangle },
  CONFLICT: { tone: 'critical', Icon: AlertTriangle }, AMBIGUITY: { tone: 'warn', Icon: HelpCircle },
  POTENTIAL_GAP: { tone: 'healing', Icon: FileSearch }, INSUFFICIENT_EVIDENCE: { tone: 'unknown', Icon: CircleSlash },
};
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
const word = (v: string) => v.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

/** Safe text: strings and numbers only. Objects and booleans never print as "[object Object]" or "true". */
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const json = (v: unknown, max = 1200): string => {
  if (v == null) return '';
  let t: string;
  try { t = typeof v === 'string' ? v : JSON.stringify(v, null, 1); } catch { t = ''; }
  return t.length > max ? `${t.slice(0, max)} ...` : t;
};
const firstLine = (t: string) => t.split('\n').map((x) => x.trim()).find(Boolean) ?? '';

export function useLogRows(): Row[] {
  const messages = useLiveStore((s) => s.messages), verdicts = useLiveStore((s) => s.verdicts), alerts = useLiveStore((s) => s.alerts);
  const agentEvents = useAgentFeed();
  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const m of messages) {
      const e = m as Record<string, unknown>, inner = (e.message ?? {}) as Record<string, unknown>;
      const rejected = e.audit_kind === 'msg_rejected' || e.accepted === false || (e.reason != null && e.accepted !== true);
      const sender = str(e.from) || str(e.sender) || str(inner.sender) || str(e.actor);
      const to = list(e.to ?? e.recipients ?? inner.recipients);
      const type = str(e.type) || str(inner.type) || 'message';
      const text = str(e.text) || str(inner.text);
      const toText = to.map(roleName).join(', ') || 'All';
      out.push({
        key: `m-${m.seq}`, at: toMs(m.ts), seq: m.seq, tone: rejected ? 'critical' : 'accent',
        icon: rejected ? <XCircle {...ICON} /> : <MessageSquare {...ICON} />,
        actor: <>{roleName(sender)}<ArrowRight {...ICON} className="inbox-log__arrow" />{toText}</>,
        actorKey: `${sender}>${toText}`, brief: rejected,
        line: `${rejected ? 'Rejected' : word(type)}. ${rejected ? str(e.reason) || 'Refused by the protocol' : text}`,
        full: rejected ? `Rejected: ${str(e.reason)}\n\n${text}` : `${word(type)} from ${roleName(sender)}\n\n${text}`,
      });
    }
    const seenVerdict = new Set<string>();
    for (const v of verdicts) {
      const e = v as Record<string, unknown>;
      const verdict = str(e.verdict), rule = str(e.rule) || str(e.rule_id), topic = str(e.topic) || str(e.question);
      if (!verdict || (!topic && !rule)) continue;
      const k = `${verdict}|${rule || topic}`;
      if (seenVerdict.has(k)) continue;
      seenVerdict.add(k);
      const V = VERDICT_TONE[verdict] ?? { tone: 'unknown' as Tone, Icon: CircleSlash };
      const recs = list(e.records ?? e.record_ids);
      out.push({
        key: `v-${v.seq}`, at: toMs(v.ts), seq: v.seq, tone: V.tone, icon: <V.Icon {...ICON} />, actor: 'Rule engine', actorKey: 'rules',
        brief: !['COMPLIANT', 'INSUFFICIENT_EVIDENCE'].includes(verdict),
        line: `${word(verdict)}: ${topic || rule}`,
        full: `${word(verdict)} under ${rule || 'no rule id'}\nTopic: ${topic}\nKB records: ${recs.join(', ') || 'none'}\n\n${str(e.explanation)}`,
      });
    }
    for (const a of alerts) {
      const e = a as Record<string, unknown>;
      out.push({
        key: `a-${a.seq}`, at: toMs(a.ts), seq: a.seq, tone: 'warn', icon: <Radar {...ICON} />, actor: str(e.source) || 'Alert', actorKey: `alert:${str(e.source)}`, brief: true,
        line: `${str(e.site)} ${str(e.label)}`.trim(),
        full: `${str(e.source)} at ${str(e.site)}: ${str(e.label)}\n\n${str(e.text)}`,
      });
    }
    for (const ev of agentEvents) {
      const e = ev as Record<string, unknown>;
      const role = str(e.role) || str(e.actor);
      let line: string, full: string;
      if (ev.kind === 'agent_step') {
        const tool = str(e.tool);
        if (!tool) continue;
        const why = firstLine(str(e.rationale));
        line = why ? `${tool}: ${why}` : tool;
        full = [`${roleName(role)} used ${tool}${e.turn != null ? ` (turn ${str(e.turn)})` : ''}`, str(e.rationale) && `Why: ${str(e.rationale)}`,
          e.args != null && `Arguments: ${json(e.args, 600)}`, e.result != null && `Result: ${json(e.result)}`].filter(Boolean).join('\n\n');
      } else {
        const text = str(e.text);
        line = firstLine(text).slice(0, 200) || 'Finished';
        full = text || json(e) || 'Finished';
      }
      out.push({ key: `g-${ev.seq}`, at: toMs(ev.ts), seq: ev.seq, tone: 'healing', icon: <Bot {...ICON} />, actor: roleName(role), actorKey: `agent:${role}`, brief: ev.kind === 'agent_final', line, full });
    }
    out.sort((a, b) => (b.at - a.at) || (b.seq - a.seq));
    // Collapse consecutive duplicates (same actor and line, within 1 sim minute) into one row with a count.
    const merged: Row[] = [];
    for (const r of out) {
      const prev = merged[merged.length - 1];
      if (prev && prev.actorKey === r.actorKey && prev.line === r.line && Math.abs((prev.lastAt ?? prev.at) - r.at) <= 60000) {
        prev.count = (prev.count ?? 1) + 1; prev.lastAt = r.at;
      } else merged.push({ ...r, lastAt: r.at });
    }
    return merged.slice(0, MAX_ROWS);
  }, [messages, verdicts, alerts, agentEvents]);
  return rows;
}

/** Brief feed: the last few meaningful lines, one line each. */
export function AgentsSaying({ limit = 6 }: { limit?: number }) {
  const rows = useLogRows();
  const reduce = useReducedMotion();
  const seen = new Set<string>();
  const brief: Row[] = [];
  for (const r of rows) {
    if (!r.brief) continue;
    const k = `${r.actorKey}|${r.line}`;
    if (seen.has(k)) continue;
    seen.add(k);
    brief.push(r);
    if (brief.length >= limit) break;
  }
  const t = reduce ? { duration: 0 } : { duration: 0.24, ease: [0.165, 0.84, 0.44, 1] as const };
  return (
    <section className="inbox-say" aria-label="What the agents are saying">
      {brief.length === 0 ? <p className="inbox-empty">Quiet so far. Agent findings, blocked messages and alerts appear here.</p> : (
        <ol className="inbox-say__list">
          <AnimatePresence initial={false}>
            {brief.map((r) => (
              <motion.li key={r.key} className={`inbox-say__row inbox-say__row--${r.tone}`} title={`${istTime(r.at)}  ${r.line}`}
                initial={{ opacity: 0, y: reduce ? 0 : 6 }} animate={{ opacity: 1, y: 0, transition: t }} exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.18 } }}>
                <span className="mono inbox-say__time">{istTime(r.at)}</span>
                <span className={`inbox-log__icon inbox-tone--${r.tone}`}>{r.icon}</span>
                <span className="inbox-say__actor">{r.actor}</span>
                <span className="inbox-say__line">{r.line}{r.count && r.count > 1 ? <span className="mono inbox-log__count">{` \u00d7${r.count}`}</span> : null}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
}

export function WarRoomLog() {
  const rows = useLogRows();
  const [open, setOpen] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const first = useRef(true);
  useEffect(() => { first.current = false; }, []);

  const enter = reduce || first.current ? { duration: 0 } : { duration: 0.24, ease: [0.165, 0.84, 0.44, 1] as const };
  return (
    <section className="inbox-log" aria-label="War room log">
      <h3 className="inbox-col__title">War room log <span className="mono inbox-count">{rows.length}</span></h3>
      {rows.length === 0 ? <p className="inbox-empty">Nothing yet. Messages, verdicts and alerts appear here.</p> : (
        <ol className="inbox-log__list">
          <AnimatePresence initial={false}>
            {rows.map((r) => {
              const isOpen = open === r.key;
              return (
                <motion.li key={r.key} className={`inbox-log__row inbox-log__row--${r.tone}${isOpen ? ' is-open' : ''}`}
                  initial={{ opacity: 0, y: reduce ? 0 : 6 }} animate={{ opacity: 1, y: 0, transition: enter }}
                  exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.18 } }}>
                  <button type="button" className="inbox-log__btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.key)}>
                    <span className="mono inbox-log__time">{istTime(r.at)}</span>
                    <span className={`inbox-log__icon inbox-tone--${r.tone}`}>{r.icon}</span>
                    <span className="inbox-log__actor">{r.actor}</span>
                    <span className="inbox-log__line">{r.line}{r.count && r.count > 1 ? <span className="mono inbox-log__count">{` \u00d7${r.count}`}</span> : null}</span>
                    <ChevronDown {...ICON} className="inbox-log__chev" />
                  </button>
                  {isOpen && <pre className="inbox-log__full">{r.count && r.count > 1 ? `Repeated ${r.count} times\n\n${r.full}` : r.full}</pre>}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
}
