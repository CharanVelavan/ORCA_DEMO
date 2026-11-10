import { create } from 'zustand';
import type { LiveEvent } from '../types';
import { NODES } from './pipelineNodes';
import { pathFor } from './scenarioPaths';
import { scenarioName } from '../names';

// Pipeline Flow state. Every stream event updates node state immediately; travelling packets go
// through a director queue so bursts play one at a time (plan section 4.4).

export type Tone = 'ok' | 'warn' | 'critical' | 'healing' | 'accent' | 'unknown';
export type Phase = 'idle' | 'path' | 'active' | 'done' | 'skipped';
export type NodeInfo = { phase: Phase; tone?: Tone; word?: string; detail?: string; at?: string; pulse?: boolean };
export type Packet = { id: number; from: string; to: string; label: string; tone: Tone; bounce?: boolean };
export type Beat = { id: number; node: string; title: string; text: string; ts: string; tone: Tone };
export type PendingApproval = { hash: string; playbook: string; title: string; owner: string; targets: string[]; expires_at: string; reason: string };
export type Mode = 'live' | 'replay' | 'explain';

type ModelTrack = { scores: number[]; threshold: number };

type PipelineState = {
  scenario: string;
  truth: boolean;
  nodes: Record<string, NodeInfo>;
  queue: Packet[];
  current: Packet | null;
  beats: Beat[];
  reached: number;
  mode: Mode;
  explainIdx: number;
  pending: PendingApproval[];
  autonomy: string;
  killed: boolean;
  m1: ModelTrack;
  anomalySite: string | null;
  /** model -> site -> state word, so a tile stays red while any site is flagged. */
  msites: Record<string, Record<string, string>>;
  ts: string;
  ingest: (event: LiveEvent, truth: boolean) => void;
  reset: (scenario?: string) => void;
  nextPacket: () => void;
  setMode: (mode: Mode) => void;
  explainStep: (delta: number) => void;
};

const NODE_IDS = new Set(NODES.map((n) => n.id));
const refNode = (ref: string): string | null => {
  if (!ref) return null;
  if (ref.startsWith('CHN-')) return `site:${ref}`;
  if (ref.startsWith('GW-')) return `gw:${ref}`;
  if (ref === 'SAT-MGMT' || ref.startsWith('noc-')) return 'mgmt';
  if (/^M[1-4]$/.test(ref)) return `model:${ref}`;
  if (ref.startsWith('GAP-IN-')) return `gap:${ref.slice(0, 9)}`;
  if (ref === 'commander' || ref === 'human' || ref.startsWith('human:')) return 'human';
  if (ref === 'policy_adviser') return 'agent:policy_adviser';
  const agent = `agent:${ref}`;
  return NODE_IDS.has(agent) ? agent : null;
};

// People read the generic agent names (pipelineNodes.ts), not engine role ids.
const pretty = (role: string) => { const n = NODES.find((x) => x.refs.includes(role) && x.kind === 'agent'); return n ? n.label : role.replace(/_/g, ' ').replace('cert in', 'CERT-In'); };
/** Plain name for a reporting-deadline rule id (engine rule ids stay in the hover card). */
const regimeName = (r: unknown) => { const x = String(r ?? ''); return /CERTIN/i.test(x) ? 'CERT-In 6-hour report' : /TCSR/i.test(x) ? 'Telecom cyber rules report' : /CTIR/i.test(x) ? 'Critical telecom report' : /DPDP/i.test(x) ? 'Data breach report' : /NIS2/i.test(x) ? 'NIS2 report' : x.replace(/^IN-R-DEADLINE-/, ''); };
const pct = (v: unknown) => (typeof v === 'number' ? `${Math.round(v <= 1 ? v * 100 : v)}%` : '');
const short = (s: unknown, n = 44) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const siteTone = (state: string): Tone => (state === 'ok' ? 'ok' : state === 'degraded' ? 'warn' : state === 'down' ? 'critical' : state === 'healing' ? 'healing' : 'unknown');
const verdictTone = (v: string): Tone => (v === 'VIOLATION' ? 'critical' : v === 'COMPLIANT' ? 'ok' : v === 'INSUFFICIENT_EVIDENCE' ? 'unknown' : 'warn');

