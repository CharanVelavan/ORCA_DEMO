import { useState } from 'react';
import { Activity, Search, ShieldAlert } from 'lucide-react';
import { deliveredMbps, models, networkHealthPct, pctView, scenarioCtx, sites, sitesAffected, latestM3Flag } from '../../derive';
import { AffectedAssets, AttackFaultEvidence, EvidenceTimeline, Hypotheses, ModelContext } from '../../investigation/EvidencePanels';
import { TelemetryPanel } from '../../investigation/TelemetryPanel';
import { NetworkImpact } from '../../investigation/NetworkImpact';
import { ModelPanel } from '../../operations/ModelPanel';
import { NetworkPanel } from '../../operations/NetworkPanel';
import { ReadOnlyNotice } from '../../operations/ReadOnlyNotice';
import { useOperatorData } from '../../operations/useOperatorData';
import { FLOW_INVESTIGATION, PageFrame, Stat, StatusBadge, simClockIST } from '../index';
import '../../operations/operations.css';

export default function Investigation() {
  const data = useOperatorData();
  const [pickedSite, setPickedSite] = useState('');
  const siteViews = sites(data);
  const m3 = models(data).find((model) => model.id === 'M3');
  const modelSite = typeof m3?.event?.site === 'string' ? m3.event.site : '';
  const alertSite = [...(data.alerts ?? [])].reverse().find((event) => event.audience !== 'control' && typeof event.site === 'string' && siteViews.some((item) => item.id === event.site))?.site;
  const preferred = m3?.klass && m3.klass !== 'normal' && modelSite ? modelSite : typeof alertSite === 'string' ? alertSite : modelSite;
  const site = pickedSite || (siteViews.some((item) => item.id === preferred) ? preferred : siteViews[0]?.id ?? '');
  const affected = sitesAffected(data);
  const observed = siteViews.filter((item) => item.state !== 'unknown').length;
  const throughput = deliveredMbps(data);
  const firstTick = data.tickHistory?.[0];
  const baseline = firstTick ? deliveredMbps({ ...data, tickHistory: [firstTick] }) : undefined;
  const throughputDelta = throughput !== undefined && baseline !== undefined ? throughput - baseline : undefined;
  const flag = latestM3Flag({ ...data, models: (data.models ?? []).filter((event) => event.audience !== 'control') });
  const flagClass = flag ? String(flag.class) : undefined;
  const flagScore = flag && typeof flag.confidence === 'number' ? flag.confidence : undefined;
  const ctx = scenarioCtx(data);
  const status = !m3?.event ? 'Awaiting M3' : m3.event.state === 'warming' ? 'Warming up' : m3.abstain ? 'Abstained' : m3.event.state === 'flagged' ? 'Flagged' : 'Reported';
  return (
    <PageFrame title="Incident investigation" subtitle={ctx.title ? `${ctx.title}. Compare observed signals, model output and the emulated network.` : 'Compare observed signals, model output and the emulated network.'}
      actions={<label className="ops-field ops-field--inline">Site
        <select value={site} onChange={(event) => setPickedSite(event.target.value)}>{siteViews.map((item) => <option key={item.id} value={item.id}>{item.id} - {item.area}</option>)}</select>
      </label>}
      flow={FLOW_INVESTIGATION}
      kpis={<>
        <Stat label="Incident" value={ctx.id ?? 'Unavailable'} hint={ctx.title} icon={Search} />
        <Stat label="M3 latest flag" value={flagClass ?? 'None raised'} hint={flag ? `${typeof flag.site === 'string' ? `${flag.site} · ` : ''}${simClockIST(flag.ts)} IST · now ${m3?.abstain ? 'abstain' : m3?.klass ?? 'unavailable'}` : `Now ${m3?.abstain ? 'abstain' : m3?.klass ?? 'unavailable'}`} icon={ShieldAlert} tone={flag ? 'critical' : 'unknown'} />
        <Stat label="M3 model score" hint="Uncalibrated model probability" value={flagScore === undefined ? 'Unavailable' : (flagScore * 100).toFixed(1)} unit={flagScore === undefined ? undefined : '%'} />
        <Stat label="Assessment" value={<StatusBadge tone={!m3?.event || m3.event.state === 'warming' ? 'unknown' : m3.abstain ? 'warn' : m3.event.state === 'flagged' ? 'critical' : 'accent'} word={status} />} />
        <Stat label="Affected sites" testid="affected-sites" value={observed ? `${affected.affected} / ${affected.total}` : 'Unavailable'} hint={observed && observed < affected.total ? `${observed} of ${affected.total} sites reported` : undefined} />
        <Stat label="Network health" testid="network-health" {...pctView(networkHealthPct(data))} icon={Activity} />
        <Stat label="Delivered" testid="delivered-mbps" value={throughput === undefined ? 'Unavailable' : throughput.toFixed(2)} unit={throughput === undefined ? undefined : 'Mbps'} hint={throughputDelta === undefined ? undefined : `${throughputDelta >= 0 ? '+' : ''}${throughputDelta.toFixed(2)} Mbps from first sample`} />
      </>}
    >
      <div className="inv-view">
        <ReadOnlyNotice />
        <div className="inv-top"><AffectedAssets data={data} /><NetworkPanel /></div>
        <div className="inv-analysis"><TelemetryPanel data={data} site={site} /><div className="ops-stack"><ModelContext data={data} /><ModelPanel data={data} /></div></div>
        <div className="inv-evidence-row"><AttackFaultEvidence data={data} site={site} /><Hypotheses data={data} site={site} /></div>
        <div className="inv-bottom"><EvidenceTimeline data={data} site={site} /><NetworkImpact data={data} /></div>
      </div>
    </PageFrame>
  );
}
