import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { backupGateway, siteFromExec, type Effect } from '../beats3d';
import type { NodeInfo } from '../../pipeline/pipelineStore';
import { GATEWAYS, placePos, SAT, SITES, type V3 } from '../geo';
import { arcCurve, BeamTube, basicMat, clamp01, ease, HoloCard, type FxCtx } from './common';
import { Shockwave } from './ThreatFx';

/** Blue wireframe stand-in of the site, beside it; turns green when the clone test passes (red if refused or rolled back). */
function GhostClone({ pos, final, ctx }: { pos: V3; final: string; ctx: FxCtx }) {
  const g = useRef<THREE.Group>(null);
  const blue = useMemo(() => new THREE.Color(ctx.palette.accent), [ctx.palette.accent]);
  const end = useMemo(() => new THREE.Color(final), [final]);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    if (!g.current) return;
    const t = ctx.age.current;
    const k = ctx.reduced ? 1 : ease((t - 1) / 0.6); // blue first, then the verdict colour
    col.copy(blue).lerp(end, k);
    const grow = ctx.reduced ? 1 : ease(t / 0.6);
    g.current.scale.set(1, grow, 1);
    g.current.position.y = (ctx.reduced ? 0 : (1 - grow) * -0.2);
    g.current.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (m && (m as THREE.Material).type === 'MeshBasicMaterial') { m.color.copy(col); m.opacity = (m.userData.o ??= m.opacity) * ctx.alpha.current * (ctx.reduced ? 1 : 0.85 + 0.15 * Math.sin(ctx.time.current * 4)); }
    });
  });
  return (
    <group position={[pos[0] - 0.95, 0, pos[2] + 0.5]}>
      <group ref={g}>
        <mesh position-y={0.47}><cylinderGeometry args={[0.04, 0.09, 0.95, 8]} /><meshBasicMaterial {...basicMat('#fff', 0.9, { wireframe: true })} /></mesh>
        <mesh position-y={0.97}><sphereGeometry args={[0.1, 10, 8]} /><meshBasicMaterial {...basicMat('#fff', 0.9, { wireframe: true })} /></mesh>
        <mesh position={[0.4, 0.12, 0.2]}><boxGeometry args={[0.3, 0.24, 0.24]} /><meshBasicMaterial {...basicMat('#fff', 0.9, { wireframe: true })} /></mesh>
        <mesh position-y={0.01} rotation-x={-Math.PI / 2}><ringGeometry args={[0.32, 0.4, 32]} /><meshBasicMaterial {...basicMat('#fff', 0.7)} /></mesh>
      </group>
    </group>
  );
}

const linkCurve = (id: string) => { const p = SITES[id].pos; return new THREE.LineCurve3(new THREE.Vector3(p[0], 0.95, p[2]), new THREE.Vector3(...SAT)); };

/** Rollout 5% / 25% / 100%: that share of the site links fills with green. */
function RolloutFill({ pct, first, color, ctx }: { pct: number; first: string; color: string; ctx: FxCtx }) {
  const ids = useMemo(() => [first, ...Object.keys(SITES).filter((s) => s !== first)].filter((s) => SITES[s]), [first]);
  const curves = useMemo(() => ids.map(linkCurve), [ids]);
  const lit = Math.max(1, Math.ceil((pct / 100) * ids.length));
  return (
    <group>
      {curves.map((c, i) => (
        <BeamTube key={ids[i]} curve={c} color={color} radius={0.05} dash={8} speed={1.5} solid={0.65}
          progress={() => (i < lit ? clamp01((ctx.age.current - i * 0.08) / 0.9) : 0)} ctx={ctx} />
      ))}
    </group>
  );
}

