import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play, SkipBack, SkipForward, ChevronsRight } from 'lucide-react';
import { useDashboardReplay } from '../review/ReplayProvider';
import { recordings, type Recording } from '../showcase/data';
import { useLiveStore } from '../store';
import { simClockIST } from './ContextStrip';
import './session.css';
export function SessionControls() {
 const {file,setFile,replay:p}=useDashboardReplay();const [list,setList]=useState<Recording[]>([]);const ts=useLiveStore(s=>s.ts);const [error,setError]=useState('');
 useEffect(()=>{recordings().then(setList).catch(e=>setError(e.message));},[]);
 return <div className="showcase-transport" aria-label="Recorded scenario playback" data-tour="session-mode">
 <label>Recording<select aria-label="Choose recorded scenario" value={file??''} onChange={e=>setFile(e.target.value)}>{list.map(r=><option key={r.file} value={r.file}>{r.label}</option>)}</select></label>
 <button className="sh-btn sh-btn--sm" disabled={p.loading||!p.events.length} onClick={p.toggle} aria-label={p.playing?'Pause recording':'Play recording'}>{p.playing?<Pause size={15}/>:<Play size={15}/>}</button>
 <button className="sh-btn sh-btn--sm" disabled={p.loading||!p.cursor} onClick={()=>p.step(-1)} aria-label="Previous recorded event"><SkipBack size={14}/></button>
 <button className="sh-btn sh-btn--sm" disabled={p.loading||p.cursor>=p.events.length} onClick={()=>p.step(1)} aria-label="Next recorded event"><SkipForward size={14}/></button>
 <input type="range" aria-label="Recording position" min="0" max={p.events.length} value={p.cursor} disabled={p.loading} onChange={e=>p.seek(Number(e.target.value))}/>
 <button className="sh-btn sh-btn--sm" disabled={p.loading||!p.events.length} onClick={()=>p.seek(p.events.length)} aria-label="Show final recorded state"><ChevronsRight size={14}/><span>Final state</span></button>
 <label>Speed<select aria-label="Recording speed" value={p.speed} onChange={e=>p.setSpeed(Number(e.target.value) as 1|4|10)}>{[1,4,10].map(n=><option key={n}>{n}</option>)}</select></label>
 <time>{ts?simClockIST(ts)+' IST':'Recorded time'}</time><Link to="/scenarios" className="sh-btn sh-btn--sm">Scenario briefing</Link>
 <span className="showcase-status" role="status">{p.loading?'Loading recording…':p.error??error??`${p.cursor}/${p.events.length} events · read only`}</span>
 </div>;
}