const baseNodes = (scenario: string): Record<string, NodeInfo> => {
  const path = new Set(pathFor(scenario)?.path ?? []);
  const out: Record<string, NodeInfo> = {};
  for (const n of NODES) {
    if (n.band === 'network') out[n.id] = { phase: 'done', tone: n.id === 'gw:GW-XX' ? 'unknown' : 'ok', word: n.id === 'gw:GW-XX' ? 'LOCKED' : 'OK' };
    else if (n.band === 'detect') out[n.id] = { phase: 'done', tone: 'ok', word: 'NORMAL' };
    else if (n.band === 'coordinate') out[n.id] = { phase: path.has(n.id) ? 'path' : 'idle', word: 'IDLE' };
    else out[n.id] = { phase: path.has(n.id) ? 'path' : 'idle' };
  }
  return out;
};

const empty = (scenario = 'S1') => ({
  scenario, nodes: baseNodes(scenario), queue: [] as Packet[], current: null, beats: [] as Beat[], reached: -1, explainIdx: 0,
  pending: [] as PendingApproval[], autonomy: 'MANUAL', killed: false, m1: { scores: [], threshold: 0.6 }, anomalySite: null, msites: {} as Record<string, Record<string, string>>, ts: '',
});

let packetSeq = 0, beatSeq = 0;
/** First-seen keys per run (verdict+rule, clock regime) so repeated engine re-evaluations do not flood the narration. */
let seen = new Set<string>();
const MAX_QUEUE = 8;

