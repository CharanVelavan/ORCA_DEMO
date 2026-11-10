import { create } from 'zustand';
import type { Agent, Approval, LiveEvent, SiteState } from './types';

type Store = { seq:number; t:number; ts:string; session:Record<string,unknown>; sites:Record<string,SiteState>; gateways:Record<string,string>; paths:Record<string,unknown>[]; alerts:LiveEvent[]; models:LiveEvent[]; messages:LiveEvent[]; verdicts:LiveEvent[]; obligations:LiveEvent[]; approvals:Approval[]; gaps:LiveEvent[]; phases:string[]; impact:LiveEvent|null; autonomy:LiveEvent|null; kill:LiveEvent|null; agents:Record<string,Agent>; errors:LiveEvent[]; raw:LiveEvent[]; truth:LiveEvent[]; schedules:LiveEvent[]; waiting:boolean; agentSteps:LiveEvent[]; events:LiveEvent[]; tickHistory:LiveEvent[]; phaseHistory:LiveEvent[]; summary:LiveEvent|null; source:'live'|'replay'; setSource:(source:'live'|'replay')=>void; add:(event:LiveEvent)=>void; addControl:(event:LiveEvent)=>void; reset:()=>void };
const initial = { seq:0, t:0, ts:'', session:{}, sites:{}, gateways:{}, paths:[], alerts:[], models:[], messages:[], verdicts:[], obligations:[], approvals:[], gaps:[], phases:[], impact:null, autonomy:null, kill:null, agents:{}, errors:[], raw:[], truth:[], schedules:[], waiting:false, agentSteps:[] as LiveEvent[], events:[] as LiveEvent[], tickHistory:[] as LiveEvent[], phaseHistory:[] as LiveEvent[], summary:null, source:'live' as const };
const cap = <T,>(items:T[]) => items.slice(-60);
const recentModels = (items:LiveEvent[], event:LiveEvent):LiveEvent[] => {
  const all = [...items,event];
  const counts = new Map<string,number>();
  const sites = new Map<string,Set<string>>();
  const recent:LiveEvent[] = [];
  for (let i=all.length-1;i>=0;i--) {
    const item = all[i];
    const model = typeof item.model === 'string' && /^M[1-4]$/.test(item.model) ? item.model : 'other';
    const count = counts.get(model) ?? 0;
    const seen = sites.get(model) ?? new Set<string>();
    const site = typeof item.site === 'string' ? item.site : '';
    const latestForSite = !seen.has(site) && seen.size < 60;
    if (count < 60 || latestForSite) recent.push(item);
    if (count < 60) counts.set(model,count+1);
    if (latestForSite) seen.add(site);
    sites.set(model,seen);
  }
  return recent.reverse();
};
const reduce = (state:Store, event:LiveEvent):Partial<Store> => {
  if (event.audience === 'control') return state;
  if (state.events.some((existing) => existing.seq === event.seq)) return state;
  const next = { ...state, seq:Math.max(state.seq,event.seq), t:typeof event.t==='number'?Math.max(state.t,event.t):state.t, ts:typeof event.ts==='string'&&event.ts>state.ts?event.ts:state.ts, events:[...state.events,event].slice(-12000) };
  switch(event.kind) {
    case 'session': return { ...next, session:event };
    case 'kb_changed': return { ...next, session:{...state.session,kb:event.kb}, verdicts:[], obligations:[], gaps:[], summary:null };
    case 'rules_changed': return { ...next, session:{...state.session,rules:event.rules}, verdicts:[], obligations:[], gaps:[], summary:null };
    case 'tick': return { ...next, tickHistory:[...state.tickHistory,event].slice(-720), sites:(event.sites as Record<string,SiteState>) ?? state.sites, gateways:(event.gateways as Record<string,string>) ?? state.gateways, paths:(event.paths as Record<string,unknown>[]) ?? state.paths };
    case 'alert': return { ...next, alerts:cap([...state.alerts,event]) };
    case 'model': return { ...next, models:recentModels(state.models,event) };
    case 'msg': return { ...next, messages:cap([...state.messages,event]) };
    case 'verdict': return { ...next, verdicts:cap([...state.verdicts,event]) };
    case 'clock_obligation': return { ...next, obligations:cap([...state.obligations.filter(x=>event.obligation_id ? x.obligation_id !== event.obligation_id : x.regime !== event.regime),event]) };
    case 'approval': {
      const hash = typeof event.hash === 'string' && event.hash ? event.hash : event.plan_hash;
      if (typeof hash !== 'string' || !hash) return next;
      const a = { ...event, hash } as unknown as Approval;
      const old = state.approvals.find(x => x.hash === hash);
      return { ...next, approvals:cap([...state.approvals.filter(x => x.hash !== hash), old ? {...old,...a} : a]) };
    }
    case 'gap': return { ...next, gaps:cap([...state.gaps.filter(x=>x.gap_id!==event.gap_id),event]) };
    case 'phase': return { ...next, phaseHistory:[...state.phaseHistory,event], phases:Array.isArray(event.active) ? event.active.map(String) : Array.isArray(event.phase) ? event.phase.map(String) : typeof event.phase==='string' ? [event.phase] : [] };
    case 'summary': return { ...next, summary:event };
    case 'impact': return { ...next, impact:event };
    case 'autonomy': return { ...next, autonomy:event };
    case 'kill': return { ...next, kill:event };
    case 'agent_busy': return { ...next, agents:{...state.agents,[String(event.role)]:{...state.agents[String(event.role)],role:String(event.role),busy:Boolean(event.busy),queue:Number(event.queue ?? 0)}} };
    case 'agent_task': case 'agent_step': case 'agent_final': return { ...next, agentSteps:event.kind==='agent_task'?state.agentSteps:[...state.agentSteps,event].slice(-400), agents:{...state.agents,[String(event.role)]:{...state.agents[String(event.role)],role:String(event.role),lastAction:String(event.text ?? event.final ?? event.result ?? event.task ?? event.tool ?? 'Working')}} };
    case 'clock_waiting': return { ...next, waiting:true };
    case 'clock_resumed': return { ...next, waiting:false };
    case 'error': return { ...next, errors:cap([...state.errors,event]) };
    case 'inject': return { ...next, truth:cap([...state.truth,event]), raw:cap([...state.raw,event]) };
    case 'scheduled': return { ...next, schedules:cap([...state.schedules.filter(x=>x.id!==event.id),event]), raw:cap([...state.raw,event]) };
    case 'execute': case 'heal': case 'patch_stage': case 'rollback': case 'reattack': return { ...next, raw:cap([...state.raw,event]) };
    default: return { ...next, raw:cap([...state.raw,event]) };
  }
};
export const useLiveStore = create<Store>((set) => ({ ...initial, setSource:(source)=>set({source}), reset:() => set((state)=>({...initial,source:state.source})), add:(event) => set((state) => reduce(state,event)), addControl:(event) => set((state) => event.audience==='control' ? ({...state,seq:Math.max(state.seq,event.seq),truth:event.kind==='scheduled'?state.truth:cap([...state.truth,event]),schedules:event.kind==='scheduled'?cap([...state.schedules.filter(x=>x.id!==event.id),event]):state.schedules}) : reduce(state,event)) }));
