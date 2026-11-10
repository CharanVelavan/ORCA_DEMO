import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, QuadraticBezierLine } from '@react-three/drei';
import * as THREE from 'three';
import type { Effect } from '../beats3d';
import type { NodeInfo, Packet } from '../../pipeline/pipelineStore';
import { BADGE_C, HUMAN_POS, ROLE_COLORS, ROLE_ORDER, ROLE_SHORT, toneColor, type V3 } from '../geo';
import { basicMat, clamp01, ease, type FxCtx } from './common';

const R = 1.15;
const roleOf = (id: string) => (id.startsWith('agent:') ? id.slice(6) : '');

/** Position of badge i at orbit time t (also used to attach packet arcs). */
export function badgePos(i: number, t: number, out: THREE.Vector3): THREE.Vector3 {
  const a = (i * Math.PI) / 3 + t * 0.28;
  return out.set(BADGE_C[0] + R * Math.cos(a), BADGE_C[1] + 0.12 * Math.sin(a * 2 + i), BADGE_C[2] + R * Math.sin(a));
}

/** Six role badges orbiting above GW-IN-1; active agents glow bigger; packets between agents draw an arc with a travelling dot. */
export function CoordinateFx({ ctx, nodes, packet, fx }: { ctx: FxCtx; nodes: Record<string, NodeInfo>; packet: Packet | null; fx: Effect }) {
  const badges = useRef<(THREE.Group | null)[]>([]);
  const halos = useRef<(THREE.Mesh | null)[]>([]);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const scales = useRef<number[]>(ROLE_ORDER.map(() => 1));
  const line = useRef<(THREE.Object3D & { setPoints: (a: V3 | THREE.Vector3, b: V3 | THREE.Vector3, m: V3 | THREE.Vector3) => void; material: THREE.Material & { opacity: number } }) | null>(null);
  const dot = useRef<THREE.Mesh>(null);
  const live = useRef({ nodes, packet });
  live.current = { nodes, packet };
  const [a, b, m] = useMemo(() => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], []);
  const human = useMemo(() => new THREE.Vector3(...HUMAN_POS), []);
  const lineColor = toneColor(ctx.palette, packet?.tone ?? fx.tone);

  const endpoint = (id: string, t: number, out: THREE.Vector3): boolean => {
    const r = roleOf(id);
    if (r) { const i = ROLE_ORDER.indexOf(r as (typeof ROLE_ORDER)[number]); if (i >= 0) { badgePos(i, t, out); return true; } }
    if (id === 'human') { out.copy(human); return true; }
    return false;
  };

  useFrame((state, dt) => {
    const { nodes: ns, packet: pk } = live.current;
    const t = ctx.reduced ? 0 : ctx.time.current;
    const al = ctx.alpha.current;
    const k = 1 - Math.exp(-dt * 6);
    ROLE_ORDER.forEach((role, i) => {
      const g = badges.current[i];
      if (!g) return;
      badgePos(i, t, g.position);
      const id = `agent:${role}`;
      const active = ns[id]?.phase === 'active' || pk?.from === id || pk?.to === id;
      scales.current[i] += ((active ? 1.7 : 1) - scales.current[i]) * k;
      g.scale.setScalar(scales.current[i]);
      const core = g.children[0] as THREE.Mesh;
      (core.material as THREE.MeshBasicMaterial).opacity = (active ? 1 : 0.55) * al;
      const h = halos.current[i];
      if (h) { (h.material as THREE.MeshBasicMaterial).opacity = (active ? 0.45 + (ctx.reduced ? 0 : 0.2 * Math.sin(ctx.time.current * 5)) : 0.12) * al; h.lookAt(state.camera.position); }
      const l = labels.current[i];
      if (l) { l.style.opacity = String(active ? al : 0); }
    });
    // arc + travelling dot for the current packet
    const ln = line.current, d = dot.current;
    const show = !!pk && !ctx.reduced && endpoint(pk.from, t, a) && endpoint(pk.to, t, b);
    if (ln) { ln.visible = show; if (show) { m.copy(a).add(b).multiplyScalar(0.5); m.y += 0.9; ln.setPoints(a, b, m); (ln.material as unknown as { opacity: number }).opacity = 0.85 * al; } }
    if (d) {
      d.visible = show;
      if (show) {
        const u = ease(clamp01(ctx.pktAge.current / 0.6));
        // quadratic bezier point
        d.position.set(
          (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * m.x + u * u * b.x,
          (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * m.y + u * u * b.y,
          (1 - u) * (1 - u) * a.z + 2 * (1 - u) * u * m.z + u * u * b.z,
        );
        (d.material as THREE.MeshBasicMaterial).opacity = al;
      }
    }
  });

  return (
    <group>
      <mesh position={BADGE_C} rotation-x={-Math.PI / 2}><ringGeometry args={[R - 0.01, R + 0.01, 64]} /><meshBasicMaterial {...basicMat(ctx.palette.border, 0.5)} /></mesh>
      {ROLE_ORDER.map((role, i) => (
        <group key={role} ref={(g) => { badges.current[i] = g; }}>
          <mesh><sphereGeometry args={[0.1, 20, 14]} /><meshBasicMaterial {...basicMat(ROLE_COLORS[role], 0.55)} /></mesh>
          <mesh ref={(h) => { halos.current[i] = h; }}><ringGeometry args={[0.15, 0.2, 28]} /><meshBasicMaterial {...basicMat(ROLE_COLORS[role], 0.12)} side={THREE.DoubleSide} /></mesh>
          <Html position={[0, 0.3, 0]} center zIndexRange={[25, 0]} style={{ pointerEvents: 'none' }}>
            <span ref={(l) => { labels.current[i] = l; }} className="scn-holo scn-holo--mini" style={{ opacity: 0, borderColor: ROLE_COLORS[role] }}>{ROLE_SHORT[role]}</span>
          </Html>
        </group>
      ))}
      <QuadraticBezierLine ref={line as never} start={[0, 0, 0]} end={[1, 0, 0]} mid={[0.5, 1, 0]} color={lineColor} lineWidth={2.4} transparent visible={false} />
      <mesh ref={dot} visible={false}><sphereGeometry args={[0.07, 14, 10]} /><meshBasicMaterial {...basicMat(lineColor, 1)} /></mesh>
    </group>
  );
}
