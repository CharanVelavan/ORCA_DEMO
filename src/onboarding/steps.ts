export type TourStep = { route: string; target?: string; title: string; body: string };
export const JOURNEY = [
  { route: '/', label: 'Learn', detail: 'Understand the method' },
  { route: '/scenarios', label: 'Scenarios', detail: 'Choose, brief and start' },
  { route: '/workspace', label: 'Console', detail: 'Direct, observe and decide' },
  { route: '/policy', label: 'Policy & Gaps', detail: 'Check duties and evidence' },
  { route: '/recovery', label: 'Recovery', detail: 'Verify the result' },
  { route: '/audit', label: 'Audit & Replay', detail: 'Inspect the record' },
];
export const TOUR_STEPS: TourStep[] = [
  { route: '/', target: 'learn-story', title: 'Start with the problem', body: 'ORCA-NTN demonstrates secure self-healing and incident coordination across an emulated Chennai network. Every satellite link here is emulated.' },
  { route: '/', target: 'learn-method', title: 'Understand who decides', body: 'Models detect. Agents explain and coordinate. Deterministic code evaluates policy and execution guards. Humans review plans and confirm policy gaps.' },
  { route: '/scenarios', target: 'simulator-scenarios', title: 'Choose an exercise', body: 'Select a scenario to preview its purpose and starting conditions. Review its briefing, then Start exercise creates a fresh run and opens Console only after the backend confirms success. Preview selection changes no session. This tour starts nothing.' },
  { route: '/scenarios', target: 'simulator-guide', title: 'Follow the scenario guide', body: 'Read setup, signals, model roles, guarded response and the director’s schedule. These are planned steps, not evidence of detection or recovery. Start uses the selected mock or live mode; recorded replay remains read-only.' },
  { route: '/workspace', target: 'simulator-injection', title: 'Launch an emulated attack', body: 'Use an action in the director rail, or adjust its target and duration before launching it inside the emulated exercise. Ground truth belongs here. The Operator sees released observations, not the hidden attack schedule.' },
  { route: '/workspace', target: 'session-mode', title: 'Connect Qwen or use offline modes', body: 'Model connection accepts your compatible endpoint, model identifier and optional key. Test it before starting a new live run. Mock simulation and recorded replay are explicitly labelled.' },
  { route: '/workspace', target: 'operator-situation', title: 'Read the observed situation', body: 'Inspect site health, service delivery and telemetry. Model classifications are observations, not the scenario’s hidden answer. Check timestamps before acting.' },
  { route: '/workspace', target: 'operator-decisions', title: 'Review the next decision', body: 'Inspect the exact playbook, owner, scope and cited evidence. Approval requires explicit human confirmation and backend guards. The tour never approves a plan.' },
  { route: '/workspace', target: 'operator-evidence', title: 'Inspect agent explanations', body: 'Follow agent activity, tool results, model outputs and accepted citations. A failed model request stays visible; mock output must never be labelled live Qwen.' },
  { route: '/workspace', target: 'execution-flow', title: 'Follow the complete flow', body: 'The original decision chart fits the side panel. Zoom in and drag the background to inspect it; Fit restores the whole diagram. Expand opens the detailed execution graph and architecture. Task states come from observed evidence.' },
  { route: '/workspace', target: 'page-content', title: 'Resize your console', body: 'Drag a panel divider or focus it and use the arrow keys. Reset layout restores the default arrangement. The console uses one exercise session. The director uses the action rail and labelled truth tab; operator evidence stays separate from hidden exercise answers. Replay remains read-only.' },
  { route: '/policy', target: 'page-content', title: 'Check reporting duties and gaps', body: 'Compare the current simulation clock with each obligation’s trigger and deadline. Verdict explanations show their evaluation time. Candidate gaps require human confirmation.' },
  { route: '/recovery', target: 'page-content', title: 'Verify recovery', body: 'Inspect clone tests, staged rollout, clean-path checks, re-attack results and rollback evidence. Restored throughput alone does not prove every guard passed.' },
  { route: '/audit', target: 'page-content', title: 'Replay and inspect the record', body: 'Open a recording, move the replay cursor and inspect the event evidence. Replay is read-only. Use the top navigation to revisit any stage, or restart this tour.' },
];
