import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './mode-guide.css';

const modes = [
  {
    title: 'Mock simulation',
    subtitle: 'Run a fresh exercise offline',
    body: 'The simulator generates a new run. M1–M4 and the deterministic rules process its telemetry. Agent replies use deterministic stand-ins, so Qwen is not called.',
    interaction: 'You can inject emulated conditions and review guarded actions.',
  },
  {
    title: 'Live endpoint / Qwen',
    subtitle: 'Run a fresh exercise with model inference',
    body: 'The simulator, models and rules run as usual. Agents call the OpenAI-compatible endpoint configured in Model connection to assess evidence and propose actions.',
    interaction: 'Choose a scenario, read its briefing, then start the exercise to apply the endpoint. Connection errors remain visible.',
  },
  {
    title: 'Recorded replay',
    subtitle: 'Inspect a saved run',
    body: 'The dashboard plays events already stored in a recording. Playback does not generate a fresh incident or call Qwen. Its results reflect the source recorded at that time.',
    interaction: 'Read-only: pause, seek and inspect. Injections and approvals are disabled.',
  },
];

export function SessionModeGuide({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="mode-guide" aria-labelledby="mode-guide-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header><div><span>RUN MODES</span><h2 id="mode-guide-title">Choose how the exercise runs</h2></div><button type="button" className="sh-btn" aria-label="Close run mode guide" onClick={onClose}><X size={18} /></button></header>
    <p>Every network link is emulated. The mode tells you where agent responses and dashboard events come from.</p>
    <div className="mode-guide-list">{modes.map((mode, index) => <section key={mode.title}>
      <span className="mode-guide-number">0{index + 1}</span><h3>{mode.title}</h3><strong>{mode.subtitle}</strong><p>{mode.body}</p><p className="mode-guide-interaction">{mode.interaction}</p>
    </section>)}</div>
    <p className="mode-guide-footnote">Changing the mode selector prepares the next run. The current run’s source is displayed separately. Cached model responses, when configured on the backend, are labelled as cached model replay.</p>
    <button type="button" className="sh-btn sh-btn--primary" onClick={onClose}>Understood</button>
  </dialog>;
}
