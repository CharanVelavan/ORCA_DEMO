import type { Tone } from '../pipeline/pipelineStore';

// Shared scene geometry and palette types (kept out of NetworkScene so effects can import without cycles).
export type V3 = [number, number, number];

export const SITES: Record<string, { name: string; pos: V3 }> = {
  'CHN-01': { name: 'Park Town', pos: [0.6, 0, -1.6] },
  'CHN-02': { name: 'T. Nagar', pos: [-0.9, 0, 0.1] },
  'CHN-03': { name: 'Adyar', pos: [0.5, 0, 1.6] },
  'CHN-04': { name: 'Guindy', pos: [-1.0, 0, 1.5] },
  'CHN-05': { name: 'Ennore', pos: [1.3, 0, -3.1] },
  'CHN-06': { name: 'OMR', pos: [1.5, 0, 2.9] },
};
export const GATEWAYS: Record<string, { name: string; pos: V3; foreign?: boolean }> = {
  'GW-IN-1': { name: 'Main ground station', pos: [-2.6, 0, -1.2] },
  'GW-IN-2': { name: 'Backup ground station', pos: [-5.2, 0, 1.4] },
  'GW-XX': { name: 'Foreign ground station', pos: [5.6, 0, -3.8], foreign: true },
};
export const SAT: V3 = [-0.6, 5.2, -0.4];
/** Operator management network (SAT-MGMT): a small server block next to GW-IN-1. */
export const MGMT: V3 = [-4.0, 0, -2.7];
/** Remote origin of management-network attacks (outside the map, "the internet"). */
export const ATTACKER_NET: V3 = [-6.6, 0, -4.4];

/** Injectors that arrive over the operator's management network (KA-SAT style). */
const VIA_MGMT = new Set(['mgmt_intrusion', 'failover_lure', 'telemetry_edit', 'ss7_abuse', 'firmware_exploit']);
export const injectorViaMgmt = (injector: string) => VIA_MGMT.has(injector);

/** Ground position of a named place (site, gateway, SAT-MGMT) or null. */
export const placePos = (id?: string | null): V3 | null => {
  if (!id) return null;
  if (SITES[id]) return SITES[id].pos;
  if (GATEWAYS[id]) return GATEWAYS[id].pos;
  if (id === 'SAT-MGMT') return MGMT;
  return null;
};

/** Where the attacker marker sits: far away for management-network attacks, beside the target for RF attacks. */
export const attackerHome = (injector: string, target: string): V3 => {
  if (injectorViaMgmt(injector)) return ATTACKER_NET;
  const p = placePos(target) ?? [2.8, 0, -0.6];
  return [p[0] + 1.6, 0, p[2] - 1.4];
};

export type Palette = Record<'bg' | 'surface' | 'surface2' | 'ink' | 'muted' | 'border' | 'accent' | 'ok' | 'warn' | 'critical' | 'healing' | 'unknown', string>;

export const toneColor = (p: Palette, t?: Tone): string =>
  t === 'ok' ? p.ok : t === 'warn' ? p.warn : t === 'critical' ? p.critical : t === 'healing' ? p.healing : t === 'accent' ? p.accent : p.unknown;

/** Violet used for policy-gap pins (not part of the state palette). */
export const GAP_COLOR = '#9B7BE0';
/** One colour per agent role (same hues as the flowchart avatars in pipeline/FlowGraph.tsx). */
export const ROLE_COLORS: Record<string, string> = {
  mobile_operator: '#5B8DEF',
  satellite_operator: '#3FB5C9',
  power_utility: '#D9B341',
  cert_in: '#E08A4F',
  regulator: '#A77BD9',
  gap_analyst: '#4FB58A',
};
export const ROLE_ORDER = ['mobile_operator', 'satellite_operator', 'power_utility', 'cert_in', 'regulator', 'gap_analyst'] as const;
export const ROLE_SHORT: Record<string, string> = {
  mobile_operator: 'Mobile network', satellite_operator: 'Satellite link', power_utility: 'Power grid', cert_in: 'Cyber response', regulator: 'Regulator', gap_analyst: 'Policy adviser',
};

/** Centre of the orbiting agent badges (above GW-IN-1), the rules diamond (above SAT-MGMT) and the commander shield. */
export const BADGE_C: V3 = [-2.6, 2.9, -1.2];
export const RULES_POS: V3 = [MGMT[0], 2.2, MGMT[2]];
export const HUMAN_POS: V3 = [0, 2.2, 0];
