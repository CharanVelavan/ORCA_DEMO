import { Clock3 } from 'lucide-react';
import type { DeriveInput } from '../derive';
import { Code, Empty, Panel, StatusBadge } from '../shell';
import { minuteDuration, remainingText, reportingClocks, timeIST, type RecordInfo } from './data';

export function ReportingClocks({ data, records }: { data: DeriveInput; records: RecordInfo[] }) {
  const clocks = reportingClocks(data);
  const byId = new Map(records.map((record) => [record.id, record]));
  return (
    <Panel className="reporting-clocks" title="Reporting clocks" icon={Clock3} right={<span className="policy-muted">As of {timeIST(data.ts)}</span>}>
      {!clocks.length ? <Empty>No reporting clocks raised yet. Applicability remains unassessed.</Empty> : (
        <div className="policy-clock-list" tabIndex={0} role="region" aria-label="Reporting clock list">
          {clocks.map((clock) => {
            const tone = clock.status === 'met' ? 'ok' : clock.status === 'missed' || clock.status === 'overdue' ? 'critical' : clock.status === 'open' ? 'warn' : 'unknown';
            const word = clock.status === 'overdue' ? 'Overdue; notification unobserved' : clock.status === 'unavailable' ? 'Status unavailable' : clock.status;
            return (
              <article className="policy-clock" key={`${clock.regime}-${clock.event.seq}`}>
                <div className="policy-clock__top">
                  <div>
                    <strong>{clock.recordIds.map((id) => byId.get(id)?.instrument).find(Boolean) ?? clock.regime}</strong>
                    <div className="policy-muted">{clock.regime}</div>
                  </div>
                  <StatusBadge tone={tone} word={word} size="sm" />
                </div>
                <div className="policy-clock__facts">
                  <div><span>Trigger</span><strong>{clock.trigger ?? 'Unavailable'}</strong></div>
                  <div><span>Started</span><strong>{timeIST(clock.start)}</strong></div>
                  <div><span>Deadline</span><strong>{timeIST(clock.due)}</strong></div>
                  <div><span>{clock.notifiedAt ? 'Notified' : 'Countdown'}</span><strong>{clock.notifiedAt ? timeIST(clock.notifiedAt) : remainingText(clock)}</strong></div>
                </div>
                {(clock.notifiedAt || clock.windowMin !== undefined) && (
                  <div className="policy-muted">
                    {clock.notifiedBeforeStart ? 'Notification preceded the trigger' : clock.notifiedAt ? `Time to notify: ${minuteDuration(clock.notifyMin)}` : 'Not notified yet'}
                    {' / '}window: {minuteDuration(clock.windowMin)}
                  </div>
                )}
                <div className="policy-records">
                  {clock.recordIds.length ? clock.recordIds.map((id) => <Code key={id}>{id}</Code>) : <span className="policy-muted">Record id unavailable</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
