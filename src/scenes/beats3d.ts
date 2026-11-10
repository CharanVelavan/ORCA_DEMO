import type { Beat, NodeInfo, Packet, Tone } from '../pipeline/pipelineStore';
import { BADGE_C, GATEWAYS, placePos, RULES_POS, SITES, type V3 } from './geo';
import { NODES } from '../pipeline/pipelineNodes';

const GAP_TITLE: Record<string, string> = Object.fromEntries(NODES.filter((n) => n.id.startsWith('gap:')).map((n) => [n.id, n.label]));

// Pure mapping from the shared pipeline beat / packet to the 3D effect that acts it out.
export type FxKind = 'threat' | 'detect' | 'coordinate' | 'rules' | 'commander' | 'heal' | 'gap' | 'idle';
export type Effect = {
  kind: FxKind;
  /** CHN-0x, GW-IN-x or SAT-MGMT the effect points at. */
  site?: string;
  /** Node id that triggered it (e.g. model:M1, exec:clone, threat:mgmt_intrusion). */
  node: string;
  label?: string;
  tone: Tone;
};

export const IDLE: Effect = { kind: 'idle', node: 'sat', tone: 'ok' };

export function bandOf(id: string): FxKind {
  if (id.startsWith('threat:')) return 'threat';
  if (id.startsWith('model:')) return 'detect';
  if (id.startsWith('agent:')) return 'coordinate';
  if (id === 'rules' || id === 'clocks') return 'rules';
  if (id === 'human') return 'commander';
  if (id.startsWith('exec:')) return 'heal';
  if (id.startsWith('gap:')) return 'gap';
  return 'idle'; // network band: sat, mgmt, gw:*, site:*
}

const PLACE = /(CHN-0[1-6]|GW-IN-[12]|SAT-MGMT)/;
const find = (s?: string) => (s ? PLACE.exec(s)?.[1] : undefined);
const nodeSite = (id: string) => (id.startsWith('site:') ? id.slice(5) : id.startsWith('gw:') && id !== 'gw:GW-XX' ? id.slice(3) : id === 'mgmt' ? 'SAT-MGMT' : undefined);

/** Site named by a node's own text, then by the first site that is not OK. */
function fallbackSite(nodes: Record<string, NodeInfo>, anomalySite: string | null): string | undefined {
  if (anomalySite) return anomalySite;
  let first: string | undefined;
  for (const [id, n] of Object.entries(nodes)) {
    if (!id.startsWith('site:') || n.word === 'OK' || !n.word) continue;
    if (n.phase === 'active') return id.slice(5);
    first ??= id.slice(5);
  }
  return first;
}

/** Short text for the holo card, taken from live node state so it always matches the flowchart tile. */
function labelFor(kind: FxKind, node: string, nodes: Record<string, NodeInfo>, beat?: Beat): string | undefined {
  const n = nodes[node];
  if (kind === 'detect') {
    const m = node.slice(6);
    const word = n?.word ?? '';
    if (m === 'M1') { const sc = /score ([\d.]+)/.exec(n?.detail ?? '')?.[1]; return `M1 ${sc ?? ''} ${word}`.replace(/\s+/g, ' ').trim(); }
    if (m === 'M3') { const conf = /([\d.]+)$/.exec(n?.detail ?? '')?.[1]; return `M3 ${word}${conf && word !== 'UNSURE' ? ` ${conf}` : ''}`; }
    if (m === 'M2') return `M2 ${word}${n?.detail ? ` · ${(n.detail ?? '').replace(PLACE, '').trim()}` : ''}`;
    return `${m} ${word}`;
  }
  if (kind === 'rules') return node === 'clocks' ? `Clock ${n?.detail ?? ''}`.trim() : `Rules ${n?.word ?? ''}`.trim();
  if (kind === 'commander') return n?.word ? n.word : 'Commander';
  if (kind === 'threat') return beat?.title;
  if (kind === 'gap') return `Gap ${node.slice(-2)}: ${GAP_TITLE[node] ?? 'policy gap'}`;
  if (kind === 'heal') return beat?.title;
  return beat?.title;
}

/**
 * Decide the active effect. A travelling packet (what the flowchart is animating right now) wins over the
 * latest beat (the narration); the beat supplies site and wording.
 */
