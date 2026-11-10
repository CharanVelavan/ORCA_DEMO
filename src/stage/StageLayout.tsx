import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Box, ChevronRight, Inbox, Maximize2, MessagesSquare, RotateCcw, X } from 'lucide-react';
import { PipelineFlow } from '../pipeline/PipelineFlow';
import { GuideToast } from '../pipeline/GuideCard';
import { usePipeline } from '../pipeline/pipelineStore';
import { NODES } from '../pipeline/pipelineNodes';
import { ICONS } from '../pipeline/icons';
import { ApproveButton, CommanderInbox } from '../inbox';
import { TopBar } from './TopBar';
import { useStageKeys } from './useKeys';
import { ist } from './time';
import './stage.css';

const NetworkScene = lazy(() => import('../scenes/NetworkScene').then((m) => ({ default: m.NetworkScene })));
const morph = [0.645, 0.045, 0.355, 1] as const;

/** WebGL can be missing (old projector PC, locked-down browser). The 3D view must never take the console down. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="st-scene-wait"><span className="mono">3D view unavailable on this device (no WebGL). The flowchart keeps working.</span></div>;
    return this.props.children;
  }
}

export function Scene3D({ truth }: { truth: boolean }) {
  return <SceneBoundary><Suspense fallback={<div className="st-scene-wait mono">Loading emulated network</div>}><NetworkScene truth={truth} /></Suspense></SceneBoundary>;
}

type Drawer = null | 'decisions' | 'feed';

/**
 * Shared frame for Stage and Console (user layout decision, 9 Nov):
 * setup:   [ simulator 34% | 3D ]
 * running: [ rail 64px | flowchart, fitted to the screen | side 340px: mini 3D, decisions, agent feed ]
 * The inbox and the agent feed open as drawers; the 3D opens large on demand. Nothing scrolls sideways.
 */
