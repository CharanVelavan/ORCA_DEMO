import { useMemo } from 'react';
import { Activity, CheckCircle2, CircleHelp, Clock3, RotateCcw, Timer, XCircle } from 'lucide-react';
import { deliveredMbps, serviceAvailabilityPct, timings, useDerived } from '../../derive';
import { finite, minuteDuration, object, reportingClocks, secondsDuration } from '../../policy/data';
import { AvailabilityChart, DeliveryChart } from '../../recovery/Charts';
import { availabilityAfter, availabilitySeries, observedOutageMinutes, publicRecoveryInput } from '../../recovery/data';
import { ConfigDiff, NotificationComparison, RolloutAndRollback, ServiceSummary, SiteSummary, ValidationChecks } from '../../recovery/RecoveryDetails';
import { FLOW_RECOVERY, PageFrame, Stat } from '../index';
import '../../recovery/recovery.css';

export default function Recovery() {
  const derived = useDerived();
  const data = useMemo(() => publicRecoveryInput(derived), [derived]);
  const elapsed = timings(data);
  const timing = object(data.summary?.timings);
  const after = availabilityAfter(data, availabilitySeries(data));
  const outage = observedOutageMinutes(data);
  const clocks = reportingClocks(data);
  const notified = clocks.filter((clock) => clock.notifyMin !== undefined || clock.notifiedBeforeStart);
  const notification = notified[0];
  const failures = finite(timing.failed_attempts);
  const rollback = timing.rollback_ok;
  const current = serviceAvailabilityPct(data);
  const delivered = deliveredMbps(data);
  return <PageFrame
    title="Recovery validation"
    subtitle="Inspect emulated service delivery, guarded changes and observed recovery evidence."
    flow={FLOW_RECOVERY}
    kpis={<>
      <Stat label="Outage duration" value={minuteDuration(outage)} icon={Timer} hint="Observed degradation to restoration" />
      <Stat label="Availability after" value={after === undefined ? 'Unavailable' : after.toFixed(1)} unit={after === undefined ? undefined : '%'} icon={Activity} hint="First sample at or after restoration" />
      <Stat label="Time to detect" value={minuteDuration(elapsed.detectMin)} icon={Clock3} hint="M3 class match; simulated ground truth, from summary timings" />
      <Stat label="Time to notify" value={notification?.notifiedBeforeStart ? 'Before trigger' : notification ? minuteDuration(notification.notifyMin) : clocks.length ? 'Not notified yet' : 'Unavailable'} icon={Clock3}
        hint={clocks.length ? `${notified.length} of ${clocks.length} reporting clocks notified${notification ? ` · first: ${notification.regime}` : ''}` : 'No reporting clock raised'} />
      <Stat label="Time to restore" value={minuteDuration(elapsed.restoreMin)} icon={Timer} />
      <Stat label="Approval latency" value={secondsDuration(timing.approval_latency_s)} icon={Clock3} hint="Simulated time" />
      <Stat label="Failed attempts" value={failures === undefined ? 'Unavailable' : failures} icon={RotateCcw} />
      <Stat label="Rollback outcome" value={rollback === true ? 'Reverted' : rollback === false ? 'Not verified' : 'Unavailable'} icon={rollback === true ? CheckCircle2 : rollback === false ? XCircle : CircleHelp} tone={rollback === true ? 'ok' : rollback === false ? 'critical' : 'unknown'} />
    </>}
  >
    <div className="recovery-current">
      <span data-testid="service-availability">Current reported demand coverage <strong data-testid="service-availability-value">{current === undefined ? 'Unavailable' : `${current.toFixed(1)}%`}</strong></span>
      <span data-testid="delivered-mbps">Current delivery <strong data-testid="delivered-mbps-value">{delivered === undefined ? 'Unavailable' : `${delivered.toFixed(2)} Mbps`}</strong></span>
      <span>Values are emulated estimates.</span>
    </div>
    <div className="recovery-grid recovery-grid--charts">
      <AvailabilityChart data={data} />
      <DeliveryChart data={data} />
    </div>
    <ServiceSummary data={data} />
    <SiteSummary data={data} />
    <div className="recovery-grid">
      <RolloutAndRollback data={data} />
      <ValidationChecks data={data} />
    </div>
    <ConfigDiff data={data} />
    <NotificationComparison data={data} />
  </PageFrame>;
}
