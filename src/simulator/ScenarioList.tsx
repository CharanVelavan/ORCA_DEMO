import { Layers } from 'lucide-react';
import type { ScenarioInfo, ScenarioKind } from '../sim/useCatalogue';
import { Panel, StatusBadge } from '../shell/primitives';
import type { Tone } from '../derive';

const KIND: Record<ScenarioKind, { word: string; tone: Tone }> = {
  normal: { word: 'Normal', tone: 'ok' },
  attack: { word: 'Attack', tone: 'critical' },
  fault: { word: 'Fault', tone: 'warn' },
  audit: { word: 'Audit', tone: 'accent' },
  mixed: { word: 'Mixed', tone: 'healing' },
};

export function ScenarioList({ scenarios, selected, active, onSelect, loading, error }: {
  scenarios: ScenarioInfo[]; selected: string; active?: string;
  onSelect: (id: string) => void; loading: boolean; error?: string;
}) {
  return (
    <Panel title="Scenarios" icon={Layers} className="director-scenarios"
      right={<button className="director-text-button" disabled title="Scenario authoring is not available">New scenario</button>}>
      {loading && <p className="director-muted" role="status">Loading scenarios.</p>}
      {error && <p className="director-error" role="status">Catalogue unavailable: {error}</p>}
      {!loading && scenarios.length === 0 && <p className="director-muted">No scenarios are available.</p>}
      <ul className="director-scenarios__list" aria-label="Exercise scenarios">
        {scenarios.map((scenario) => (
          <li key={scenario.id}>
            <button type="button" className={`director-scenario${selected === scenario.id ? ' is-selected' : ''}`}
              onClick={() => onSelect(scenario.id)} aria-pressed={selected === scenario.id}>
              <span className="director-scenario__top">
                <b className="director-scenario__id mono">{scenario.id}</b>
                <StatusBadge size="sm" {...KIND[scenario.kind]} />
              </span>
              <strong>{scenario.title}</strong>
              {scenario.story && <span className="director-scenario__story">{scenario.story}</span>}
              {active === scenario.id && <span className="director-scenario__current">Current session</span>}
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
