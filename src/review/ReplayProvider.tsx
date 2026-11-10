import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLiveStore } from '../store';
import { exitReplay, rememberedReplayFile, useReplay } from './useReplay';
type ReplaySession = {file:string|null;setFile:(file:string|null)=>void;replay:ReturnType<typeof useReplay>};
const ReplayContext=createContext<ReplaySession|null>(null);
/** Playback belongs to the application, so navigating never destroys its timer. */
export function ReplayProvider({children}:{children:ReactNode}) {
  const [file,setFile]=useState<string|null>(()=>rememberedReplayFile() ?? 'S1-mock.jsonl');
  const replay=useReplay(file);
  useEffect(()=>useLiveStore.subscribe((state,previous)=>{
    if(previous.source==='replay' && state.source==='live') { replay.pause();setFile(null); }
  }),[replay.pause]);
  const choose=(next:string|null)=>{ if(!next) {replay.pause(); return;} setFile(next); };
  return <ReplayContext.Provider value={{file,setFile:choose,replay}}>{children}</ReplayContext.Provider>;
}
export function useDashboardReplay() {
  const context=useContext(ReplayContext);
  if(!context) throw new Error('Replay controls need the shared replay provider.');
  return context;
}
