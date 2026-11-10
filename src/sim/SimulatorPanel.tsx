import { useState } from 'react';
import { Activity, CircleHelp, CloudRain, Eye, Layers, Loader, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUi } from '../stage/uiStore';
import type { ExerciseConfig } from '../stage/uiStore';
import { startExercise } from './actions';
import { CATEGORY_LABEL, INJECTOR_ICONS, groupInjectors } from './injectors';
import { useCatalogue } from './useCatalogue';
import type { ScenarioKind } from './useCatalogue';
import { scenarioName } from '../names';
import './sim.css';

const KIND: Record<ScenarioKind, { label: string; Icon: LucideIcon; tone: string }> = {
  normal: { label: 'Normal', Icon: ShieldCheck, tone: 'ok' },
  attack: { label: 'Attack', Icon: ShieldAlert, tone: 'critical' },
  fault: { label: 'Fault', Icon: CloudRain, tone: 'warn' },
  audit: { label: 'Audit', Icon: Eye, tone: 'accent' },
  mixed: { label: 'Mixed', Icon: Layers, tone: 'healing' },
};
const SPEEDS: { value: ExerciseConfig['speed']; text: string }[] = [{ value: 0.5, text: 'Slow' }, { value: 1, text: 'Normal' }, { value: 2, text: 'Fast' }];

export function KindBadge({ kind }: { kind: ScenarioKind }) {
  const k = KIND[kind] ?? { label: kind, Icon: CircleHelp, tone: 'unknown' };
  return <span className={`sim-kind sim-tone-${k.tone}`}><k.Icon size={14} strokeWidth={1.5} aria-hidden />{k.label}</span>;
}

function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; text: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="sim-field">
      <span className="sim-field-label" id={`sim-seg-${label}`}>{label}</span>
      <div className="sim-seg" role="radiogroup" aria-labelledby={`sim-seg-${label}`}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value}
            className={`sim-seg-btn${o.value === value ? ' is-on' : ''}`} onClick={() => onChange(o.value)}>{o.text}</button>
        ))}
      </div>
    </div>
  );
}

/** State A. Fills its parent (34% wide, full height). */
export function SimulatorPanel() {
  const config = useUi((s) => s.config);
  const setConfig = useUi((s) => s.setConfig);
  const { scenarios, injectors } = useCatalogue();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setStarting(true); setError(null);
    try { await startExercise(config); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not start the exercise.'); }
    finally { setStarting(false); }
  };

  return (
    <section className="sim-panel" aria-label="Simulator">
      <header className="sim-head">
        <h2 className="sim-title">Simulator</h2>
        <span className="sim-tag">Ground truth, director only</span>
      </header>

      <div className="sim-scroll">
        <ul className="sim-cards" role="radiogroup" aria-label="Scenario">
          {scenarios.map((s) => {
            const on = s.id === config.scenario;
            return (
              <li key={s.id}>
                <button type="button" role="radio" aria-checked={on} className={`sim-card${on ? ' is-on' : ''}`}
                  onClick={() => setConfig({ scenario: s.id })}>
                  <span className="sim-card-top">
                    <span className="sim-chip mono">{s.id}</span>
                    <span className="sim-card-title" title={s.title}>{scenarioName(s.id, s.title)}</span>
                    <KindBadge kind={s.kind} />
                  </span>
                  <span className="sim-sites mono">{s.sites.join(' ')}</span>
                  <span className="sim-story">{s.story}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="sim-palette">
          <h3 className="sim-sub">Attack palette <span className="sim-sub-note">Available after Start</span></h3>
          {groupInjectors(injectors).map((g) => (
            <div key={g.category} className="sim-pal-group">
              <span className="sim-pal-label">{CATEGORY_LABEL[g.category]}</span>
              <div className="sim-pal-grid">
                {g.items.map((i) => {
                  const Icon = INJECTOR_ICONS[i.id] ?? Activity;
                  return (
                    <button key={i.id} type="button" disabled title="Available after Start" className="sim-pal-btn" aria-label={`${i.label}. Available after Start`}>
                      <Icon size={18} strokeWidth={1.5} aria-hidden />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="sim-foot">
        <div className="sim-settings">
          <Segmented label="Mode" value={config.run} onChange={(run) => setConfig({ run })}
            options={[{ value: 'demo', text: 'Demo (recorded)' }, { value: 'live', text: 'Live (AI model)' }]} />
          <Segmented label="Speed" value={config.speed} onChange={(speed) => setConfig({ speed })} options={SPEEDS} />
        </div>
        <p className="sim-mode-note">{config.run === 'demo'
          ? 'Replays a recorded run of this scenario. Same result every time, no engine needed.'
          : 'Runs the engine now with the AI model. Rules are always on; the knowledge base is India.'}</p>
        <button type="button" className="sim-primary" onClick={start} disabled={starting} aria-busy={starting}>
          {starting ? <><Loader size={16} strokeWidth={1.5} className="sim-spin" aria-hidden />Starting</> : <>{config.run === 'demo' ? 'Play demo' : 'Start live run'}</>}
        </button>
        {error && <p className="sim-error" role="alert">{error}</p>}
        <p className="sim-note">All links and figures are EMULATED.</p>
      </footer>
    </section>
  );
}
