import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Effect } from '../beats3d';
import type { NodeInfo } from '../../pipeline/pipelineStore';
import { GAP_COLOR, GATEWAYS, MGMT, SITES, type V3 } from '../geo';
import { basicMat, ease, HoloCard, type FxCtx } from './common';

const off = (p: V3, dx: number, dz: number): V3 => [p[0] + dx, 0, p[2] + dz];
/** Where each India gap applies on the map (spread so pins never stack). */
export const GAP_POS: Record<string, V3> = {
  'gap:GAP-IN-01': off(MGMT, 0.9, -0.5),
  'gap:GAP-IN-02': off(GATEWAYS['GW-IN-2'].pos, 0.8, 0.7),
  'gap:GAP-IN-03': off(SITES['CHN-01'].pos, -0.9, -0.3),
  'gap:GAP-IN-04': off(SITES['CHN-04'].pos, -0.8, 0.6),
  'gap:GAP-IN-05': off(MGMT, -0.4, 0.9),
  'gap:GAP-IN-06': off(GATEWAYS['GW-IN-1'].pos, 0.8, 0.8),
  'gap:GAP-IN-07': [0.1, 0, -0.6],
  'gap:GAP-IN-08': off(GATEWAYS['GW-IN-2'].pos, 1.4, -0.5),
  'gap:GAP-IN-09': [-1.6, 0, -2.6],
};

function Pin({ id, ctx }: { id: string; ctx: FxCtx }) {
  const g = useRef<THREE.Group>(null);
  const seen = useRef<number | null>(null);
  const p = GAP_POS[id];
  useFrame(() => {
    if (!g.current) return;
    seen.current ??= ctx.time.current;
    const t = ctx.time.current - seen.current;
    const drop = ctx.reduced ? 1 : ease(t / 0.65);
    const settle = ctx.reduced || t < 0.65 ? 0 : Math.exp(-(t - 0.65) * 5) * Math.sin((t - 0.65) * 18) * 0.12;
    g.current.position.set(p[0], (1 - drop) * 2.6 + settle, p[2]);
  });
  return (
    <group ref={g} position={[p[0], 2.6, p[2]]}>
      <mesh position-y={0.02} rotation-x={-Math.PI / 2}><circleGeometry args={[0.1, 20]} /><meshBasicMaterial {...basicMat(GAP_COLOR, 0.5)} /></mesh>
      <mesh position-y={0.4}><cylinderGeometry args={[0.014, 0.014, 0.8, 6]} /><meshBasicMaterial {...basicMat(GAP_COLOR, 1)} /></mesh>
      <mesh position={[0.17, 0.7, 0]}><planeGeometry args={[0.34, 0.22]} /><meshBasicMaterial {...basicMat(GAP_COLOR, 0.95)} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

/** Violet flag pins drop onto the map for every policy gap found; they persist until the run resets. */
export function GapFx({ ctx, nodes, fx }: { ctx: FxCtx; nodes: Record<string, NodeInfo>; fx: Effect }) {
  const shown = useMemo(() => Object.keys(GAP_POS).filter((id) => (nodes[id]?.phase === 'active' || nodes[id]?.phase === 'done') && nodes[id]?.at), [nodes]);
  const latest = fx.kind === 'gap' && GAP_POS[fx.node] && shown.includes(fx.node) ? fx.node : null;
  return (
    <group>
      {shown.map((id) => <Pin key={id} id={id} ctx={ctx} />)}
      {latest && fx.label && <HoloCard position={[GAP_POS[latest][0], 1.45, GAP_POS[latest][2]]} text={fx.label} tone="gap" ctx={ctx} />}
    </group>
  );
}
