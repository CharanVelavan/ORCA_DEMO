import { create } from 'zustand';
import { api } from '../api';
import type { BandId } from '../pipeline/model';
import { usePipeline } from '../pipeline/pipelineStore';
import type { LiveEvent } from '../types';
import { useUi } from './uiStore';

// Guided presentation for the Stage (user brief, 9 Nov: "too fast, we need a sequence telling what is going to happen").
// Engine events are queued and released one at a time. Before the first event of each stage a card says what is
// about to happen, and the engine clock is paused while a card is up, while events back up, or while the commander
// has a decision waiting. Order is never changed; nothing is invented, only paced.

export type GuideCard = { kind: 'intro' | 'step'; band?: BandId; title: string; text: string; ms: number; started: number };

type Presenter = {
  enabled: boolean;
  card: GuideCard | null;
  held: boolean;
  queued: number;
  skip: () => void;
  toggleHold: () => void;
  setEnabled: (on: boolean) => void;
};

let heldAt = 0;
export const usePresenter = create<Presenter>((set, get) => ({
  enabled: true,
  card: null,
  held: false,
  queued: 0,
  skip: () => { set({ card: null }); kick(); },
  // Pause freezes everything, the guide pop-up's countdown included.
  toggleHold: () => {
    const s = get();
    if (s.held && s.card) set({ card: { ...s.card, started: s.card.started + (Date.now() - heldAt) } });
    if (!s.held) heldAt = Date.now();
    set({ held: !s.held }); kick();
  },
  setEnabled: (enabled) => { set({ enabled, card: null }); kick(); },
}));

const CARD_MS: Record<number, number> = { 0.5: 7000, 1: 5000, 2: 3000 };
const GAP_MS: Record<number, number> = { 0.5: 2200, 1: 1400, 2: 700 };
const speedOf = () => useUi.getState().config.speed;

/** The stage an event belongs to, or null for background state (ticks, heartbeats, quiet verdicts). */
export function bandOf(e: LiveEvent, truth: boolean): BandId | null {
  switch (e.kind) {
    case 'inject': case 'inject_stop': return truth ? 'threat' : null;
    case 'model': {
      const st = String(e.state ?? ''), cls = String(e.class ?? '');
      return st === 'flagged' || st === 'replan' || st === 'unsure' || (cls && cls !== 'normal' && st !== 'ok') ? 'detect' : null;
    }
    case 'alert': case 'agent_task': case 'agent_step': case 'msg': return 'coordinate';
    case 'agent_busy': return e.busy ? 'coordinate' : null;
    case 'verdict': {
      const v = String(e.verdict ?? '');
      if (e.gap_id) return 'gaps';
      return v === 'COMPLIANT' || v === 'INSUFFICIENT_EVIDENCE' ? null : 'commander';
    }
    case 'clock_obligation': return 'commander';
    case 'approval': return e.status === 'requested' ? 'commander' : 'commander';
    case 'execute': case 'patch_stage': case 'heal': case 'reattack': case 'rollback': return 'execute';
    case 'kill': case 'gap_human_decision': return 'commander';
    default: return null;
  }
}

const STEP_TEXT: Record<BandId, (e: LiveEvent) => { title: string; text: string }> = {
  network: () => ({ title: 'Chennai network', text: 'Six Chennai sites run over an emulated satellite link.' }),
  threat: (e) => ({ title: 'The attack starts', text: `${String(e.label ?? 'An attack')} hits ${String(e.target ?? 'the network')}. Only the exercise director sees this. The operators do not know yet.` }),
  detect: () => ({ title: 'The AI models notice', text: 'Four models watch every link. M1 scores the anomaly, M2 forecasts the failure, M3 decides fault or attack, M4 re-plans capacity.' }),
  coordinate: () => ({ title: 'The agents coordinate', text: 'Each operator has an AI agent. It reads only the alerts released to it, asks the rule engine, and proposes a fix from a fixed playbook.' }),
  commander: () => ({ title: 'Code decides, the human approves', text: 'The rule engine checks Indian law and starts the reporting clocks. Nothing runs until the commander approves the fix.' }),
  execute: () => ({ title: 'The fix runs and the network heals', text: 'The fix is tested on a clone, rolled out to 5%, 25% and 100%, and the attack is replayed to prove it is blocked.' }),
  gaps: () => ({ title: 'Policy gaps found', text: 'Where Indian rules say nothing, the rule engine records a policy gap with the source it checked.' }),
};

