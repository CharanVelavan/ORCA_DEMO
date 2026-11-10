import type { ReplayResponse } from './types';

export type SessionRequest = { scenario:string; llm:'mock'|'local'; rules:boolean; kb:'india'|'eu'; autoplay:boolean; sync:boolean };
import { recordings } from './showcase/data';
import { sha256, verifyOriginal } from './showcase/integrity';
async function read<T>(path:string):Promise<T>{const r=await fetch(path);if(!r.ok)throw new Error(`Bundled data unavailable (HTTP ${r.status}).`);return r.json();}
async function replayFile(file:string):Promise<ReplayResponse>{
 const entry=(await recordings()).find(r=>r.file===file);if(!entry)throw new Error('Choose a bundled recording.');
 const [response,original]=await Promise.all([fetch('/data/recordings/'+encodeURIComponent(file)),fetch('/data/original/'+encodeURIComponent(file))]);
 if(!response.ok||!original.ok)throw new Error('The bundled recording or original chain is unavailable.');
 const body=await response.text();if(await sha256(body)!==entry.sha256)throw new Error('Recording checksum mismatch.');
 const result=JSON.parse(body) as ReplayResponse;
 result.audit.chain=await verifyOriginal(await original.text(),entry.original_sha256);
 return result;
}
async function call<T>(path:string,body?:unknown,method='POST'):Promise<T>{
 // No backend routes exist in this repository. A mutation never reaches the network.
 if(method!=='GET'||body!==undefined)throw new Error('Showcase playback is read-only. Run the main repository locally for fresh actions.');
 if(path==='catalogue')return read<T>('/data/catalogue.json');
 if(path==='runs')return {runs:(await recordings()).map(r=>({file:r.file,scenario:r.scenario,stream:true,size:r.events,mtime:0}))} as T;
 if(path.startsWith('replay?'))return replayFile(new URLSearchParams(path.split('?')[1]).get('file')??'') as Promise<T>;
 throw new Error('This control belongs to the local implementation, not the recorded showcase.');
}
export type ModelDraft = { base_url:string; model:string; api_key?:string; clear_key?:boolean };
export type ModelConfig = { base_url:string; model:string; key_set:boolean; mode?:string };
export const api = {
  modelConfig: () => call<ModelConfig>('model-config', undefined, 'GET'),
  saveModelConfig: (body:ModelDraft) => call<ModelConfig>('model-config', body),
  discoverModels: (body:ModelDraft) => call<{models:string[]}>('model-config/discover', body),
  testModel: (body:ModelDraft) => call<{reachable:boolean;tool_call_compatible:boolean}>('model-config/test', body),
  state: () => call<Record<string, unknown>>('state', undefined, 'GET'),
  catalogue: () => call<Record<string,unknown>>('catalogue',undefined,'GET'),
  session: (body:SessionRequest) => call<Record<string, unknown>>('session', body),
  clock: (body:{action:'play'|'pause'|'step';speed?:number}) => call<Record<string, unknown>>('clock', body),
  inject: (body:{kind:string;target:string;duration_min:number;params?:Record<string,unknown>}) => call<Record<string, unknown>>('inject', body),
  autonomy: (body:Record<string,unknown>) => call<Record<string, unknown>>('autonomy', body), approve: (body:{hash:string}) => call<Record<string, unknown>>('approve', body),
  reject: (body:{hash:string;reason:string}) => call<Record<string, unknown>>('reject', body), kill: (body:{reason:string}) => call<Record<string, unknown>>('kill', body),
  releaseKill: (body:{}) => call<Record<string, unknown>>('kill/release', body), order: (body:{to:string;text:string}) => call<Record<string, unknown>>('order', body),
  ask: (body:{to:string;question:string}) => call<Record<string, unknown>>('ask', body), rules: (on:boolean) => call<Record<string, unknown>>('rules',{on}), kb: (kb:'india'|'eu') => call<Record<string, unknown>>('kb',{kb}),
  gap: (body:{gap_id:string;decision:'confirm'|'reject'}) => call<Record<string, unknown>>('gap', body),
  schedule: (body:{kind:string;target:string;at_t:number;duration_min:number;params?:Record<string,unknown>}) => call<Record<string, unknown>>('schedule', body),
  deleteSchedule: (id:string) => call<Record<string, unknown>>(`schedule/${encodeURIComponent(id)}`, undefined, 'DELETE'),
  truth: () => call<Record<string, unknown>>('truth', undefined, 'GET'),
  stopInject: (body: { kind?: string; id?: string }) => call<Record<string, unknown>>('inject/stop', body),
  runs: () => call<{ runs?: { file: string; scenario: string | null; stream: boolean; size: number; mtime: number }[] }>('runs', undefined, 'GET'),
  replay: (file:string) => call<ReplayResponse>(`replay?file=${encodeURIComponent(file)}`, undefined, 'GET'),
};
