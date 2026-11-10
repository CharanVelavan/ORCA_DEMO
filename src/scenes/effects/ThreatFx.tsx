import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Effect } from '../beats3d';
import { attackerHome, injectorViaMgmt, MGMT, placePos, SAT, type V3 } from '../geo';
import { NODES } from '../../pipeline/pipelineNodes';
import { arcCurve, BeamTube, basicMat, clamp01, ease, HoloCard, type FxCtx } from './common';

const ATTACK_IDS = new Set(NODES.filter((n) => n.kind === 'threat' && n.group === 'attack').map((n) => n.id));
const BEAM_SECONDS = 1.7;

/** Expanding red ring on the ground (two staggered ripples) plus a pulsing disc under the target. */
export function Shockwave({ pos, color, ctx, startAt = 0, ripples = 2 }: { pos: V3; color: string; ctx: FxCtx; startAt?: number; ripples?: number }) {
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const disc = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = ctx.age.current - startAt;
    for (let i = 0; i < ripples; i++) {
      const m = rings.current[i];
      if (!m) continue;
      const mat = m.material as THREE.MeshBasicMaterial;
      if (ctx.reduced) { m.scale.setScalar(2 + i * 0.6); mat.opacity = t > 0 ? 0.55 - i * 0.2 : 0; continue; }
      const ph = t > 0 ? ((t - i * 0.55) % 1.6) / 1.6 : -1;
      if (ph < 0 || t < i * 0.55) { mat.opacity = 0; continue; }
      m.scale.setScalar(0.05 + 3 * ease(ph));
      mat.opacity = (1 - ph) * 0.85 * ctx.alpha.current;
    }
    if (disc.current) {
      const mat = disc.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (t > 0 ? 0.22 + (ctx.reduced ? 0 : 0.12 * Math.sin(ctx.time.current * 6)) : 0) * ctx.alpha.current;
    }
  });
  return (
    <group position={[pos[0], 0.03, pos[2]]} rotation-x={-Math.PI / 2}>
      <mesh ref={disc}><circleGeometry args={[0.7, 40]} /><meshBasicMaterial {...basicMat(color, 0)} /></mesh>
      {Array.from({ length: ripples }, (_, i) => (
        <mesh key={i} ref={(r) => { rings.current[i] = r; }}><ringGeometry args={[0.9, 1.0, 56]} /><meshBasicMaterial {...basicMat(color, 0)} side={THREE.DoubleSide} /></mesh>
      ))}
    </group>
  );
}

export function ThreatFx({ fx, ctx }: { fx: Effect; ctx: FxCtx }) {
  const injector = fx.node.startsWith('threat:') ? fx.node.slice(7) : '';
  const target = fx.site ?? 'CHN-01';
  const tpos = placePos(target) ?? placePos('CHN-01')!;
  const isAttack = ATTACK_IDS.has(fx.node);
  const showBeam = ctx.truth && isAttack && !ctx.reduced; // the console never shows the attacker
  const color = ctx.palette.critical;
  const curve = useMemo(() => {
    const from = attackerHome(injector, target);
    const start: V3 = [from[0], 2.2, from[2]];
    const top: V3 = [tpos[0], 0.95, tpos[2]];
    const mgmtTop: V3 = [MGMT[0], 0.9, MGMT[2]];
    const viaSat: V3 = [SAT[0], SAT[1] - 0.5, SAT[2]];
    const pts: V3[] = target === 'SAT-MGMT' ? [start, mgmtTop] : injectorViaMgmt(injector) ? [start, mgmtTop, top] : [start, viaSat, top];
    return arcCurve(pts, 0.55);
  }, [injector, target, tpos[0], tpos[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const progress = useRef(0);
  useFrame(() => { progress.current = clamp01(ctx.age.current / BEAM_SECONDS); });
  const arrive = showBeam ? BEAM_SECONDS : 0;
  const pulse = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!pulse.current) return;
    const k = ctx.reduced ? 1 : 1 + 0.25 * Math.sin(ctx.time.current * 7);
    pulse.current.scale.setScalar(k);
    (pulse.current.material as THREE.MeshBasicMaterial).opacity = (ctx.age.current > arrive ? 0.5 : 0.15) * ctx.alpha.current;
  });
  return (
    <group>
      {showBeam && <BeamTube curve={curve} color={color} radius={0.04} dash={16} speed={3} progress={progress} ctx={ctx} />}
      <Shockwave pos={tpos} color={color} ctx={ctx} startAt={arrive} />
      <mesh ref={pulse} position={[tpos[0], 0.95, tpos[2]]}><sphereGeometry args={[0.22, 20, 14]} /><meshBasicMaterial {...basicMat(color, 0.4)} /></mesh>
      {fx.label && <HoloCard position={[tpos[0], 2.05, tpos[2]]} text={fx.label} tone="critical" ctx={ctx} />}
    </group>
  );
}
