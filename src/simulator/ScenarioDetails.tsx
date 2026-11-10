import { FileText } from 'lucide-react';
import type { ScenarioInfo } from '../sim/useCatalogue';
import { simClockIST } from '../shell/ContextStrip';
import { Panel } from '../shell/primitives';

export function ScenarioDetails({ scenario }: { scenario?: ScenarioInfo }) {
  return (
    <Panel title="Scenario details" icon={FileText} right={scenario && <b className="director-id mono">{scenario.id}</b>}>
      {!scenario ? <p className="director-muted">Select a scenario to see its details.</p> : (
        <dl className="director-details">
          <div><dt>Title</dt><dd>{scenario.title}</dd></div>
          <div><dt>Type</dt><dd>{scenario.kind}</dd></div>
          <div><dt>Region</dt><dd>{scenario.region ? `${scenario.region.replace(/\s*\(emulated\)/i, '')} (Emulated)` : 'Unavailable'}</dd></div>
          <div><dt>Scenario sites</dt><dd>{scenario.sites.length ? scenario.sites.join(', ') : 'Not specified'}</dd></div>
          <div><dt>Start</dt><dd>{scenario.start ? `${simClockIST(scenario.start)} IST` : 'Unavailable'}</dd></div>
          <div><dt>Objective</dt><dd>{scenario.objective ?? 'Not provided in the catalogue.'}</dd></div>
        </dl>
      )}
    </Panel>
  );
}
