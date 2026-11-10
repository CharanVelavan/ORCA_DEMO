import { useEffect, useRef, useState } from 'react';
import { Bot, ChevronRight, X } from 'lucide-react';
import { agents, type AgentView, type DeriveInput } from '../derive';
import { Empty, Panel, StatusBadge, simClockIST } from '../shell';
import type { LiveEvent } from '../types';
import { eventCitations, eventRole, safeJson, strings, text, type CatalogueRecord } from './data';

function isAgentEvent(event: LiveEvent, role: string): boolean {
  if (event.audience === 'control') return false;
  if (event.kind === 'msg') {
    const sender = text(event.sender) ?? text(event.from) ?? eventRole(event);
    const recipients = [...strings(event.recipients), ...strings(event.to)];
    const singleRecipient = text(event.to);
    return sender === role || recipients.includes(role) || singleRecipient === role;
  }
  return ['agent_task', 'agent_step', 'agent_final', 'agent_busy'].includes(event.kind) && eventRole(event) === role;
}

function AgentDrawer({ agent, events, records, onClose }: { agent: AgentView; events: LiveEvent[]; records: CatalogueRecord[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    close.current?.focus();
    return () => { if (element?.open) element.close(); previous?.focus(); };
  }, []);
  const trace = events.filter((event) => isAgentEvent(event, agent.role));
  const byId = new Map(records.map((record) => [record.id, record]));
  return (
    <dialog ref={dialog} className="ops-drawer" aria-labelledby="ops-drawer-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialog.current) onClose(); }}>
      <header className="ops-drawer__head">
        <div><p className="ops-subtle">Agent trace</p><h2 id="ops-drawer-title">{agent.label}</h2></div>
        <button ref={close} className="ops-icon-button" type="button" aria-label="Close agent trace" onClick={onClose}><X size={18} /></button>
      </header>
      <p className="ops-drawer__intro">Agents recommend. The human commander makes approval decisions.</p>
      {!trace.length ? <Empty>No trace or messages have been received for this role.</Empty> : (
        <ol className="ops-trace">
          {trace.map((event) => {
            const tool = text(event.tool);
            const sender = text(event.sender) ?? text(event.from) ?? eventRole(event);
            const body = text(event.text) ?? text(event.rationale) ?? text(event.task);
            const references = eventCitations(event).filter((id) => byId.has(id));
            const generated = (event.kind === 'agent_step' || event.kind === 'agent_final' || (event.kind === 'msg' && sender === agent.role)) && Boolean(body);
            return (
              <li key={`${event.seq}-${event.kind}`}>
                <div className="ops-trace__meta"><time>{simClockIST(event.ts)} IST</time><strong>{event.kind.replace(/_/g, ' ')}</strong>{tool && <code>{tool}</code>}</div>
                {generated && <div className="ops-draft">Draft by {agent.label}</div>}
                {body && <p>{body}</p>}
                {event.kind === 'msg' && <p className="ops-subtle">From {sender ?? 'unavailable'}{strings(event.recipients).length > 0 ? ` to ${strings(event.recipients).join(', ')}` : ''}</p>}
                {(event.args != null || event.result != null) && <details><summary>Tool input and result</summary><pre>{safeJson({ args: event.args, result: event.result })}</pre></details>}
                {references.length > 0 && <div className="ops-citations" aria-label="Cited knowledge-base records">{references.map((id) => {
                  const record = byId.get(id);
                  return <span key={id}><code>{id}</code>{record?.instrument && ` ${record.instrument}`}{record?.clause && `, ${record.clause}`}</span>;
                })}</div>}
              </li>
            );
          })}
        </ol>
      )}
    </dialog>
  );
}

export function AgentActivity({ data, records }: { data: DeriveInput; records: CatalogueRecord[] }) {
  const [selected, setSelected] = useState<AgentView | null>(null);
  const events = data.events ?? [];
  const views = agents(data).filter((agent) => agent.kind === 'operator');
  return (
    <>
      <Panel title="Agent activity" icon={Bot} right={<span className="ops-subtle">Select a role for its trace</span>}>
        <div className="ops-agent-list">
          {views.map((agent) => {
            const trace = [...events].reverse().find((event) => isAgentEvent(event, agent.role) && event.kind !== 'agent_busy');
            const tool = text(trace?.tool);
            const rationale = text(trace?.rationale) ?? text(trace?.task) ?? text(trace?.text);
            const observed = Boolean(data.agents?.[agent.role]) || Boolean(trace);
            const status = !observed ? 'Not reported' : agent.status;
            const tone = !observed ? 'unknown' : agent.status === 'running' ? 'accent' : agent.status === 'waiting' ? 'warn' : 'unknown';
            const sender = trace && (text(trace.sender) ?? text(trace.from) ?? eventRole(trace));
            const generated = trace?.kind === 'agent_step' || trace?.kind === 'agent_final' || (trace?.kind === 'msg' && sender === agent.role);
            return (
              <button type="button" className="ops-agent" key={agent.role} onClick={() => setSelected(agent)} aria-haspopup="dialog">
                <span className="ops-agent__avatar"><Bot size={15} aria-hidden /></span>
                <span className="ops-agent__copy"><strong>{agent.label}</strong><small>{tool ? `${tool}: ` : ''}{rationale ? `${generated ? `Draft by ${agent.label}: ` : ''}${rationale}` : 'No activity reported'}</small></span>
                <StatusBadge tone={tone} word={status} size="sm" /><ChevronRight size={14} aria-hidden />
              </button>
            );
          })}
        </div>
      </Panel>
      {selected && <AgentDrawer key={selected.role} agent={selected} events={events} records={records} onClose={() => setSelected(null)} />}
    </>
  );
}
