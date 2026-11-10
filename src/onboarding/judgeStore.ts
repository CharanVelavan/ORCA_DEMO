import { create } from 'zustand';
import type { JudgeId } from './judgeEvidence';
/** Ephemeral review acknowledgements only. No engine commands or browser persistence. */
export const useJudgeReview = create<{
  session: object | null; source: string; reviewed: Partial<Record<JudgeId, string>>; focus: string | null;
  bind: (session: object, source: string) => void; mark: (id: JudgeId, key: string) => void; reset: () => void; setFocus: (tab: string | null) => void;
}>(set => ({
  session:null, source:'', reviewed:{}, focus:null,
  bind:(session,source) => set(state => state.session === session && state.source === source ? state : { session,source,reviewed:{} }),
  mark:(id,key) => set(state => ({reviewed:{...state.reviewed,[id]:key}})),
  reset:() => set({reviewed:{}}), setFocus:focus => set({focus}),
}));