export function describeEffect(beat: Beat | undefined, packet: Packet | null, nodes: Record<string, NodeInfo>, anomalySite: string | null): Effect {
  let node = beat?.node ?? 'sat';
  let kind = bandOf(node);
  let tone: Tone = beat?.tone ?? 'ok';
  let packetSite: string | undefined;
  if (packet) {
    const toBand = bandOf(packet.to), fromBand = bandOf(packet.from);
    const pick = toBand !== 'idle' ? packet.to : packet.from;
    kind = toBand !== 'idle' ? toBand : fromBand;
    // packets that arrive at a model still belong to that model; ones leaving a threat belong to the threat
    if (fromBand === 'threat') { kind = 'threat'; node = packet.from; } else node = pick;
    tone = packet.tone;
    packetSite = nodeSite(packet.from) ?? nodeSite(packet.to);
    if (kind === 'idle') { kind = bandOf(node); }
  }
  if (kind === 'idle') return { ...IDLE, tone };
  // stay on the beat's wording when the packet and beat share a band
  const sameBand = beat && bandOf(beat.node) === kind;
  const nodeInfo = nodes[node];
  const site = find(sameBand ? beat?.text : undefined) ?? packetSite ?? find(nodeInfo?.detail) ?? find(beat?.text) ?? fallbackSite(nodes, anomalySite)
    ?? (kind === 'rules' || kind === 'threat' ? 'SAT-MGMT' : undefined);
  return { kind, site, node, label: labelFor(kind, node, nodes, sameBand ? beat : undefined), tone: sameBand ? beat!.tone : tone };
}

/** Gateway named in a path detail like "path B via GW-IN-2" (defaults to the backup gateway). */
export const backupGateway = (nodes: Record<string, NodeInfo>): string => /(GW-IN-[12]|GW-XX)/.exec(nodes['exec:cleanpath']?.detail ?? '')?.[1] ?? 'GW-IN-2';

/** Sites listed in a clone/rollout target text. */
export const siteFromExec = (nodes: Record<string, NodeInfo>): string | undefined =>
  find(nodes['exec:failover']?.detail) ?? find(nodes['exec:reattack']?.detail) ?? find(nodes['exec:clone']?.detail);

// ---- camera script -------------------------------------------------------------------------------------
export type Shot = { target: V3; offset: V3 };
export const DEFAULT_OFFSET: V3 = [9.5, 5.6, 9.5];

/** Scripted camera shot for an effect, or null to fall back to the idle follow-the-site behaviour. */
export function shotFor(fx: Effect, nodes: Record<string, NodeInfo>): Shot | null {
  const p = placePos(fx.site);
  const at = (y: number): V3 => (p ? [p[0], y, p[2]] : [0, y, 0]);
  switch (fx.kind) {
    case 'threat': return fx.site === 'SAT-MGMT' ? { target: [RULES_POS[0] * 0.6, 2.4, RULES_POS[2] * 0.6], offset: [6.4, 3.6, 7.0] } : { target: at(2.6), offset: [7.4, 3.6, 8.0] };
    case 'detect': return { target: at(2.6), offset: [7.4, 3.6, 8.0] };
    case 'coordinate': return { target: [BADGE_C[0] * 0.7, 3.2, BADGE_C[2] * 0.7], offset: [6.6, 2.8, 7.2] };
    case 'rules': return { target: [RULES_POS[0] * 0.6, 2.6, RULES_POS[2] * 0.6], offset: [6.4, 3.0, 7.0] };
    case 'commander': return { target: [0, 2.4, 0], offset: [9.5, 6.0, 9.5] };
    case 'gap': return { target: [-0.6, 2.2, 0], offset: [9, 5.8, 9] };
    case 'heal': {
      const step = fx.node.slice(5);
      if (step === 'r5' || step === 'r25' || step === 'r100') return { target: [-0.4, 2.6, -0.6], offset: [8.0, 4.6, 8.0] };
      if (step === 'cleanpath' || step === 'failover') {
        const g = GATEWAYS[backupGateway(nodes)]?.pos ?? GATEWAYS['GW-IN-2'].pos;
        const s = (p ?? SITES['CHN-01'].pos);
        return { target: [(s[0] + g[0]) / 2, 2.2, (s[2] + g[2]) / 2], offset: [7, 4.2, 7] };
      }
      return { target: at(2.6), offset: [7.4, 3.6, 8.0] };
    }
    default: return null;
  }
}
