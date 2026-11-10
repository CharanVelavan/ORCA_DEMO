import { useEffect, useState } from 'react';
import { tabKeys } from '../tabKeys';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Pause, Play, SkipForward } from 'lucide-react';
import { scenarioCtx, useDerived } from '../../derive';
import { isReadOnlyNow } from '../../sim/readOnly';
import { useCatalogue } from '../../sim/useCatalogue';
import { ClockBar } from '../../simulator/ClockBar';
import { GroundTruth } from '../../simulator/GroundTruth';
import { InjectionToolbar } from '../../simulator/InjectionToolbar';
import { ModelPanel } from '../../simulator/ModelPanel';
import { NetworkViewport } from '../../simulator/NetworkViewport';
import { ScenarioList } from '../../simulator/ScenarioList';
import { ScenarioGuide } from '../../simulator/ScenarioGuide';
import { useDirectorControls } from '../../simulator/useDirectorControls';
import { useLiveStore } from '../../store';
import { PageFrame, simClockIST } from '../index';
import { StatusBadge } from '../primitives';
import '../../simulator/simulator.css';
import '../../simulator/workspace.css';

type Tab = 'guide' | 'models' | 'truth' | 'settings';
const TABS: { id: Tab; label: string }[] = [{ id: 'guide', label: 'Guide' }, { id: 'models', label: 'Models' }, { id: 'truth', label: 'Truth' }, { id: 'settings', label: 'Settings' }];

export default function Simulator() {
  const d = useDerived();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const source = useLiveStore(state => state.source);
  const fake = new URLSearchParams(search).get('fake') === '1';
  const replay = source === 'replay';
  const readOnly = fake || replay;
  const controls = useDirectorControls(readOnly);
  const catalogue = useCatalogue();
  const ctx = scenarioCtx(d);
  const preview = new URLSearchParams(search).get('scenario')?.toUpperCase();
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState<Tab>('guide');
  const scenarios = fake ? catalogue.scenarios.filter(scenario => catalogue.fixtureScenarios?.includes(scenario.id)) : catalogue.scenarios;
  const detail = scenarios.find(scenario => scenario.id === selected);
  useEffect(() => {
    if (!catalogue.loading) setSelected(preview && scenarios.some(scenario => scenario.id === preview) ? preview : ctx.id && scenarios.some(scenario => scenario.id === ctx.id) ? ctx.id : scenarios[0]?.id ?? '');
  }, [ctx.id, catalogue.scenarios, catalogue.fixtureScenarios, catalogue.loading, fake, preview]);
  function startSelected() {
    if (!selected || replay || useLiveStore.getState().source === 'replay') return;
    if (fake) { const params = new URLSearchParams(search); params.set('scn', selected); navigate(`${pathname}?${params.toString()}`); return; }
    if (!isReadOnlyNow() && controls.canCommand) void controls.start(selected);
  }
  const ready = Boolean(controls.llm && controls.kb && controls.rules !== null && controls.sync !== null);
  const canStart = Boolean(selected && !catalogue.loading && !replay && (fake || controls.canCommand && ready));
  const clockDisabled = !controls.canCommand || controls.running === null;
  return <div className="simulator-workspace"><PageFrame title="Simulator" subtitle="Direct the exercise. Inspect the truth. Follow the response." actions={<><StatusBadge size="sm" tone={controls.connected ? 'ok' : 'unknown'} word={replay ? 'Replay · read-only' : fake ? 'Fixture · read-only' : controls.connected ? 'Engine connected' : 'Engine unavailable'} /><Link className="sh-btn" to={`/operations${search}`}>Open Operator <ArrowRight size={15} /></Link></>}>
    <div className="simulator-desk">
      <aside className="simulator-catalogue" data-tour="simulator-scenarios"><div className="simulator-section-label">Choose the exercise</div><div className="simulator-catalogue__scroll"><ScenarioList scenarios={scenarios} selected={selected} active={ctx.id} onSelect={setSelected} loading={catalogue.loading} error={catalogue.error} /></div><div className="simulator-launch"><button type="button" className="sh-btn sh-btn--primary" disabled={!canStart} onClick={startSelected}>{controls.busy ? 'Starting…' : fake && !replay ? 'Load fixture' : 'Start selected exercise'}<Play size={15} /></button><p>{selected === ctx.id ? 'Starting again resets this exercise.' : 'Selection previews the story. Start applies it.'}</p></div></aside>
      <section className="simulator-center"><div className="simulator-map" data-tour="simulator-network"><NetworkViewport metadata={catalogue.sites} /></div><div className="simulator-injection" data-tour="simulator-injection"><InjectionToolbar injectors={catalogue.injectors} targets={catalogue.targets} disabled={!controls.canCommand} onInject={(kind, target, duration) => { if (!readOnly && !isReadOnlyNow() && controls.canCommand) void controls.inject(kind, target, duration); }} /></div><div className="simulator-transport"><div className="simulator-transport__buttons"><button type="button" className="director-icon-button director-icon-button--primary" disabled={clockDisabled} onClick={() => { if (!readOnly && !isReadOnlyNow()) void controls.updateClock(controls.running ? 'pause' : 'play'); }} aria-label={controls.running ? 'Pause simulation' : 'Play simulation'}>{controls.running ? <Pause size={16} /> : <Play size={16} />}</button><button type="button" className="director-icon-button" disabled={clockDisabled || controls.running !== false} onClick={() => { if (!readOnly && !isReadOnlyNow()) void controls.updateClock('step'); }} aria-label="Advance one simulation minute"><SkipForward size={16} /></button></div><div><strong className="mono">{simClockIST(d.ts)} IST</strong><small>{typeof d.t === 'number' ? `T+${d.t} min · ${controls.running === null ? 'clock unavailable' : controls.running ? 'running' : 'paused'}` : 'Awaiting simulation clock'}</small></div><label>Speed<select value={controls.speed ?? ''} disabled={clockDisabled} onChange={event => { if (!readOnly && !isReadOnlyNow()) controls.changeSpeed(Number(event.target.value)); }}>{controls.speed === null && <option value="">—</option>}{[.5, 1, 2, 5, 10].map(speed => <option key={speed} value={speed}>{speed}×</option>)}</select></label><span className="simulator-transport__boundary">Emulated network<br />Director controls</span></div>{(controls.error || controls.notice || controls.connectionError) && <p className={controls.error || controls.connectionError ? 'simulator-command-error' : 'simulator-command-notice'} role="status">{controls.error ?? controls.connectionError ?? controls.notice}</p>}</section>
      <aside className="simulator-inspector"><div className="workspace-tabs" role="tablist" aria-label="Simulator inspector">{TABS.map((item, index) => <button key={item.id} id={`simulator-tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls="simulator-inspector-panel" tabIndex={tab === item.id ? 0 : -1} onKeyDown={event => tabKeys(event,TABS.map(t => t.id),index,setTab,'simulator-tab-')} onClick={() => setTab(item.id)}>{item.label}</button>)}</div><div className="simulator-inspector__body" id="simulator-inspector-panel" role="tabpanel" aria-labelledby={`simulator-tab-${tab}`} tabIndex={0}>{tab === 'guide' && <ScenarioGuide scenario={detail} />}{tab === 'models' && <ModelPanel />}{tab === 'truth' && <GroundTruth injectors={catalogue.injectors} />}{tab === 'settings' && <ClockBar controls={controls} readOnly={readOnly} fake={fake} replay={replay} search={search} />}</div></aside>
    </div>
  </PageFrame></div>;
}