/** Green pulse along the backup path from the site to the (clean) backup gateway. */
function BackupPulse({ site, gw, color, blocked, ctx }: { site: string; gw: string; color: string; blocked: boolean; ctx: FxCtx }) {
  const s = SITES[site]?.pos ?? SITES['CHN-01'].pos, g = (GATEWAYS[gw] ?? GATEWAYS['GW-IN-2']).pos;
  const curve = useMemo(() => arcCurve([[s[0], 0.95, s[2]], [g[0], 0.9, g[2]]], 0.9), [s[0], s[2], g[0], g[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  return <BeamTube curve={curve} color={color} radius={0.055} dash={9} speed={3.5} solid={0.15} progress={() => Math.min(blocked ? 0.55 : 1, clamp01(ctx.age.current / 1.3))} ctx={ctx} />;
}

/** Short red beam hits a shield bubble around the site; the bubble flashes and bursts outward. */
function ReattackBubble({ pos, blocked, ctx }: { pos: V3; blocked: boolean; ctx: FxCtx }) {
  const shell = useRef<THREE.Mesh>(null);
  const wire = useRef<THREE.Mesh>(null);
  const beamA = useRef(1);
  const from = useMemo<V3>(() => [pos[0] + 2.2, 2.6, pos[2] - 1.9], [pos]);
  const c = new THREE.Vector3(pos[0], 0.65, pos[2]);
  const hit = useMemo(() => { const d = new THREE.Vector3(...from).sub(c).normalize().multiplyScalar(0.8); return c.clone().add(d); }, [from, pos]); // eslint-disable-line react-hooks/exhaustive-deps
  const curve = useMemo(() => new THREE.LineCurve3(new THREE.Vector3(...from), blocked ? hit : new THREE.Vector3(pos[0], 0.95, pos[2])), [from, hit, blocked, pos]);
  const color = blocked ? ctx.palette.accent : ctx.palette.critical;
  const progress = useRef(0);
  useFrame(() => {
    const t = ctx.age.current;
    progress.current = clamp01(t / 0.5);
    beamA.current = ctx.reduced ? 1 : 1 - clamp01((t - 0.55) / 0.35);
    const flash = ctx.reduced ? 0.5 : Math.max(0, 1 - (t - 0.5) / 0.7) * (t > 0.5 ? 1 : 0);
    const burst = ctx.reduced ? 1 : 1 + 0.3 * clamp01((t - 0.9) / 0.9);
    const a = ctx.alpha.current * (ctx.reduced ? 1 : 1 - 0.7 * clamp01((t - 1.0) / 1.2)); // bubble thins out after the burst
    for (const m of [shell.current, wire.current]) if (m) m.scale.setScalar(burst);
    if (shell.current) (shell.current.material as THREE.MeshBasicMaterial).opacity = (0.1 + 0.45 * flash) * a;
    if (wire.current) (wire.current.material as THREE.MeshBasicMaterial).opacity = (0.5 + 0.5 * flash) * a;
  });
  return (
    <group>
      {!ctx.reduced && <BeamTube curve={curve} color={ctx.palette.critical} radius={0.04} dash={10} speed={5} solid={0.6} progress={progress} alpha={beamA} ctx={ctx} />}
      <group position={[pos[0], 0.65, pos[2]]}>
        <mesh ref={shell}><sphereGeometry args={[0.78, 24, 16]} /><meshBasicMaterial {...basicMat(color, 0.1)} /></mesh>
        <mesh ref={wire}><icosahedronGeometry args={[0.8, 2]} /><meshBasicMaterial {...basicMat(color, 0.5, { wireframe: true })} /></mesh>
      </group>
    </group>
  );
}

export function HealFx({ fx, ctx, nodes }: { fx: Effect; ctx: FxCtx; nodes: Record<string, NodeInfo> }) {
  const step = fx.node.startsWith('exec:') ? fx.node.slice(5) : '';
  const site = (fx.site && SITES[fx.site] ? fx.site : siteFromExec(nodes)) ?? 'CHN-01';
  const pos = placePos(site) ?? SITES['CHN-01'].pos;
  const okc = ctx.palette.ok, badc = ctx.palette.critical;
  const info = nodes[fx.node];
  const bad = info?.tone === 'critical';
  const gw = backupGateway(nodes);
  let body: ReactNode = null;
  if (step === 'clone' || step === 'rollback') {
    const final = step === 'rollback' || bad ? badc : okc;
    body = <GhostClone pos={pos} final={final} ctx={ctx} />;
  } else if (step === 'r5' || step === 'r25' || step === 'r100') {
    body = <RolloutFill pct={step === 'r5' ? 5 : step === 'r25' ? 25 : 100} first={site} color={bad ? badc : okc} ctx={ctx} />;
  } else if (step === 'cleanpath' || step === 'failover') {
    body = <BackupPulse site={site} gw={gw} color={bad || gw === 'GW-XX' ? badc : okc} blocked={bad || gw === 'GW-XX'} ctx={ctx} />;
  } else if (step === 'reattack') {
    body = <ReattackBubble pos={pos} blocked={info?.word === 'BLOCKED'} ctx={ctx} />;
  } else if (step === 'return') {
    body = <Shockwave pos={pos} color={okc} ctx={ctx} ripples={1} />;
  }
  return (
    <group>
      {body}
      {fx.label && <HoloCard position={[pos[0], 2.05, pos[2]]} text={fx.label} tone={bad ? 'critical' : 'ok'} ctx={ctx} />}
    </group>
  );
}
