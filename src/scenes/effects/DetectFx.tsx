import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Effect } from '../beats3d';
import { placePos, toneColor } from '../geo';
import { basicMat, HoloCard, type FxCtx } from './common';

/** Translucent scan ring + cone sweeping over the affected site, with a floating score card. */
export function DetectFx({ fx, ctx }: { fx: Effect; ctx: FxCtx }) {
  const pos = placePos(fx.site) ?? [0, 0, 0];
  const color = toneColor(ctx.palette, fx.tone === 'ok' ? 'accent' : fx.tone);
  const ring = useRef<THREE.Mesh>(null);
  const cone = useRef<THREE.Mesh>(null);
  const flag = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const a = ctx.alpha.current;
    if (ring.current) {
      const ph = ctx.reduced ? 0.5 : (ctx.age.current % 1.5) / 1.5;
      ring.current.position.y = 0.05 + 1.5 * ph;
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * Math.sin(Math.PI * ph) * a;
    }
    if (cone.current) (cone.current.material as THREE.MeshBasicMaterial).opacity = 0.12 * a;
    if (flag.current) {
      flag.current.scale.setScalar(ctx.reduced ? 1 : 1 + 0.15 * Math.sin(ctx.time.current * 6));
      (flag.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * a;
    }
  });
  const word = fx.label ?? '';
  return (
    <group position={pos}>
      <mesh ref={ring} rotation-x={-Math.PI / 2}><ringGeometry args={[0.52, 0.62, 48]} /><meshBasicMaterial {...basicMat(color, 0)} side={THREE.DoubleSide} /></mesh>
      <mesh ref={cone} position-y={0.85}><cylinderGeometry args={[0.15, 0.65, 1.7, 32, 1, true]} /><meshBasicMaterial {...basicMat(color, 0.12)} side={THREE.DoubleSide} /></mesh>
      <mesh ref={flag} position-y={1.75}><octahedronGeometry args={[0.1]} /><meshBasicMaterial {...basicMat(color, 0.55)} /></mesh>
      {word && <HoloCard position={[0, 2.15, 0]} text={word} tone={fx.tone} ctx={ctx} />}
    </group>
  );
}
