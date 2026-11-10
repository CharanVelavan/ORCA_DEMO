import { create } from 'zustand';

// UI-only state for the Stage, Control and Console layouts. Owner: lead.
// Feature modules (sim, inbox, landing, review) may read it and call its actions; they must not add fields.

export type StageMode = 'setup' | 'running';
export type PipelineView = 'open' | 'rail' | 'full';
export type Theme = 'dark' | 'light';

/** Demo replays a recorded run (no engine logic). Live runs the engine with the real LLM. Rules always on, India KB only. */
export type RunMode = 'demo' | 'live';
export type ExerciseConfig = {
  scenario: string;
  run: RunMode;
  /** Slow 0.5, Normal 1, Fast 2 (engine-valid speeds). */
  speed: 0.5 | 1 | 2;
};

/** One fired attack/fault button, for the rail check marks. */
export type FiredInject = { injector: string; target: string; at: string };

type UiStore = {
  mode: StageMode;
  pipeline: PipelineView;
  simDrawer: boolean;
  theme: Theme;
  config: ExerciseConfig;
  fired: FiredInject[];
  setConfig: (patch: Partial<ExerciseConfig>) => void;
  start: () => void;
  end: () => void;
  setPipeline: (view: PipelineView) => void;
  toggleDrawer: (open?: boolean) => void;
  toggleTheme: () => void;
  markFired: (item: FiredInject) => void;
};

const readTheme = (): Theme => {
  try { return localStorage.getItem('orca-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
};

export const useUi = create<UiStore>((set) => ({
  mode: 'setup',
  pipeline: 'open',
  simDrawer: false,
  theme: readTheme(),
  config: { scenario: 'S1', run: 'demo', speed: 1 },
  fired: [],
  setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  start: () => set({ mode: 'running', pipeline: 'open', simDrawer: false, fired: [] }),
  end: () => set({ mode: 'setup', simDrawer: false }),
  setPipeline: (pipeline) => set({ pipeline }),
  toggleDrawer: (open) => set((s) => ({ simDrawer: open ?? !s.simDrawer })),
  toggleTheme: () => set((s) => {
    const theme: Theme = s.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('orca-theme', theme); } catch { /* private mode */ }
    return { theme };
  }),
  markFired: (item) => set((s) => ({ fired: [...s.fired, item] })),
}));