export function StageLayout({ view, truth, setupPanel, rail, drawer, running }: {
  view: 'stage' | 'console'; truth: boolean; running: boolean;
  setupPanel?: ReactNode; rail: ReactNode; drawer?: ReactNode;
}) {
  const reduced = useReducedMotion();
  useStageKeys(view === 'stage');
  const [open, setOpen] = useState<Drawer>(null);
  const [big, setBig] = useState(false);
  const pending = usePipeline((s) => s.pending.length);
  const beats = usePipeline((s) => s.beats.length);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(null); setBig(false); } };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);
  useEffect(() => { if (!running) { setOpen(null); setBig(false); } }, [running]);

  if (!running) {
    return (
      <div className="st-app">
        <TopBar view={view} />
        <main className="st-main st-main--setup">
          <motion.aside className="st-setup" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={reduced ? { duration: 0 } : { duration: 0.32, ease: morph as unknown as number[] }}>{setupPanel}</motion.aside>
          <section className="st-scene"><Scene3D truth={truth} />{drawer}</section>
        </main>
      </div>
    );
  }
  return (
    <div className="st-app">
      <TopBar view={view} />
      <main className="st-main st-main--run">
        <aside className="st-rail">{rail}</aside>
        <section className="st-flow">
          <PipelineFlow truth={truth} />
          {drawer}
        </section>
        <aside className="st-side" aria-label="Network and inbox">
          <GuideToast />
          <div className="st-mini">
            <header className="st-mini__head">
              <span><Box size={14} strokeWidth={1.75} aria-hidden /> Chennai network <em>emulated</em></span>
              <span className="st-mini__tools">
                <button className="st-ib" title="Reset the 3D view" aria-label="Reset the 3D view" onClick={() => window.dispatchEvent(new Event('orca-3d-reset'))}><RotateCcw size={14} strokeWidth={1.75} /></button>
                <button className="st-ib" title="Open the 3D view large" aria-label="Open the 3D view large" onClick={() => setBig(true)}><Maximize2 size={14} strokeWidth={1.75} /></button>
              </span>
            </header>
            <div className="st-mini__view">{!big && <Scene3D truth={truth} />}</div>
            <p className="st-mini__hint">Drag to rotate, scroll to zoom</p>
          </div>
          <PendingPeek />
          <button className={`st-sidebtn ${pending ? 'is-hot' : ''}`} onClick={() => setOpen(open === 'decisions' ? null : 'decisions')} aria-expanded={open === 'decisions'}>
            <Inbox size={17} strokeWidth={1.75} aria-hidden /><span>Commander inbox</span>{pending > 0 && <b className="st-badge">{pending}</b>}<ChevronRight size={16} aria-hidden />
          </button>
          <button className="st-sidebtn" onClick={() => setOpen(open === 'feed' ? null : 'feed')} aria-expanded={open === 'feed'}>
            <MessagesSquare size={17} strokeWidth={1.75} aria-hidden /><span>What the agents are saying</span>{beats > 0 && <b className="st-badge st-badge--muted">{beats}</b>}<ChevronRight size={16} aria-hidden />
          </button>
        </aside>
        <AnimatePresence>
          {open && (
            <motion.aside key={open} className="st-drawer" role="dialog" aria-label={open === 'decisions' ? 'Commander inbox' : 'What the agents are saying'}
              initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={reduced ? { duration: 0 } : { duration: 0.22, ease: [0.165, 0.84, 0.44, 1] }}>
              <header className="st-drawer__head">
                <h2>{open === 'decisions' ? 'Commander inbox' : 'What the agents are saying'}</h2>
                <button className="st-ib" onClick={() => setOpen(null)} aria-label="Close"><X size={16} /></button>
              </header>
              <div className="st-drawer__body">{open === 'decisions' ? <div className="st-inbox"><CommanderInbox /></div> : <Feed />}</div>
            </motion.aside>
          )}
        </AnimatePresence>
        {big && (
          <div className="st-big" role="dialog" aria-label="Chennai network, 3D">
            <div className="st-big__frame">
              <header className="st-mini__head">
                <span><Box size={15} strokeWidth={1.75} aria-hidden /> Chennai network <em>emulated</em></span>
                <span className="st-mini__tools">
                  <button className="st-ib" title="Reset view" aria-label="Reset view" onClick={() => window.dispatchEvent(new Event('orca-3d-reset'))}><RotateCcw size={15} strokeWidth={1.75} /></button>
                  <button className="st-ib" onClick={() => setBig(false)} aria-label="Close (Esc)"><X size={16} /></button>
                </span>
              </header>
              <div className="st-big__view"><Scene3D truth={truth} /></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/** The decision waiting right now, with its Approve button, so the presenter never has to open the inbox for it. */
function PendingPeek() {
  const pending = usePipeline((s) => s.pending);
  const p = pending[pending.length - 1];
  if (!p) return null;
  return (
    <div className="st-peek" role="status">
      <span className="st-peek__kicker mono">Decision waiting</span>
      <b>{p.title}</b>
      <span className="st-peek__meta">{p.playbook} · {p.targets.join(', ')}</span>
      <ApproveButton hash={p.hash} variant="node" />
    </div>
  );
}

/** Every sentence of this run, newest first: what each model, agent and the commander did. */
function Feed() {
  const beats = usePipeline((s) => s.beats);
  const def = (id: string) => NODES.find((n) => n.id === id);
  return (
    <ol className="st-feed">
      {beats.length === 0 && <li className="st-feed__empty">Nothing yet. Events appear here as they happen.</li>}
      {[...beats].reverse().map((b) => {
        const d = def(b.node);
        const Icon = d ? ICONS[d.icon] : null;
        return (
          <li key={b.id} className={`t-${b.tone}`}>
            <span className="st-feed__at mono">{ist(b.ts)}</span>
            <span className="st-feed__who">{Icon && <Icon size={15} strokeWidth={1.75} aria-hidden />}{d?.label ?? ''}</span>
            <b>{b.title}</b>
            <span className="st-feed__txt">{b.text}</span>
          </li>
        );
      })}
    </ol>
  );
}