export const usePipeline = create<PipelineState>((set, get) => ({
  ...empty(),
  truth: true,
  mode: 'live',
  reset: (scenario) => set({ ...empty(scenario ?? get().scenario), mode: get().mode === 'replay' ? 'replay' : 'live' }),
  setMode: (mode) => set({ mode, explainIdx: mode === 'explain' ? Math.max(0, get().reached) : get().explainIdx }),
  explainStep: (delta) => {
    const steps = pathFor(get().scenario)?.steps ?? [];
    if (!steps.length) return;
    set({ mode: 'explain', explainIdx: Math.min(steps.length - 1, Math.max(0, get().explainIdx + delta)) });
  },
  nextPacket: () => set((s) => ({ current: s.queue[0] ?? null, queue: s.queue.slice(1) })),
  ingest: (event, truth) => {
    if (!truth && event.audience === 'control') return; // ground truth never reaches the Console
    const s = get();
    const nodes = { ...s.nodes };
    const packets: Packet[] = [];
    const beats: Beat[] = [];
    let { pending, autonomy, killed, anomalySite, m1 } = s;
    const msites = { ...s.msites };
    const ts = typeof event.ts === 'string' && event.ts > s.ts ? event.ts : s.ts;
    const put = (id: string | null, patch: Partial<NodeInfo>) => { if (id && nodes[id]) nodes[id] = { ...nodes[id], ...patch, at: patch.phase === 'active' || patch.phase === 'done' ? event.ts as string : nodes[id].at }; };
    const send = (from: string | null, to: string | null, label: string, tone: Tone = 'accent', bounce = false) => { if (from && to && from !== to && nodes[from] && nodes[to]) packets.push({ id: ++packetSeq, from, to, label, tone, bounce }); };
    const beat = (node: string | null, title: string, text: string, tone: Tone = 'accent') => { if (node) beats.push({ id: ++beatSeq, node, title, text, ts: String(event.ts ?? ''), tone }); };

    switch (event.kind) {
      case 'session': {
        seen = new Set<string>();
        const scenario = String(event.scenario ?? s.scenario);
        // A new run restarts the sim clock: never carry the previous run's later time (it made fresh approvals look expired).
        set({ ...empty(scenario), truth, mode: s.mode === 'replay' ? 'replay' : 'live', ts: String(event.ts ?? '') });
        const p = pathFor(scenario);
        const fresh = get();
        set({ beats: [{ id: ++beatSeq, node: 'sat', title: 'Normal operation', text: p ? `${scenarioName(scenario, p.title)}. Six Chennai sites run over an emulated satellite backhaul.` : 'Six Chennai sites run over an emulated satellite backhaul.', ts: String(event.ts ?? ''), tone: 'ok' }], nodes: { ...fresh.nodes, sat: { ...fresh.nodes.sat, phase: 'active' } }, reached: 0 });
        return;
      }
      case 'tick': {
        const sites = (event.sites ?? {}) as Record<string, Record<string, unknown>>;
        for (const [id, st] of Object.entries(sites)) {
          const state = String(st.state ?? 'ok');
          const prev = nodes[`site:${id}`];
          const tele = state === 'ok' ? `${st.active_path ?? 'A'} · ${st.gateway ?? ''}`
            : Number(st.battery_pct ?? 100) < 60 && st.mains_power === false ? `battery ${Math.round(Number(st.battery_pct))}%`
            : typeof st.snr_db === 'number' && st.snr_db < 5 ? `SNR ${Number(st.snr_db).toFixed(1)} dB, loss ${pct(st.packet_loss)}`
            : `loss ${pct(st.packet_loss)} · ${st.active_path ?? 'A'}`;
          put(`site:${id}`, { phase: state === 'ok' ? 'done' : 'active', tone: siteTone(state), word: state.toUpperCase(), detail: tele });
          if (prev && prev.word === 'HEALING' && state === 'ok') {
            put('exec:return', { phase: 'done', tone: 'ok', word: 'RESTORED' });
            send('exec:return', `site:${id}`, `${id} restored`, 'ok');
            beat('exec:return', 'Back to normal', `${id} is OK again on the clean backup path.`, 'ok');
          }
          if (prev && prev.word === 'OK' && state !== 'ok' && !truth && !anomalySite) {
            anomalySite = id;
            put('threat:anomaly', { phase: 'active', tone: 'warn', word: 'ANOMALY', detail: `${id}, cause not yet known` });
            beat('threat:anomaly', 'Anomaly observed', `Service at ${id} degrades. The cause is not yet known.`, 'warn');
          }
        }
        // The engine refuses approvals older than 30 sim minutes; drop them here too so nothing invites a dead click.
        const live = pending.filter((p) => !p.expires_at || !ts || Date.parse(p.expires_at) > Date.parse(ts));
        if (live.length < pending.length) {
          const gone = pending.filter((p) => !live.includes(p));
          pending = live;
          if (!live.length) put('human', { phase: 'done', tone: 'warn', word: 'EXPIRED', detail: `${gone[0].playbook} not approved in 30 min`, pulse: false });
          beat('human', 'Request expired', `${gone.map((g) => g.playbook).join(', ')} waited 30 minutes without approval. The agent must ask again on the current state.`, 'warn');
        }
        for (const [gw, st] of Object.entries((event.gateways ?? {}) as Record<string, string>)) {
          if (gw === 'GW-XX') continue;
          put(`gw:${gw}`, { tone: st === 'up' ? 'ok' : 'critical', word: st === 'up' ? 'UP' : 'DOWN' });
        }
        break;
      }
      case 'inject': {
        const injector = String(event.injector ?? '');
        const id = `threat:${injector}`;
        const target = refNode(String(event.target ?? '')) ?? 'sat';
        put(id, { phase: 'active', tone: 'critical', word: 'ACTIVE', detail: `${event.target ?? ''} ${event.by === 'scenario' ? 'scripted' : 'by director'}` });
        send(id, target, String(event.label ?? injector), 'critical');
        beat(id, String(event.label ?? 'Threat injected'), `${event.label ?? injector} hits ${event.target ?? 'the network'}. Ground truth, director only.`, 'critical');
        break;
      }
      case 'inject_stop': {
        const id = `threat:${event.injector}`;
        put(id, { phase: 'done', tone: 'ok', word: 'STOPPED', detail: `${event.target ?? ''} stopped by the director`, pulse: false });
        beat(id, 'Attack stopped', `${String(event.label ?? event.injector)} on ${event.target ?? 'the network'} is stopped. The network now recovers.`, 'ok');
        break;
      }
      case 'scheduled': {
        put(`threat:${event.injector}`, { phase: 'path', word: 'SCHEDULED', detail: `at T+${event.at_t}` });
        break;
      }
      case 'model': {
        const model = String(event.model ?? 'M3');
        const id = `model:${model}`;
        const site = String(event.site ?? '');
        const wasRed = nodes[id]?.tone === 'critical' || nodes[id]?.tone === 'warn';
        const siteMap = { ...(msites[model] ?? {}) };
        const st = String(event.state ?? (event.class === 'normal' ? 'ok' : 'flagged'));
        if (site) siteMap[site] = st; else siteMap['*'] = st;
        msites[model] = siteMap;
        const others = Object.entries(siteMap).filter(([k, v]) => k !== (site || '*') && ['flagged', 'unsure', 'fault', 'replan'].includes(v));
        // A heartbeat saying "ok" for one site must not clear a tile another site still holds red.
        if ((st === 'ok' || st === 'warming' || st === 'unavailable') && others.length) break;
        if (st === 'warming' || st === 'unavailable') {
          const samples = typeof event.samples === 'number' && typeof event.required_samples === 'number'
            ? ` (${event.samples}/${event.required_samples} samples)` : '';
          put(id, { phase: 'path', tone: 'unknown', word: st === 'warming' ? 'WARMING' : 'UNAVAILABLE',
            detail: st === 'warming' ? `Collecting observed telemetry${samples}` : 'Model output unavailable', pulse: false });
          break;
        }
        if (model === 'M1') {
          const score = typeof event.score === 'number' ? event.score : undefined;
          const threshold = typeof event.threshold === 'number' ? event.threshold : undefined;
          if (score !== undefined && threshold !== undefined) m1 = { scores: [...m1.scores, score].slice(-32), threshold };
          const flagged = event.state === 'flagged';
          const sources = Array.isArray(event.flag_sources) ? event.flag_sources.filter((value): value is string => typeof value === 'string') : [];
          const detail = score === undefined || threshold === undefined ? 'Anomaly score unavailable'
            : `${site} Isolation Forest ${score.toFixed(2)} / ${threshold.toFixed(2)}${sources.includes('ecod') ? '; ECOD flagged' : ''}`;
          put(id, { phase: flagged ? 'active' : 'done', tone: flagged ? 'critical' : 'ok', word: flagged ? 'FLAGGED' : 'NORMAL', detail, pulse: flagged });
          if (flagged && !wasRed) { send(refNode(site), id, 'anomaly', 'critical'); beat(id, 'Anomaly detector flags a problem', `${detail}.`, 'critical'); }
        } else if (model === 'M2') {
          const h = event.horizon_min, flagged = event.state === 'flagged';
          const what = event.metric === 'battery' ? 'battery empty' : 'link lost';
          const noFailure = typeof event.forecast_window_min === 'number'
            ? `No failure within ${event.forecast_window_min} min (median)` : 'No failure time reported';
          put(id, { phase: flagged ? 'active' : 'done', tone: flagged ? 'warn' : 'ok', word: flagged ? 'FORECAST' : 'NORMAL', detail: h == null ? noFailure : Number(h) <= 0 ? `${site} ${what} now` : `${site} ${what} in ${h} min`, pulse: flagged });
          if (flagged && !wasRed) { send(refNode(site), id, 'trend', 'warn'); beat(id, 'Failure forecaster warns', Number(h) <= 0 ? `${site}: ${what} now.` : `${site}: ${what} in about ${h} minutes.`, 'warn'); }
        } else if (model === 'M4') {
          const alloc = Array.isArray(event.allocation_priority) ? event.allocation_priority.filter((item): item is string => typeof item === 'string').join(' > ') : '';
          const replan = event.state === 'replan';
          put(id, { phase: replan ? 'active' : 'done', tone: replan ? 'warn' : 'ok', word: replan ? 'RE-PLAN' : 'NORMAL', detail: alloc || 'Allocation priority unavailable' });
          if (replan && !wasRed) beat(id, 'Capacity planner re-plans', alloc ? `Scarce capacity goes first to ${alloc}.` : 'Capacity replanning reported; allocation priority unavailable.', 'warn');
        } else {
          const cls = String(event.class ?? ''), conf = typeof event.confidence === 'number' ? event.confidence : undefined;
          if (cls === 'normal' || st === 'ok') { put(id, { phase: 'done', tone: 'ok', word: 'NORMAL', detail: 'all sites normal', pulse: false }); break; }
          const unsure = cls === 'abstain' || event.state === 'unsure';
          const attack = cls.startsWith('attack');
          const tone: Tone = unsure ? 'warn' : attack ? 'critical' : cls === 'normal' ? 'ok' : 'warn';
          const modelDetail = unsure ? 'abstains, human decides'
            : `${cls}${conf === undefined ? '' : ` ${(conf * 100).toFixed(1)}% model score`}`;
          put(id, { phase: 'active', tone, word: unsure ? 'UNSURE' : attack ? 'ATTACK' : 'FAULT', detail: modelDetail, pulse: true });
          if (!wasRed || nodes[id]?.detail !== modelDetail) {
            send(refNode(site), id, unsure ? 'unclear' : cls.replace('attack-', '').replace('fault-', ''), tone);
            beat(id, unsure ? 'Attack classifier is not sure' : attack ? 'Attack classifier: cyber attack' : 'Attack classifier: a fault', unsure ? `It abstains at ${site} and hands the call to the human.` : `${site} looks like ${cls.replace(/-/g, ' ')}${conf === undefined ? '' : ` (uncalibrated model score ${(conf * 100).toFixed(1)}%)`}.`, tone);
          }
          if (!truth && anomalySite) put('threat:anomaly', { detail: `${anomalySite}: M3 says ${unsure ? 'unsure' : cls}` });
        }
        break;
      }
      case 'alert': {
        const from = refNode(String(event.source ?? 'M3'));
        const to = Array.isArray(event.visible_to) ? (event.visible_to as string[]) : [];
        for (const role of to) send(from, refNode(role), `alert ${event.site ?? ''}`, 'critical');
        if (!truth && !anomalySite && event.site) { anomalySite = String(event.site); put('threat:anomaly', { phase: 'active', tone: 'warn', word: 'ANOMALY', detail: `${event.site}, cause not yet known` }); }
        if (to.length) beat(refNode(to[0]), 'Agents are told', `${event.source === 'M3' ? 'The attack classifier' : String(event.source)} alerts the ${to.map(pretty).join(', ')}.`, 'accent');
        break;
      }
      case 'agent_busy': {
        const id = refNode(String(event.role));
        if (event.busy) put(id, { phase: 'active', tone: 'accent', word: 'THINKING' });
        else put(id, { phase: 'done', tone: 'ok', word: 'DONE' });
        break;
      }
      case 'agent_task': {
        const id = refNode(String(event.role));
        send('human', id, 'order', 'accent');
        put(id, { phase: 'active', tone: 'accent', word: 'TASKED', detail: short(event.task) });
        beat(id, 'Commander gives an order', `${pretty(String(event.role))}: ${short(event.task, 90)}`);
        break;
      }
      case 'agent_step': {
        // One tool call by an agent (real engine event). Show who the agent is talking to and why.
        const id = refNode(String(event.actor ?? event.role ?? ''));
        if (!id) break;
        const tool = String(event.tool ?? '');
        const why = short(event.rationale, 90);
        const cites = Array.isArray(event.citations_accepted) ? (event.citations_accepted as string[]).length : 0;
        const TOOL: Record<string, [string | null, string, string]> = {
          read_alerts: ['model:M3', 'READING ALERT', 'reads the alert'],
          explain_model: ['model:M3', 'ASKS MODEL', 'asks M3 why'],
          run_rule_engine: ['rules', 'ASKS RULES', 'asks the rule engine'],
          query_kb: [null, 'READS LAW', 'reads the knowledge base'],
          ask_adviser: ['agent:policy_adviser', 'ASKS ADVISER', 'asks the policy adviser'],
          select_playbook: [null, 'PICKS FIX', 'picks a playbook'],
          request_approval: ['human', 'ASKS HUMAN', 'asks the commander'],
          send_message: [null, 'MESSAGING', 'sends a message'],
        };
        if (!tool) { put(id, { phase: 'active', tone: 'accent', word: 'ANSWERS', detail: why || 'reports back' }); break; }
        const [peer, word, verb] = TOOL[tool] ?? [null, tool.replace(/_/g, ' ').toUpperCase(), tool.replace(/_/g, ' ')];
        put(id, { phase: 'active', tone: 'accent', word, detail: why || verb });
        if (peer) { if (tool === 'read_alerts' || tool === 'explain_model') send(peer, id, 'alert', 'accent'); else send(id, peer, verb.split(' ').slice(-1)[0], 'accent'); }
        beat(id, `${pretty(String(event.actor))} ${verb}`, `${why ? `"${why}"` : ''}${cites ? ` Cites ${cites} legal record${cites > 1 ? 's' : ''}.` : ''}`.trim() || `${pretty(String(event.actor))} ${verb}.`);
        break;
      }
      case 'agent_final': {
        put(refNode(String(event.role)), { detail: short(event.text) });
        break;
      }
      case 'msg': {
        const m = (event.message ?? event) as Record<string, unknown>;
        const from = refNode(String(m.sender ?? ''));
        const recips = (m.recipients ?? m.to ?? []) as string[];
        const rejected = event.audit_kind === 'msg_rejected' || 'reason' in event && 'message' in event;
        for (const r of recips.slice(0, 3)) send(from, refNode(r), rejected ? `blocked: ${short(event.reason, 28)}` : String(m.type ?? 'msg'), rejected ? 'critical' : 'accent', rejected);
        if (rejected) beat(from, 'Message blocked by code', `${pretty(String(m.sender))} broke a protocol rule: ${short(event.reason, 80)}`, 'critical');
        break;
      }
      case 'verdict': {
        const v = String(event.verdict ?? '');
        const tone = verdictTone(v);
        const vkey = `v:${v}:${event.rule}:${event.gap_id ?? ''}`;
        if (seen.has(vkey)) break;
        seen.add(vkey);
        const quiet = v === 'COMPLIANT' || v === 'INSUFFICIENT_EVIDENCE';
        if (quiet && nodes.rules.phase === 'active' && nodes.rules.tone !== 'ok') { put('rules', { detail: `${event.rule ?? ''}` }); break; }
        put('rules', { phase: 'active', tone, word: v.replace(/_/g, ' '), detail: `${event.rule ?? ''}` });
        if (!quiet) send('rules', 'human', v.replace(/_/g, ' ').toLowerCase(), tone);
        if (v === 'CONFLICT') for (const role of new Set(String(event.explanation ?? '').match(/[a-z]+_(?:operator|utility|analyst)|cert_in|regulator/g) ?? [])) { const a = refNode(role); if (a) { send('rules', a, 'conflict', 'warn'); put(a, { phase: 'active', tone: 'warn', word: 'IN CONFLICT', detail: short(event.topic, 30) }); } }
        if (!quiet || !nodes.rules.at) beat('rules', `Rule engine: ${v.replace(/_/g, ' ')}`, short(event.explanation ?? `${event.topic}`, 140), tone);
        const gap = event.gap_id ? refNode(String(event.gap_id)) : null;
        if (gap) {
          put(gap, { phase: 'active', tone: 'warn', word: 'GAP FOUND', detail: short(event.topic, 30) });
          send('rules', gap, 'gap', 'warn');
          beat(gap, 'Policy gap found', `${String(event.gap_id).slice(0, 9)}: ${short(event.explanation ?? event.topic, 120)}`, 'warn');
        }
        break;
      }
      case 'clock_obligation': {
        const ckey = `c:${event.regime}`;
        if (seen.has(ckey)) break;
        seen.add(ckey);
        put('clocks', { phase: 'active', tone: 'warn', word: 'RUNNING', detail: `${regimeName(event.regime)} due ${String(event.due_at ?? '').slice(11, 16)}` });
        send('rules', 'clocks', 'clock starts', 'warn');
        const owes = /CERT/i.test(String(event.regime)) ? 'agent:cert_in' : /TCSR|CTIR|DOT|TEL/i.test(String(event.regime)) ? 'agent:regulator' : null;
        if (owes) { send('clocks', owes, 'report due', 'warn'); put(owes, { phase: 'active', tone: 'warn', word: 'REPORT DUE', detail: `${regimeName(event.regime)} by ${String(event.due_at ?? '').slice(11, 16)} IST` }); }
        beat('clocks', 'A reporting clock starts', `${regimeName(event.regime)} is due by ${String(event.due_at ?? '').slice(11, 16)} IST.`, 'warn');
        break;
      }
      case 'approval': {
        const status = String(event.status ?? '');
        const hash = String(event.hash ?? event.plan_hash ?? '');
        const known = pending.find((p) => p.hash === hash);
        const owner = String(event.owner ?? known?.owner ?? '');
        const pb = String(event.playbook ?? known?.playbook ?? '');
        if (status === 'requested') {
          const item: PendingApproval = { hash, playbook: pb, title: String(event.title ?? pb), owner, targets: (event.targets as string[]) ?? [], expires_at: String(event.expires_at ?? ''), reason: String(event.reason ?? '') };
          pending = [...pending.filter((p) => p.hash !== hash), item];
          send(refNode(owner), 'human', `${pb} ${item.targets.join(',')}`, 'accent');
          put(refNode(owner), { phase: 'active', tone: 'accent', word: 'ASKS APPROVAL', detail: `${pb} on ${item.targets.join(', ')}` });
          put('human', { phase: 'active', tone: 'accent', word: 'AWAITING APPROVAL', detail: `${pb} asked by ${pretty(owner)}`, pulse: true });
          beat('human', 'Report reaches the commander', `${pretty(owner)} asks to run ${pb} (${item.title}) on ${item.targets.join(', ')}.`);
        } else if (status === 'approved' || status === 'auto') {
          pending = pending.filter((p) => p.hash !== hash);
          send('human', refNode(owner), status === 'auto' ? 'AUTO, inside scope' : `APPROVED #${hash.slice(0, 4)}`, 'ok');
          put('human', { phase: 'done', tone: 'ok', word: status === 'auto' ? 'AUTO' : 'APPROVED', detail: `${pb} #${hash.slice(0, 4)}`, pulse: pending.length > 0 });
          for (const k of Object.keys(nodes)) if (nodes[k].pulse && k.startsWith('model:')) nodes[k] = { ...nodes[k], pulse: false };
          put(refNode(owner), { phase: 'active', tone: 'ok', word: 'APPROVED', detail: `${pb} signed #${hash.slice(0, 4)}` });
          beat('human', status === 'auto' ? 'Approved automatically' : 'Human approves', status === 'auto' ? `${pb} runs inside the AUTO scope the commander granted.` : `The commander approves ${pb} with one click. The signed approval travels back to ${pretty(owner)}.`, 'ok');
        } else if (status === 'rejected') {
          pending = pending.filter((p) => p.hash !== hash);
          send('human', refNode(owner), 'REJECTED', 'critical');
          put('human', { phase: 'done', tone: 'critical', word: 'REJECTED', detail: `${pb}`, pulse: pending.length > 0 });
          beat('human', 'Human rejects', `The commander rejects ${pb}. Nothing runs.`, 'critical');
        }
        break;
      }
      case 'execute': {
        const ok = event.result !== 'refused';
        const owner = refNode(String(event.actor ?? '')) ;
        put(owner, { phase: 'active', tone: ok ? 'healing' : 'critical', word: ok ? 'EXECUTING' : 'REFUSED', detail: `${event.playbook ?? ''} ${ok ? 'approved, running' : 'blocked by code'}` });
        put('exec:clone', { phase: 'done', tone: ok ? 'ok' : 'critical', word: ok ? 'PASSED' : 'REFUSED', detail: ok ? `${event.playbook ?? ''} on a clone` : short(event.why, 30) });
        send(owner, 'exec:clone', `${event.playbook ?? 'run'}`, ok ? 'ok' : 'critical');
        beat('exec:clone', ok ? `${event.playbook} runs` : `${event.playbook} refused`, ok ? `Clone test passed. The owner agent executes ${event.playbook} on ${(event.targets as string[] ?? []).join(', ')}.` : `Code refuses: ${short(event.why, 100)}`, ok ? 'ok' : 'critical');
        break;
      }
      case 'patch_stage': {
        const p = Number(event.pct);
        const id = p <= 5 ? 'exec:r5' : p <= 25 ? 'exec:r25' : 'exec:r100';
        const ok = event.health !== 'fail';
        put(id, { phase: 'done', tone: ok ? 'ok' : 'critical', word: ok ? 'HEALTHY' : 'FAILED', detail: `${event.playbook} at ${p}%` });
        send(p <= 5 ? 'exec:clone' : p <= 25 ? 'exec:r5' : 'exec:r25', id, `${p}%`, ok ? 'ok' : 'critical');
        if (p >= 100 || !ok) beat(id, ok ? 'Rollout complete' : 'Rollout failed', ok ? `${event.playbook} reached 5%, 25% and 100% of the fleet, healthy at each stage.` : `${event.playbook} failed at ${p}%.`, ok ? 'ok' : 'critical');
        break;
      }
      case 'heal': {
        const check = (event.check ?? {}) as Record<string, unknown>;
        const clean = check.clean !== false;
        const site = String(event.site ?? '');
        put('exec:cleanpath', { phase: 'done', tone: clean ? 'ok' : 'critical', word: clean ? 'CLEAN' : 'REJECTED', detail: `path ${event.to_path} via ${check.gateway ?? '?'}` });
        if (!clean || check.gateway === 'GW-XX') put('gw:GW-XX', { phase: 'active', tone: 'critical', word: 'BLOCKED', detail: 'foreign path refused' });
        put('exec:failover', { phase: 'done', tone: clean ? 'healing' : 'critical', word: clean ? 'SWITCHED' : 'HELD', detail: `${site} ${event.from_path} > ${event.to_path}` });
        send('exec:cleanpath', 'exec:failover', clean ? 'clean' : 'unsafe', clean ? 'ok' : 'critical');
        if (clean) { put('exec:return', { phase: 'active', tone: 'healing', word: 'HEALING' }); send('exec:failover', 'exec:return', `${site} healing`, 'ok'); }
        beat('exec:failover', clean ? 'Self-healing failover' : 'Unsafe path refused', clean ? `${site} moves from path ${event.from_path} to clean path ${event.to_path} via ${check.gateway ?? 'a domestic gateway'}.` : `The backup path for ${site} failed the clean-path check, so traffic stays put.`, clean ? 'healing' : 'critical');
        break;
      }
      case 'reattack': {
        const blocked = Boolean(event.blocked);
        for (const k of Object.keys(nodes)) if (k.startsWith('agent:') && nodes[k].word === 'EXECUTING') put(k, { phase: 'done', tone: 'ok', word: 'FIX DONE' });
        put('exec:reattack', { phase: 'done', tone: blocked ? 'ok' : 'critical', word: blocked ? 'BLOCKED' : 'GOT IN', detail: short(event.attack, 30) });
        send('exec:r100', 'exec:reattack', 're-attack', blocked ? 'ok' : 'critical');
        beat('exec:reattack', blocked ? 'Re-attack blocked' : 'Re-attack succeeded', blocked ? `The same attack is replayed after the fix and is blocked.` : 'The replayed attack still works. Rollback follows.', blocked ? 'ok' : 'critical');
        break;
      }
      case 'rollback': {
        put('exec:rollback', { phase: 'active', tone: 'critical', word: 'ROLLED BACK', detail: short(event.reason ?? event.playbook, 30) });
        beat('exec:rollback', 'Automatic rollback', 'A stage went unhealthy, so the change is rolled back.', 'critical');
        break;
      }
      case 'autonomy': { autonomy = String(event.mode ?? autonomy); break; }
      case 'kill': { killed = Boolean(event.engaged); beat('human', killed ? 'Kill switch engaged' : 'Kill switch released', killed ? 'All pending actions are revoked until the commander releases it.' : 'Agents may act again, within the granted scope.', killed ? 'critical' : 'ok'); break; }
      case 'gap_human_decision': {
        const gap = refNode(String(event.draft_id ?? ''));
        const ok = event.decision === 'confirm';
        put(gap, { phase: 'done', tone: ok ? 'warn' : 'unknown', word: ok ? 'CONFIRMED' : 'DISMISSED' });
        send('human', gap, ok ? 'confirmed' : 'dismissed', 'accent');
        break;
      }
      default: break;
    }

    // Path progress (narration "step n of N"): advance to the furthest step whose node is now live.
    let reached = s.reached;
    const steps = pathFor(s.scenario)?.steps ?? [];
    for (let i = reached + 1; i < steps.length; i++) {
      const n = nodes[steps[i].node];
      if (n && (n.phase === 'active' || (n.phase === 'done' && n.at))) reached = i;
    }

    let queue = [...s.queue, ...packets];
    if (queue.length > MAX_QUEUE) queue = queue.slice(queue.length - MAX_QUEUE); // skip stale packets, keep state
    set({ nodes, queue, beats: beats.length ? [...s.beats, ...beats].slice(-80) : s.beats, reached, pending, autonomy, killed, anomalySite, m1, msites, ts });
  },
}));
