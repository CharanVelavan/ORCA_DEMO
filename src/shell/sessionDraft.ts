import { create } from 'zustand';

export type SessionMode = 'mock' | 'local' | 'replay';

/** Next-run preference is shared across setup and the shell; actual run mode remains in the live store. */
export const useSessionDraft = create<{ mode: SessionMode | null; setMode: (mode: SessionMode) => void }>(set => ({
  mode: null,
  setMode: mode => set({ mode }),
}));
