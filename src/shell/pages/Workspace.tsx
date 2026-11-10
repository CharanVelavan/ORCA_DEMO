import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCatalogue } from '../../sim/useCatalogue';
import { isReadOnlyNow } from '../../sim/readOnly';
import { useDirectorControls } from '../../simulator/useDirectorControls';
import { GroundTruth } from '../../simulator/GroundTruth';
import { scenarioCtx, useDerived } from '../../derive';
import { NetworkPanel } from '../../operations/NetworkPanel';
import { KillSwitchButton } from '../../inbox/TopBarControls';
import { AlertFeed } from '../../operations/AlertFeed';
import { AgentActivity } from '../../operations/AgentActivity';
import { ModelPanel } from '../../operations/ModelPanel';
import { Approvals, PolicyEvidence, TopEvidence } from '../../operations/ResponseEvidence';
import { useOperationsCatalogue } from '../../operations/data';
import { useOperatorData } from '../../operations/useOperatorData';
import { ReadOnlyNotice } from '../../operations/ReadOnlyNotice';
import { useLiveStore } from '../../store';
import { PageFrame } from '../PageFrame';
import { FLOW_RESPONSE } from '../flowConfig';
import { WorkspaceSplit, resetConsoleSplits } from './WorkspaceSplit';
import { ConsoleAttackRail } from './ConsoleAttackRail';
import '../../simulator/simulator.css';
import '../../operations/operations.css';
import '../../operations/workspace.css';
import './workspace.css';
import { useJudgeReview } from '../../onboarding/judgeStore';

type EvidenceTab = 'approvals'|'alerts'|'agents'|'models'|'policy'|'truth';
const TABS: {id:EvidenceTab; label:string}[] = [{id:'approvals',label:'Approvals'},{id:'alerts',label:'Alerts'},{id:'agents',label:'Agents'},{id:'models',label:'Models'},{id:'policy',label:'Policy'}];
export default function Workspace() {
  const { search } = useLocation();
  const source = useLiveStore(s => s.source);
  const fake = new URLSearchParams(search).get('fake') === '1';
  const readOnly = fake || source === 'replay';
  const controls = useDirectorControls(readOnly);
  const catalogue = useCatalogue();
  const operatorCatalogue = useOperationsCatalogue();
  const data = useOperatorData();
  const current = scenarioCtx(useDerived());
  const [tab, setTab] = useState<EvidenceTab>('approvals');
  const [layoutKey, setLayoutKey] = useState(0);
  const judgeFocus = useJudgeReview(state => state.focus);
  useEffect(() => { if (judgeFocus && TABS.some(tab => tab.id === judgeFocus)) { setTab(judgeFocus as EvidenceTab); useJudgeReview.getState().setFocus(null); } }, [judgeFocus]);
  const disabledClock = !controls.canCommand || controls.running === null;
  const networkPanel = <section className="console-panel console-network" data-tour="operator-situation" aria-label="Operator observed network"><header><strong>Operator situation</strong><small>Released observations · emulated network</small></header><div className="console-network__body"><NetworkPanel /></div></section>;
  const evidencePanel = <section className="console-panel console-evidence" data-tour="operator-evidence" aria-label="Operator evidence and director truth"><header><strong>{tab === 'truth' ? 'Director ground truth' : 'Operator evidence'}</strong><small>{tab === 'truth' ? 'Hidden from operator agents' : 'Ground truth is withheld'}</small></header><div className="console-tabs" role="tablist" aria-label="Evidence views">{TABS.map(t => <button key={t.id} type="button" role="tab" id={`console-tab-${t.id}`} aria-controls="console-evidence-panel" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)} onKeyDown={e => { const index = TABS.findIndex(item => item.id === tab); if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? TABS[0] : e.key === 'End' ? TABS[TABS.length - 1] : TABS[(index + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length]; setTab(next.id); (e.currentTarget.parentElement?.querySelectorAll('button')[TABS.indexOf(next)] as HTMLElement | undefined)?.focus(); } }}>{t.label}</button>)}</div><div className="console-panel__scroll" role="tabpanel" id="console-evidence-panel" aria-labelledby={`console-tab-${tab}`} tabIndex={0}>{tab === 'approvals' && <div data-tour="operator-decisions"><Approvals data={data} catalogue={operatorCatalogue}/></div>}{tab === 'alerts' && <><AlertFeed data={data}/><TopEvidence data={data}/></>}{tab === 'agents' && <AgentActivity data={data} records={operatorCatalogue.records}/>} {tab === 'models' && <ModelPanel data={data}/>} {tab === 'policy' && <PolicyEvidence data={data} catalogue={operatorCatalogue}/>} {tab === 'truth' && <GroundTruth injectors={catalogue.injectors}/>}</div></section>;
  return <PageFrame key={layoutKey} flow={FLOW_RESPONSE} title="Exercise console" subtitle={current.id ? `Active scenario: ${current.id}${current.title ? ` · ${current.title}` : ''}` : 'No active scenario reported'} actions={<><Link className="sh-btn sh-btn--sm" to={`/scenarios${search}`}>Change scenario</Link><button type="button" className="sh-btn sh-btn--sm" onClick={() => { resetConsoleSplits(); setLayoutKey(k => k + 1); }}>Reset panel sizes</button></>}>
    <ReadOnlyNotice />
    <div className="unified-console showcase-console"><div className="console-observation"><WorkspaceSplit id="evidence" direction="vertical" initial={55} label="Resize operator evidence" first={networkPanel} second={evidencePanel}/></div></div>
  </PageFrame>;
}
