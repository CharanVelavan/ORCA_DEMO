/**
 * PageFrame — the standard page shell every console page composes with.
 * Header (title/subtitle/actions) + optional KPI strip + a resizable 60/40 split:
 * page content on the left, the page-specific FlowPanel on the right (resizable,
 * draggable handle). A bottom Stepper is shown unless `hideStepper`.
 *
 * Page owners (wave 2) return a default-exported component that renders
 * <PageFrame …>{page body}</PageFrame>. See docs/plan/SHELL_API.md.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { GripVertical, Maximize2, X } from 'lucide-react';
import type { PhaseId } from '../derive';
import type { FlowConfig } from './flowConfig';
import { FlowGraph } from '../pipeline/FlowGraph';
import '../pipeline/pipeline.css';
import { useLocation } from 'react-router-dom';
import { Architecture } from './Architecture';
import { FittedFlow } from './FittedFlow';
import './header-compact.css';

const KEY = 'orca-flow-split';
const MIN = 0.55, MAX = 0.84;

export function PageFrame({
  title, subtitle, actions, kpis, flow, children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  kpis?: ReactNode;
  flow?: FlowConfig;
  children?: ReactNode;
}) {
  const [split, setSplit] = useState<number>(() => {
    try { const v = Number(localStorage.getItem(KEY)); return v >= MIN && v <= MAX ? v : 0.72; } catch { return 0.72; }
  });
  const [expanded, setExpanded] = useState(false);
  const [graphTab, setGraphTab] = useState<'execution'|'architecture'>('execution');
  const graphDialog = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();
  useEffect(() => { if (expanded) graphDialog.current?.showModal(); }, [expanded]);
  const dragging = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => { try { localStorage.setItem(KEY, String(split)); } catch { /* storage optional */ } }, [split]);

  const onDown = useCallback(() => { dragging.current = true; document.body.style.userSelect = 'none'; document.body.style.cursor = 'col-resize'; }, []);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current || !rowRef.current) return;
      const r = rowRef.current.getBoundingClientRect();
      const frac = (e.clientX - r.left) / r.width;
      setSplit(Math.min(MAX, Math.max(MIN, frac)));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false; document.body.style.userSelect = ''; document.body.style.cursor = '';
      try { localStorage.setItem(KEY, String(split)); } catch { /* private mode */ }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); document.body.style.userSelect = ''; document.body.style.cursor = ''; };
  }, [split]);

  return (
    <div className="sh-page">
      <header className="sh-page__head sh-page__head--compact">
        <div className="sh-page__titles">
          <h1 className="sh-page__title">{title}</h1>
          {subtitle && <p className="sh-page__sub">{subtitle}</p>}
        </div>
        {actions && <div className="sh-page__actions">{actions}</div>}
      </header>

      {kpis && <div className="sh-kpis">{kpis}</div>}

      <div className={`sh-page__row${flow ? '' : ' sh-page__row--solo'}`} ref={rowRef}>
        <div className="sh-page__main" data-tour="page-content" style={flow ? { flexBasis: `${split * 100}%` } : undefined}>
          {children}
        </div>
        {flow && (
          <>
            <div className="sh-resizer" style={{ touchAction: 'none' }} onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); onDown(); }} onDoubleClick={() => setSplit(.72)} role="separator" aria-orientation="vertical" aria-label="Resize flow panel" aria-valuemin={MIN * 100} aria-valuemax={MAX * 100} aria-valuenow={Math.round(split * 100)} tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Home') { event.preventDefault(); setSplit(.72); }
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  setSplit((value) => Math.min(MAX, Math.max(MIN, value + (event.key === 'ArrowLeft' ? -0.05 : 0.05))));
                }
              }}>
              <GripVertical size={14} strokeWidth={2} />
            </div>
            <aside data-tour="execution-flow" className="sh-page__flow" style={{ flexBasis: `${(1 - split) * 100}%` }}>
              <div className="flow-expand"><button type="button" className="sh-btn sh-btn--sm" onClick={() => { setGraphTab('execution'); setExpanded(true); }}><Maximize2 size={13} /> Expand detailed flow</button></div>
              <FittedFlow config={flow} />
            </aside>
          </>
        )}
      </div>
      {expanded && <dialog ref={graphDialog} className="graph-dialog" aria-labelledby="graph-title" onCancel={(event) => { event.preventDefault(); setExpanded(false); }}>
        <header><div><h2 id="graph-title">ORCA-NTN · detailed flow</h2><p>Observed evidence and system methodology</p></div><button type="button" className="sh-btn" aria-label="Close detailed flow" onClick={() => setExpanded(false)}><X size={18} /></button></header>
        <div className="graph-tabs" role="group" aria-label="Diagram view"><button className="sh-btn" aria-pressed={graphTab === 'execution'} onClick={() => setGraphTab('execution')}>Execution</button><button className="sh-btn" aria-pressed={graphTab === 'architecture'} onClick={() => setGraphTab('architecture')}>Architecture & methodology</button></div>
        {graphTab === 'execution' ? <><p className="graph-legend">Observed = result received · Active = work in progress · Not observed = evidence unavailable. Hover or focus a node for details. Use zoom, then scroll to pan.</p><div className="graph-full"><FlowGraph truth={pathname === '/simulator'} /></div></> : <Architecture />}
      </dialog>}
    </div>
  );
}

export type { PhaseId };
