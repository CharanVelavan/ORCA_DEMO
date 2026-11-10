/**
 * Public shell API. Wave-2 page owners import from here (never from App.tsx).
 * See docs/plan/SHELL_API.md for the full contract.
 */
export { Shell } from './Shell';
export { TopNav, NAV } from './TopNav';
export { ContextStrip, simClockIST } from './ContextStrip';
export { Stepper } from './Stepper';
export { PageFrame } from './PageFrame';
export { FlowPanel } from './FlowPanel';
export {
  Panel, Stat, StatusBadge, StatusDot, Pill, Chip, EmulatedBadge, Code, Empty, Sparkline, toneVar,
} from './primitives';
export {
  FLOW_RESPONSE, FLOW_INVESTIGATION, FLOW_POLICY, FLOW_RECOVERY, FLOW_BY_ROUTE,
} from './flowConfig';
export type { FlowConfig, FlowNode, FlowNodeKind } from './flowConfig';
