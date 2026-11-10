import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Effect } from '../beats3d';
import { RULES_POS, toneColor } from '../geo';
import { basicMat, clamp01, HoloCard, type FxCtx } from './common';

const SEG = 64;
const COUNT_SECONDS = 6;

/** Amber diamond hologram over SAT-MGMT flashing the verdict, with a flat clock ring that counts down. */
export function RulesFx({ fx, ctx }: { fx: Effect; ctx: FxCtx }) {
  const color = toneColor(ctx.palette, fx.tone === 'ok' || fx.tone === 'accent' ? 'warn' : fx.tone);
  const dia = useRef<THREE.Group>(null);
  const solid = useRef<THREE.Mesh>(null);
  const wire = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.78, 0.86, SEG), []);
  useFrame((_, dt) => {
    const a = ctx.alpha.current;
    if (dia.current && !ctx.reduced) { dia.current.rotation.y += dt * 0.9; dia.current.position.y = Math.sin(ctx.time.current * 1.6) * 0.06; }
    const flash = ctx.reduced ? 0 : Math.max(0, 1 - ctx.age.current * 1.4); // verdict flash right after the beat
    if (solid.current) (solid.current.material as THREE.MeshBasicMaterial).opacity = (0.22 + 0.5 * flash) * a;
    if (wire.current) (wire.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * a;
    const left = ctx.reduced ? 0.6 : 1 - clamp01((ctx.age.current % (COUNT_SECONDS + 1)) / COUNT_SECONDS);
    ringGeo.setDrawRange(0, Math.max(0, Math.round(SEG * left)) * 6);
    if (ring.current) (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * a;
  });
  const [x, y, z] = RULES_POS;
  return (
    <group position={[x, y, z]}>
      <group ref={dia}>
        <mesh ref={solid} scale={[0.6, 0.85, 0.6]}><octahedronGeometry args={[0.5]} /><meshBasicMaterial {...basicMat(color, 0.25)} /></mesh>
        <mesh ref={wire} scale={[0.6, 0.85, 0.6]}><octahedronGeometry args={[0.52]} /><meshBasicMaterial {...basicMat(color, 0.9, { wireframe: true })} /></mesh>
      </group>
      <mesh ref={ring} geometry={ringGeo} rotation-x={-Math.PI / 2} position-y={-0.1}><meshBasicMaterial {...basicMat(color, 0.85)} side={THREE.DoubleSide} /></mesh>
      {fx.label && <HoloCard position={[0, 0.95, 0]} text={fx.label} tone={fx.tone === 'ok' ? 'ok' : 'warn'} ctx={ctx} />}
    </group>
  );
}
