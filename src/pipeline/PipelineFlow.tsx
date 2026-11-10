import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Radio } from 'lucide-react';
import { useUi } from '../stage/uiStore';
import { scenarioName } from '../names';
import { BANDS, NODES } from './pipelineNodes';
import { pathFor } from './scenarioPaths';
import { usePipeline } from './pipelineStore';
import { FlowGraph, Subtitle } from './FlowGraph';
import './pipeline.css';

const ICON = { size: 15, strokeWidth: 1.5, 'aria-hidden': true } as const;

/** The flowchart panel: a slim header, the chart fitted to the panel, the subtitle line, and the guide pop-up. */
export function PipelineFlow({ truth }: { truth: boolean }) {
  const view = useUi((s) => s.pipeline);
  return (
    <section className={`pf ${view === 'full' ? 'pf--full' : ''}`} aria-label="How the system responds, step by step">
      <Header truth={truth} />
      <div className="pf-body"><FlowGraph truth={truth} /></div>
      <Subtitle />
    </section>
  );
}

function Header({ truth }: { truth: boolean }) {
  const { scenario, beats, mode, explainIdx, setMode, explainStep } = usePipeline();
  const view = useUi((s) => s.pipeline);
  // Demo exists only on the Stage; the Console and Control always follow the live engine.
  const run = useUi((s) => (window.location.pathname === '/stage' ? s.config.run : 'live'));
  const setPipeline = useUi((s) => s.setPipeline);
  const steps = pathFor(scenario)?.steps ?? [];
  const beat = beats[beats.length - 1];
  const explaining = mode === 'explain' && steps[explainIdx];
  const band = NODES.find((x) => x.id === (explaining ? steps[explainIdx].node : beat?.node))?.band ?? 'network';
  const n = BANDS.findIndex((b) => b.id === band) + 1;
  return (
    <header className="pf-head">
      <span className="pf-head__mode" data-mode={mode === 'explain' ? 'explain' : run}>
        {mode === 'explain' ? 'EXPLAIN' : run === 'demo' ? 'DEMO' : <><Radio {...ICON} size={12} /> LIVE</>}
      </span>
      <span className="pf-head__title">{scenarioName(scenario)}</span>
      <span className="pf-head__step mono">Step {n} of 7 · {BANDS[n - 1]?.title ?? ''}</span>
      <span className="pf-head__tools">
        <button className="pf-ib" aria-label="Previous step" title="Previous step (Left arrow)" onClick={() => explainStep(-1)}><ChevronLeft {...ICON} /></button>
        <button className="pf-ib" aria-label="Next step" title="Next step (Right arrow)" onClick={() => explainStep(1)}><ChevronRight {...ICON} /></button>
        {mode === 'explain' && <button className="pf-ib pf-ib--txt" onClick={() => setMode('live')} title="Back to the run (Esc)">Back to run</button>}
        <button className="pf-ib" aria-label={view === 'full' ? 'Exit full screen' : 'Full screen'} title={view === 'full' ? 'Exit full screen (Esc)' : 'Full screen (F)'} onClick={() => setPipeline(view === 'full' ? 'open' : 'full')}>{view === 'full' ? <Minimize2 {...ICON} /> : <Maximize2 {...ICON} />}</button>
      </span>
      {!truth && <span className="sr-only">Console view: ground truth hidden</span>}
    </header>
  );
}
