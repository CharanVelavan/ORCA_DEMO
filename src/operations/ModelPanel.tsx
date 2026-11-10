import { BrainCircuit } from 'lucide-react';
import { forecastText, models, type DeriveInput } from '../derive';
import { Empty, Panel, Sparkline, StatusBadge } from '../shell';

export function ModelPanel({ data }: { data: DeriveInput }) {
  const list = models(data);
  return (
    <Panel title="AI models" icon={BrainCircuit} right={<span className="ops-subtle">Models, not agents</span>}>
      <div className="ops-models">
        {list.map((model) => {
          const state = model.event?.state;
          const invalid = typeof model.event?.validation_error === 'string';
          const tone = invalid ? 'critical' : !model.event || state === 'warming' || state === 'unavailable' ? 'unknown' : state === 'flagged' ? 'critical' : state === 'unsure' || model.abstain ? 'warn' : state === 'ok' || state === 'normal' ? 'ok' : 'accent';
          const word = invalid ? 'Invalid allocation' : !model.event ? 'Awaiting output' : state === 'warming' ? 'Warming up' : state === 'unavailable' ? 'Unavailable' : state === 'flagged' ? 'Flagged' : state === 'unsure' || model.abstain ? 'Abstained' : state === 'ok' || state === 'normal' ? 'Reported' : 'Updated';
          return (
            <div className="ops-model" key={model.id}>
              <span className="ops-model__id mono">{model.id}</span>
              <div className="ops-model__body">
                <div className="ops-model__head"><strong>{model.label}</strong><StatusBadge tone={tone} word={word} size="sm" /></div>
                <div className="ops-model__value">
                  {model.id === 'M1' && (model.score === undefined ? 'Score unavailable' : `Score ${model.score.toFixed(3)}`)}
                  {model.id === 'M2' && (model.minutesToFailure !== undefined
                    ? <span><strong className="ops-model__big">{model.minutesToFailure}</strong> min to failure</span>
                    : forecastText(model))}
                  {model.id === 'M2' && typeof model.event?.metric === 'string' && <span className="ops-subtle"> · {model.event.metric}{typeof model.event?.site === 'string' ? ` at ${model.event.site}` : ''}</span>}
                  {model.id === 'M3' && (model.abstain ? 'Abstain' : model.klass ?? 'Class unavailable')}
                  {model.id === 'M3' && model.confidence !== undefined && !model.abstain && ` (${(model.confidence * 100).toFixed(1)}% uncalibrated model score)`}
                  {model.id === 'M4' && (model.solution ? <StatusBadge tone={model.solution === 'optimal' ? 'ok' : 'accent'} word={model.solution === 'optimal' ? 'Optimal' : 'Feasible'} size="sm" /> : model.event?.solver_status === 'not_needed' ? 'No reallocation needed' : 'Allocation status unavailable')}
                  {model.id === 'M4' && typeof model.event?.method === 'string' && model.event.method !== 'none' && <span className="ops-subtle"> {model.event.method}</span>}
                </div>
                {model.id === 'M3' && model.abstain && typeof model.event?.note === 'string' && model.event.note && <p className="ops-subtle">{model.event.note}</p>}
                {model.id === 'M4' && typeof model.event?.validation_error === 'string' && <p className="ops-subtle" role="alert">{model.event.validation_error}</p>}
                {model.id === 'M2' && model.spark && model.spark.length > 1 && (
                  <details className="ops-model__history">
                    <summary>Forecast history <Sparkline points={model.spark} width={66} height={18} /></summary>
                    <p className="mono">{model.spark.join(', ')} min</p>
                  </details>
                )}
                {model.id === 'M4' && model.allocation && model.allocation.length > 0 && (
                  <div className="ops-alloc">
                    <table className="ops-table">
                      <thead><tr><th>Site</th><th>Service</th><th>Demand</th><th>Granted Mbps</th></tr></thead>
                      <tbody>{model.allocation.map((row, i) => <tr key={`${row.site}-${row.service}-${i}`} className={row.demand !== undefined && row.mbps + 1e-6 < row.demand ? 'is-shed' : undefined}>
                        <td className="mono">{row.site}</td><td>{row.service}</td><td>{row.demand === undefined ? '—' : row.demand.toFixed(2)}</td><td>{row.mbps.toFixed(2)}</td>
                      </tr>)}</tbody>
                    </table>
                  </div>
                )}
                {model.id === 'M4' && model.event && model.event.solver_status !== 'not_needed' && !model.allocation?.length && <Empty>No allocation rows reported.</Empty>}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
