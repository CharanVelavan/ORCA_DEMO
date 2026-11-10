import { featurePairs, number, text } from '../operations/data';
import { latestM3Flag } from '../derive';
import type { LiveEvent } from '../types';

export type Criterion = { id: string; label: string; met: boolean | null; observed: string };
export type EvidenceView = { attack: Criterion[]; fault: Criterion[]; sampleCount: number; m3Event?: LiveEvent };

type Sample = Record<string, unknown>;

const fmt = (value: number, digits = 1) => value.toLocaleString('en-IN', { maximumFractionDigits: digits });

function siteSamples(ticks: LiveEvent[], site: string): Sample[] {
  return ticks.flatMap((tick) => {
    const sites = tick.sites && typeof tick.sites === 'object' ? tick.sites as Record<string, Sample> : {};
    return sites[site] ? [sites[site]] : [];
  });
}

function series(samples: Sample[], key: string): number[] {
  return samples.map((sample) => number(sample[key])).filter((value): value is number => value !== undefined);
}

/**
 * Attack-vs-fault checklist for one site, from observed signals only: tick telemetry, M1/M2/M3 events.
 * Ground truth (audience "control") is excluded. A criterion is null when the signal was never reported.
 * The checklist is a display aid; M3 makes the classification.
 */
export function attackFaultEvidence(events: LiveEvent[], ticks: LiveEvent[], site: string): EvidenceView {
  const observed = events.filter((event) => event.audience !== 'control');
  const visibleTicks = ticks.filter((tick) => tick.audience !== 'control');
  const forSite = (model: string) => [...observed].reverse().filter((event) => event.kind === 'model' && event.model === model && event.site === site);
  const m3Events = forSite('M3');
  const m3 = latestM3Flag({ models: observed.filter((event) => event.kind === 'model' && event.site === site) })
    ?? m3Events.find((event) => typeof event.class === 'string') ?? m3Events[0];
  const m3Features = [m3, ...m3Events].map((event) => featurePairs(event?.top_features)).find((rows) => rows.length) ?? [];
  const m1 = forSite('M1')[0];
  const m2 = forSite('M2').find((event) => number(event.horizon_min) !== undefined) ?? forSite('M2')[0];
  const samples = siteSamples(visibleTicks, site);

  const klass = text(m3?.class);
  const score = number(m3?.confidence);
  const mgmt = m3Features.find((feature) => /mgmt|cmd/i.test(feature.name));
  const mgmtValue = mgmt ? Number(mgmt.value) : undefined;
  const m1Score = number(m1?.score) ?? number(m1?.anomaly_score);
  const m1Threshold = number(m1?.threshold);
  const terminals = series(samples, 'terminals_up');
  const mains = samples.map((sample) => sample.mains_power).filter((value): value is boolean => typeof value === 'boolean');
  const snr = series(samples, 'snr_db');
  const margin = series(samples, 'link_margin_db');
  const battery = series(samples, 'battery_pct');
  const loss = series(samples, 'packet_loss');
  const lostTerminals = terminals.length > 1 && Math.min(...terminals) < terminals[0];
  const powerAlwaysOn = mains.length > 0 && mains.every(Boolean);
  const snrDrop = snr.length > 1 ? snr[0] - Math.min(...snr) : undefined;
  const minMargin = margin.length ? Math.min(...margin) : undefined;
  const batteryDrop = battery.length > 1 ? battery[0] - Math.min(...battery) : undefined;
  const lossRise = loss.length > 1 ? Math.max(...loss) - loss[0] : undefined;
  const minutes = number(m2?.horizon_min);

  const attack: Criterion[] = [
    { id: 'm3-attack', label: 'M3 assigns an attack class', met: klass === undefined ? null : klass.startsWith('attack'),
      observed: klass === undefined ? 'No M3 output for this site' : `${klass}${score !== undefined && klass !== 'normal' ? ` · ${fmt(score * 100)}% (uncalibrated model score)` : ''}` },
    { id: 'mgmt-cmds', label: 'Management-plane commands seen by M3', met: mgmtValue === undefined || Number.isNaN(mgmtValue) ? null : mgmtValue > 0,
      observed: mgmt ? `${mgmt.name} = ${mgmt.value}` : 'Not among reported M3 features' },
    { id: 'm1-anomaly', label: 'M1 anomaly score at or above threshold', met: m1Score === undefined || m1Threshold === undefined ? null : m1Score >= m1Threshold,
      observed: m1Score === undefined ? 'No M1 output for this site' : `${fmt(m1Score, 3)}${m1Threshold === undefined ? '' : ` vs ${m1Threshold}`}` },
    { id: 'terminals-power-on', label: 'Terminals lost while mains power stayed on', met: !terminals.length || !mains.length ? null : lostTerminals && powerAlwaysOn,
      observed: !terminals.length ? 'Not reported' : `${terminals[0]} → ${Math.min(...terminals)} terminals up · mains ${powerAlwaysOn ? 'on throughout' : mains.length ? 'interrupted' : 'not reported'}` },
  ];
  const fault: Criterion[] = [
    { id: 'snr-drop', label: 'Signal-to-noise ratio fell', met: snrDrop === undefined ? null : snrDrop > 0.5,
      observed: snrDrop === undefined ? 'Not reported' : `${fmt(snr[0])} → ${fmt(Math.min(...snr))} dB` },
    { id: 'margin-negative', label: 'Link margin went below 0 dB', met: minMargin === undefined ? null : minMargin < 0,
      observed: minMargin === undefined ? 'Not reported' : `lowest ${fmt(minMargin)} dB` },
    { id: 'mains-lost', label: 'Mains power lost', met: mains.length ? !powerAlwaysOn : null,
      observed: mains.length ? powerAlwaysOn ? 'On in every sample' : 'Off in at least one sample' : 'Not reported' },
    { id: 'battery-drain', label: 'Battery draining', met: batteryDrop === undefined ? null : batteryDrop > 0.5,
      observed: batteryDrop === undefined ? 'Not reported' : `${fmt(battery[0])} → ${fmt(Math.min(...battery))}%` },
    { id: 'm2-forecast', label: 'M2 forecasts a failure', met: m2 ? minutes !== undefined : null,
      observed: !m2 ? 'No M2 output for this site' : minutes !== undefined ? `${minutes} min to failure (${text(m2.metric) ?? 'metric unavailable'})` : 'No failure in the forecast window' },
  ];
  if (lossRise !== undefined) fault.splice(2, 0, { id: 'loss-rise', label: 'Packet loss rose', met: lossRise > 0.005, observed: `${fmt(loss[0] * 100)} → ${fmt(Math.max(...loss) * 100)}%` });
  return { attack, fault, sampleCount: samples.length, m3Event: m3 };
}
