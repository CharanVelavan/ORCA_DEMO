import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { NodeInfo } from '../../pipeline/pipelineStore';
import { HUMAN_POS } from '../geo';
import { basicMat, HoloCard, type FxCtx } from './common';

/** Green-blue wireframe shield hovering mid-map: waits blue while approvals are pending, pulses green on approval. */
export function CommanderFx({ ctx, nodes, pending }: { ctx: FxCtx; nodes: Record<string, NodeInfo>; pending: boolean }) {
  const human = nodes.human;
  const approved = human?.word === 'APPROVED' || human?.word === 'AUTO';
  const rejected = human?.word === 'REJECTED';
  const wait = useRef<THREE.Mesh>(null);
  const wire = useRef<THREE.Mesh>(null);
  const grp = useRef<THREE.Group>(null);
  const kick = useRef(0);
  const was = useRef(false);
  const blue = new THREE.Color(ctx.palette.accent), green = new THREE.Color(ctx.palette.ok), red = new THREE.Color(ctx.palette.critical);
  useFrame((_, dt) => {
    const a = pending ? 1 : ctx.alpha.current;
    if (approved && !was.current) kick.current = 1;
    was.current = approved;
    kick.current = Math.max(0, kick.current - dt * 1.1);
    const target = approved ? green : rejected ? red : blue;
    for (const m of [wait.current, wire.current]) if (m) (m.material as THREE.MeshBasicMaterial).color.lerp(target, 1 - Math.exp(-dt * 6));
    const breathe = ctx.reduced ? 0 : 0.04 * Math.sin(ctx.time.current * (pending ? 3 : 1.5));
    const s = 1 + breathe + (ctx.reduced ? 0 : 0.35 * Math.sin(Math.PI * (1 - kick.current)) * (kick.current > 0 ? 1 : 0));
    if (grp.current) { grp.current.scale.setScalar(s); if (!ctx.reduced) grp.current.rotation.y += dt * 0.3; grp.current.visible = a > 0.01; }
    if (wait.current) (wait.current.material as THREE.MeshBasicMaterial).opacity = (0.08 + 0.18 * kick.current) * a;
    if (wire.current) (wire.current.material as THREE.MeshBasicMaterial).opacity = (0.55 + 0.4 * kick.current) * a;
  });
  const text = human?.word ? human.word : 'COMMANDER';
  return (
    <group position={HUMAN_POS}>
      <group ref={grp}>
        <mesh ref={wait}><icosahedronGeometry args={[0.75, 1]} /><meshBasicMaterial {...basicMat(ctx.palette.accent, 0.1)} /></mesh>
        <mesh ref={wire}><icosahedronGeometry args={[0.78, 1]} /><meshBasicMaterial {...basicMat(ctx.palette.accent, 0.6, { wireframe: true })} /></mesh>
      </group>
      <HoloCard position={[0, 2.2, 0]} text={text} tone={approved ? 'ok' : rejected ? 'critical' : 'accent'} ctx={ctx} keep={pending} />
    </group>
  );
}
