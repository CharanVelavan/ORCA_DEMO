import { Boxes } from 'lucide-react';
import { forecastText, models, useDerived, type ModelView, type Tone } from '../derive';
import { Panel, StatusBadge } from '../shell/primitives';

function modelStatus(model: ModelView): { word: string; tone: Tone } {
  if (!model.event) return { word: 'Awaiting output', tone: 'unknown' };
  if (typeof model.event.validation_error === 'string') return { word: 'Invalid allocation', tone: 'critical' };
  if (model.event.state === 'warming') return { word: 'Warming up', tone: 'unknown' };
  if (model.event.state === 'unavailable') return { word: 'Unavailable', tone: 'unknown' };
  if (model.abstain || model.event.state === 'unsure') return { word: 'Uncertain', tone: 'warn' };
  if (model.event.state === 'flagged') return { word: 'Flagged', tone: 'critical' };
  if (model.event.state === 'replan') return { word: 'Replan', tone: 'warn' };
  if (model.event.state === 'ok' || model.event.state === 'normal') return { word: 'Normal', tone: 'ok' };
  return { word: 'Output received', tone: 'accent' };
}

function ModelValue({ model }: { model: ModelView }) {
  if (!model.event) return <span>Waiting for a model event.</span>;
  if (model.id === 'M1') return <span>Score: {model.score === undefined ? 'Unavailable' : model.score.toFixed(2)}</span>;
  if (model.id === 'M2') return <span>{forecastText(model)}</span>;
  if (model.id === 'M3') return <span>
    {model.abstain ? 'Abstain' : model.klass ?? 'Class unavailable'}
    {model.confidence !== undefined && !model.abstain ? ` (${(model.confidence * 100).toFixed(1)}% uncalibrated model score)` : ''}
    {model.abstain && typeof model.event.note === 'string' && model.event.note && <small>{model.event.note}</small>}
  </span>;
  if (model.id === 'M4') return (
    <div>
      <span>Solution: {model.solution ?? (model.event.solver_status === 'not_needed' ? 'No reallocation needed' : 'Unavailable')}</span>
      {typeof model.event.validation_error === 'string' && <p role="alert">{model.event.validation_error}</p>}
      {model.allocation?.length ? (
        <ul className="director-model__allocation">
          {model.allocation.map((row, i) => <li key={`${row.site}-${row.service}-${i}`}>
            {row.site} / {row.service}: {row.mbps} Mbps
          </li>)}
        </ul>
      ) : model.event.solver_status !== 'not_needed' && <span className="director-model__none">No allocation reported.</span>}
    </div>
  );
  return null;
}

export function ModelPanel() {
  const d = useDerived();
  return (
    <Panel title="AI models (live)" icon={Boxes}>
      <ul className="director-models">
        {models(d).map((model) => (
          <li key={model.id} className="director-model">
            <div className="director-model__head">
              <span className="director-id mono">{model.id}</span>
              <strong>{model.label}</strong>
              <StatusBadge size="sm" {...modelStatus(model)} />
            </div>
            <div className="director-model__value"><ModelValue model={model} /></div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
