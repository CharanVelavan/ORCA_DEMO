import { useState } from 'react';
import { tabKeys } from '../tabKeys';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Activity, Link2, ShieldAlert } from 'lucide-react';
import { deliveredMbps, hasTelemetry, models, networkHealthPct, pctView, sites, sitesAffected } from '../../derive';
import { KillSwitchButton } from '../../inbox/TopBarControls';
import { AgentActivity } from '../../operations/AgentActivity';
import { AlertFeed } from '../../operations/AlertFeed';
import { TelemetryChart } from '../../operations/TelemetryChart';
import { useOperationsCatalogue } from '../../operations/data';
import { ModelPanel } from '../../operations/ModelPanel';
import { NetworkPanel } from '../../operations/NetworkPanel';
import { ReadOnlyNotice } from '../../operations/ReadOnlyNotice';
import { useOperatorData } from '../../operations/useOperatorData';
import { Approvals, PolicyEvidence, RemediationTimeline, TopEvidence } from '../../operations/ResponseEvidence';
import { FLOW_RESPONSE, PageFrame, Stat, StatusBadge } from '../index';
import '../../operations/operations.css';
import '../../operations/workspace.css';

type Tab = 'evidence' | 'agents' | 'models' | 'delivery' | 'recovery';
const TABS: { id: Tab; label: string }[] = [{ id: 'evidence', label: 'Evidence' }, { id: 'agents', label: 'Agent activity' }, { id: 'models', label: 'M1–M4' }, { id: 'delivery', label: 'Service delivery' }, { id: 'recovery', label: 'Recovery' }];

export default function Operations() {
  const data = useOperatorData();
  const catalogue = useOperationsCatalogue();
  const { search } = useLocation();
  const [tab, setTab] = useState<Tab>('evidence');
  const affected = sitesAffected(data);
  const delivered = deliveredMbps(data);
  const health = networkHealthPct(data);
  const m3 = models(data).find(model => model.id === 'M3');
  const observed = sites(data).filter(site => site.state !== 'unknown').length;
  const available = hasTelemetry(data);
  const status = !available || !observed ? 'Awaiting telemetry' : affected.affected ? 'Degraded' : observed === affected.total ? 'Operational' : 'Incomplete telemetry';
  return <div className="operator-workspace">
    <PageFrame title="Operator" subtitle="Observe. Review the evidence. Authorise the next change." actions={<KillSwitchButton />} flow={FLOW_RESPONSE}
      kpis={<><Stat label="Observed cause · M3" value={m3?.abstain ? 'Abstain' : m3?.klass ?? 'Awaiting output'} icon={ShieldAlert} /><Stat label="Affected sites" value={observed ? `${affected.affected} / ${affected.total}` : 'Unavailable'} icon={Link2} /><Stat label="Delivered traffic" value={delivered === undefined ? 'Unavailable' : delivered.toFixed(2)} unit={delivered === undefined ? undefined : 'Mbps'} icon={Activity} /><Stat label="Network health" {...pctView(health)} /></>}>
      <ReadOnlyNotice />
      <div className="operator-desk">
        <aside className="operator-decisions" data-tour="operator-decisions" aria-label="Commander decisions">
          <div className="operator-section-label"><span>Commander desk</span><StatusBadge size="sm" tone="unknown" word="Human approval" /></div>
          <div className="operator-decisions__scroll"><Approvals data={data} catalogue={catalogue} /><div className="operator-authority"><strong>Your decision is the boundary.</strong><p>Review the exact plan, owner, targets and expiry. The backend validates the token and safety guards before an agent can execute.</p><Link to={`/policy${search}`}>Inspect policy duties <ArrowRight size={14} /></Link></div></div>
        </aside>
        <section className="operator-situation" data-tour="operator-situation" aria-label="Current network situation">
          <div className="operator-situation__head"><span className="operator-section-label">Current situation</span><StatusBadge size="sm" tone={!available || !observed ? 'unknown' : affected.affected ? 'warn' : 'ok'} word={status} /></div>
          <div className="operator-map"><NetworkPanel /></div>
          <section className="operator-evidence" data-tour="operator-evidence" aria-label="Observed evidence and activity">
            <div className="workspace-tabs" role="tablist" aria-label="Operator evidence">{TABS.map((item, index) => <button key={item.id} id={`operator-tab-${item.id}`} type="button" role="tab" aria-selected={tab === item.id} aria-controls="operator-tab-panel" tabIndex={tab === item.id ? 0 : -1} onKeyDown={event => tabKeys(event,TABS.map(t => t.id),index,setTab,'operator-tab-')} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
            <div className="operator-evidence__body" id="operator-tab-panel" role="tabpanel" aria-labelledby={`operator-tab-${tab}`} tabIndex={0}>
              {tab === 'evidence' && <div className="operator-evidence-grid"><AlertFeed data={data} /><TopEvidence data={data} /><PolicyEvidence data={data} catalogue={catalogue} /></div>}
              {tab === 'agents' && <AgentActivity data={data} records={catalogue.records} />}
              {tab === 'models' && <ModelPanel data={data} />}
              {tab === 'delivery' && <TelemetryChart data={data} />}
              {tab === 'recovery' && <RemediationTimeline data={data} />}
            </div>
          </section>
        </section>
      </div>
    </PageFrame>
  </div>;
}
