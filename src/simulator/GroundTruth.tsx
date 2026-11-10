import { Eye } from 'lucide-react';
import { useLiveStore } from '../store';
import { simClockIST } from '../shell/ContextStrip';
import { Panel, StatusBadge } from '../shell/primitives';
import type { InjectorInfo } from '../sim/injectors';

export function GroundTruth({ injectors }: { injectors: InjectorInfo[] }) {
  const truth = useLiveStore((s) => s.truth);
  const schedules = useLiveStore((s) => s.schedules);
  const entries = [...truth, ...schedules].filter((event) => event.audience === 'control')
    .sort((a, b) => b.seq - a.seq);
  return (
    <Panel title="Director ground truth" icon={Eye} right={<StatusBadge size="sm" tone="accent" word="Simulator only" />}>
      <p className="director-truth__note">These exercise conditions are not released to the operator agents.</p>
      {entries.length === 0 ? <p className="director-muted">No ground-truth events have been received.</p> : (
        <ol className="director-truth">
          {entries.map((event) => {
            const injector = typeof event.injector === 'string' ? event.injector : '';
            const label = typeof event.label === 'string' ? event.label : injectors.find((item) => item.id === injector)?.label ?? injector;
            const target = typeof event.target === 'string' ? event.target : 'Target unavailable';
            const classification = typeof event.truth_class === 'string' ? event.truth_class : undefined;
            return (
              <li key={`${event.kind}-${event.seq}`}>
                <time className="mono" dateTime={event.ts || undefined}>{simClockIST(event.ts)} IST</time>
                <div><strong>{label || String(event.kind)}</strong>
                  <span>{target}{classification ? ` / ${classification}` : ''}</span>
                  {typeof event.at_t === 'number' && <span>Scheduled for simulation minute {event.at_t}</span>}
                </div>
                <StatusBadge size="sm" tone="accent" word={event.kind === 'scheduled' ? 'Scheduled' : 'Recorded'} />
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
