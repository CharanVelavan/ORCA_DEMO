import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Layers } from 'lucide-react';
import { useCatalogue } from '../../sim/useCatalogue';
import { ScenarioGuide } from '../../simulator/ScenarioGuide';
import { useDashboardReplay } from '../../review/ReplayProvider';
import { recordings, type Recording } from '../../showcase/data';
import { PageFrame } from '../PageFrame';
import './scenarios.css';
export default function Scenarios(){
 const c=useCatalogue();const [selected,setSelected]=useState('S1');const [list,setList]=useState<Recording[]>([]);const [variant,setVariant]=useState('');const [error,setError]=useState('');const {setFile}=useDashboardReplay();const navigate=useNavigate();
 useEffect(()=>{recordings().then(setList).catch(e=>setError(e.message));},[]);
 const scenario=c.scenarios.find(s=>s.id===selected);const choices=list.filter(r=>r.scenario===selected);const recording=choices.find(r=>r.file===variant)??choices[0];
 return <PageFrame title="Choose a recorded scenario" subtitle="Read the briefing, then explore its recorded evidence. No fresh simulation or inference runs here.">
 <div className="scenario-prep"><div className="scenario-prep__journey"><span><b>01</b>Choose scenario</span><ArrowRight size={14}/><span><b>02</b>Read briefing</span><ArrowRight size={14}/><span><b>03</b>Open playback</span></div>
 <div className="scenario-prep__workspace"><aside className="scenario-prep__catalogue" aria-label="Scenario selection"><header><h2><Layers size={16}/>Scenarios</h2><span>{c.scenarios.length} recorded</span></header><div className="scenario-prep__list">{c.scenarios.map(s=><button key={s.id} aria-pressed={selected===s.id} className={selected===s.id?'is-selected':''} onClick={()=>{setSelected(s.id);setVariant('');}}><span className="scenario-prep__scenario-meta"><b>{s.id}</b><span>{s.kind}</span></span><strong>{s.title}</strong><span className="scenario-prep__story">{s.story}</span></button>)}</div><footer>Recorded emulator runs · scripted approvals · all links emulated</footer></aside>
 <section className="scenario-prep__detail" aria-label="Selected scenario briefing"><header><h2><BookOpen size={16}/>Scenario briefing</h2><span>Planned methodology and dimensions</span></header><div className="scenario-prep__briefing" key={selected}><ScenarioGuide scenario={scenario} previewOnly/></div><div className="scenario-prep__launch"><div className="scenario-prep__next"><span>Recording source</span><strong>{recording?.mode==='qwen'?'Fine-tuned Qwen during capture':'Deterministic mock agents during capture'}</strong><small>Playback here · no fresh model request</small></div>{choices.length>1&&<label>Capture<select aria-label="Recording variant" value={recording?.file??''} onChange={e=>setVariant(e.target.value)}>{choices.map(r=><option key={r.file} value={r.file}>{r.label}</option>)}</select></label>}<button className="sh-btn sh-btn--primary" disabled={!recording||c.loading} onClick={()=>{if(recording){setFile(recording.file);navigate('/workspace');}}}>Open recorded scenario <ArrowRight size={15}/></button><p className="scenario-prep__launch-note">Use Play, the time slider or Final state to inspect the recording across Console, Policy, Recovery and Audit.</p>{(error||c.error)&&<p role="alert">{error||c.error}</p>}</div></section></div></div></PageFrame>;
}