// ------------------------------------------------------------------ queue
let queue: { e: LiveEvent; truth: boolean }[] = [];
let deliver: ((e: LiveEvent) => void) | null = null;
let announced = new Set<BandId>();
let timer: number | null = null;
let live = false;            // true when a real engine clock exists (not ?fake=1)
let enginePaused = false;

const meaningful = (q: { e: LiveEvent; truth: boolean }) => bandOf(q.e, q.truth) !== null;

function setEngine(pause: boolean) {
  if (!live || pause === enginePaused || useUi.getState().mode !== 'running') return;
  enginePaused = pause;
  api.clock(pause ? { action: 'pause' } : { action: 'play', speed: speedOf() }).catch(() => { enginePaused = !pause; });
}

function backpressure() {
  const p = usePresenter.getState();
  const waiting = usePipeline.getState().pending.length > 0;
  const backlog = queue.filter(meaningful).length;
  if (p.card || p.held || waiting || backlog >= 3) setEngine(true);
  else if (backlog <= 1) setEngine(false);
}

export function kick() {
  if (timer != null) { window.clearTimeout(timer); timer = null; }
  pump();
}

function pump() {
  const p = usePresenter.getState();
  usePresenter.setState({ queued: queue.length });
  backpressure();
  if (!deliver) return;
  if (p.held) return;
  if (p.card) {
    const left = p.card.started + p.card.ms - Date.now();
    if (left > 0) { timer = window.setTimeout(() => { timer = null; usePresenter.setState({ card: null }); pump(); }, left); return; }
    usePresenter.setState({ card: null });
  }
  if (p.held) return;
  // A decision is waiting: show nothing further until the commander acts, unless the decision itself is
  // already resolved further down the queue (AUTO mode, or a recorded approval in Demo after the click).
  const waiting = usePipeline.getState().pending;
  if (waiting.length && !(live && queue.some((q) => q.e.kind === 'approval' && q.e.status !== 'requested' && waiting.some((w) => w.hash === String(q.e.hash ?? q.e.plan_hash ?? ''))))) return;
  let budget = 200;
  while (queue.length && budget-- > 0) {
    const head = queue[0];
    if (head.e.kind === 'session') {
      queue.shift(); announced = new Set(); deliver(head.e);
      if (usePresenter.getState().enabled) { showIntro(head.e); return pump(); }
      continue;
    }
    const band = bandOf(head.e, head.truth);
    if (band && usePresenter.getState().enabled && !announced.has(band)) {
      announced.add(band);
      const t = STEP_TEXT[band](head.e);
      usePresenter.setState({ card: { kind: 'step', band, ...t, ms: CARD_MS[speedOf()] ?? 4500, started: Date.now() } });
      return pump();
    }
    queue.shift();
    deliver(head.e);
    if (band && usePresenter.getState().enabled) {
      usePresenter.setState({ queued: queue.length });
      backpressure();
      timer = window.setTimeout(() => { timer = null; pump(); }, GAP_MS[speedOf()] ?? 900);
      return;
    }
  }
  usePresenter.setState({ queued: queue.length });
  backpressure();
}

function showIntro(e: LiveEvent) {
  usePresenter.setState({ card: { kind: 'intro', title: String(e.title ?? e.scenario ?? 'Exercise'), text: '', ms: (CARD_MS[speedOf()] ?? 4500) + 2500, started: Date.now() } });
}

/** Route events through the presenter. Returns a cleanup function. */
export function present(target: (e: LiveEvent) => void, opts: { live: boolean }) {
  deliver = target; live = opts.live; queue = []; announced = new Set(); enginePaused = false;
  usePresenter.setState({ card: null, held: false, queued: 0 });
  // Resume the engine as soon as the commander decides.
  const unsub = usePipeline.subscribe((s, prev) => { if (s.pending.length !== prev.pending.length) kick(); });
  return {
    push: (e: LiveEvent, truth: boolean) => {
      if (!usePresenter.getState().enabled && !queue.length) { target(e); return; }
      queue.push({ e, truth }); if (timer == null) pump();
    },
    stop: () => { unsub(); deliver = null; queue = []; if (timer != null) window.clearTimeout(timer); timer = null; usePresenter.setState({ card: null, queued: 0 }); },
  };
}
