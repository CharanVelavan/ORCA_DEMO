import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls, useGLTF } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useLiveStore } from '../store';
import { useUi } from '../stage/uiStore';
import type { LiveEvent, SiteState } from '../types';
import { api } from '../api';
import { models } from '../derive';
import { usePipeline } from '../pipeline/pipelineStore';
import { shotFor, DEFAULT_OFFSET, type Effect } from './beats3d';
import { EffectsLayer, useFxDescriptor } from './effects/EffectsLayer';
import { attackerHome, GATEWAYS, MGMT, SAT, SITES, type Palette } from './geo';
import './scene.css';

// Stage/Console 3D network (plan section 10). Emulated Chennai: 6 sites, 3 gateways, one GEO satellite.
// No bloom; colours come from the CSS tokens at runtime. Beat-driven effects live in ./effects (see beats3d.ts).

const readPalette = (): Palette => {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return { bg: v('--bg', '#111316'), surface: v('--surface', '#1A1D21'), surface2: v('--surface-2', '#22262B'), ink: v('--ink', '#E7E9EC'), muted: v('--ink-muted', '#9AA3AE'), border: v('--border', '#2A2E34'), accent: v('--accent', '#7FA7CF'), ok: v('--ok', '#74B08C'), warn: v('--warn', '#D6A24E'), critical: v('--critical', '#E07F72'), healing: v('--healing', '#A39BDA'), unknown: v('--unknown', '#8A8F98') };
};
const stateColor = (p: Palette, s?: string) => s === 'down' ? p.critical : s === 'degraded' ? p.warn : s === 'healing' ? p.healing : s === 'ok' ? p.ok : p.unknown;
const stateWord = (s?: string) => s === 'down' ? 'Down' : s === 'degraded' ? 'Degraded' : s === 'healing' ? 'Recovering' : s === 'ok' ? 'Operational' : 'Unavailable';
const stateIcon = (s?: string) => s === 'down' ? '×' : s === 'degraded' ? '!' : s === 'healing' ? '↻' : s === 'ok' ? '✓' : '?';
type SiteTopology = Record<string, { paths?: Record<string, [string, string]> }>;
const NO_TRUTH: LiveEvent[] = [];
const BUILDINGS: [number, number][] = [[-3.4, -0.5], [-2.7, 0.2], [-2.3, 1.1], [-1.6, -2.8], [-0.4, -2.7], [0.2, -0.8], [-0.2, 2.5], [1.0, 0.5], [0.9, 3.5]];

function Model({ name, palette, scale = 1, opacity = 1, ...rest }: { name: string; palette: Palette; scale?: number; opacity?: number } & JSX.IntrinsicElements['group']) {
  const { scene } = useGLTF('./models/orca-assets.glb');
  const obj = useMemo(() => {
    const src = scene.getObjectByName(name);
    if (!src) return null;
    const c = src.clone(true);
    c.position.set(0, 0, 0);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const old = m.material as THREE.MeshStandardMaterial;
      const key = old.name;
      const color = key === 'panel' ? palette.accent : key === 'accent' ? palette.warn : key === 'dark' ? palette.surface : palette.muted;
      m.material = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, transparent: opacity < 1, opacity });
    });
    return c;
  }, [scene, name, palette, opacity]);
  useEffect(() => () => {
    obj?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }, [obj]);
  if (!obj) return null;
  return <group {...rest} scale={scale}><primitive object={obj} /></group>;
}

function Ground({ palette }: { palette: Palette }) {
  // Chennai tile with a stylised coastline on the east (Bay of Bengal).
  const coast = useMemo(() => [[2.2, 0.01, -4.5], [2.0, 0.01, -3.0], [2.3, 0.01, -1.4], [2.1, 0.01, 0.2], [2.4, 0.01, 1.6], [2.3, 0.01, 3.2], [2.6, 0.01, 4.5]] as [number, number, number][], []);
  const buildings = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!buildings.current) return;
    const object = new THREE.Object3D();
    BUILDINGS.forEach(([x, z], i) => {
      object.position.set(x, 0.16 + (i % 3) * 0.08, z);
      object.scale.set(1, 1 + (i % 3) * 0.5, 1);
      object.updateMatrix();
      buildings.current!.setMatrixAt(i, object.matrix);
    });
    buildings.current.instanceMatrix.needsUpdate = true;
    buildings.current.computeBoundingSphere();
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[-1.5, -0.01, 0]}><planeGeometry args={[9, 10]} /><meshStandardMaterial color={palette.surface} roughness={1} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[5.0, -0.02, 0]}><planeGeometry args={[5, 10]} /><meshStandardMaterial color={palette.bg} roughness={1} /></mesh>
      <gridHelper args={[14, 28, palette.border, palette.border]} position={[0, 0.001, 0]} />
      <Line points={coast} color={palette.accent} lineWidth={1.2} transparent opacity={0.55} />
      <instancedMesh ref={buildings} args={[undefined, undefined, BUILDINGS.length]}>
        <boxGeometry args={[0.32, 0.32, 0.3]} />
        <meshStandardMaterial color={palette.surface2} roughness={1} />
      </instancedMesh>
    </group>
  );
}

function Satellite({ palette }: { palette: Palette }) {
  const g = useRef<THREE.Group>(null);
  const reduced = useReducedMotionFlag();
  useFrame(({ clock }) => { if (g.current && !reduced) g.current.rotation.y = Math.sin(clock.elapsedTime * 0.15) * 0.25; });
  const arc = useMemo(() => new THREE.EllipseCurve(0, 0, 9, 9, Math.PI * 0.15, Math.PI * 0.85).getPoints(48).map((p) => [p.x - 0.6, 5.2 + (p.y - 9 * Math.sin(Math.PI / 2)) * 0.25, -0.4] as [number, number, number]), []);
  return (
    <group>
      <Line points={arc} color={palette.border} lineWidth={1} dashed dashSize={0.2} gapSize={0.15} />
      <group ref={g} position={SAT}><Model name="Satellite" palette={palette} scale={1.3} /></group>
      <Html position={[SAT[0], SAT[1] + 0.9, SAT[2]]} center><span className="scn-label scn-label--sat">GEO satellite - Emulated</span></Html>
    </group>
  );
}

type LinkView = { id: string; points: [number, number, number][]; color: string; packetColor: string; path?: string; state?: string; satellite: boolean };

function Packets({ links, reduced }: { links: LinkView[]; reduced: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const moving = useMemo(() => links.filter((link) => link.state !== 'down').map((link) => ({
    curve: new THREE.CatmullRomCurve3(link.points.map((point) => new THREE.Vector3(...point))),
    color: new THREE.Color(link.packetColor),
  })), [links]);
  const object = useMemo(() => new THREE.Object3D(), []);
  const point = useMemo(() => new THREE.Vector3(), []);
  const place = (elapsed: number) => {
    if (!ref.current) return;
    moving.forEach(({ curve }, i) => {
      curve.getPoint((elapsed * 0.11) % 1, point);
      object.position.copy(point);
      object.updateMatrix();
      ref.current!.setMatrixAt(i, object.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  };
  useLayoutEffect(() => {
    if (!ref.current) return;
    moving.forEach(({ color }, i) => ref.current!.setColorAt(i, color));
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    place(0);
  }, [moving]);
  useFrame(({ clock }) => { if (!reduced) place(clock.elapsedTime); });
  if (!moving.length) return null;
  return <instancedMesh key={moving.length} ref={ref} args={[undefined, undefined, moving.length]} frustumCulled={false}>
    <sphereGeometry args={[0.055, 8, 8]} /><meshBasicMaterial />
  </instancedMesh>;
}

function Links({ palette, sites, paths, topology, reduced }: { palette: Palette; sites: Record<string, SiteState>; paths: Record<string, unknown>[]; topology: SiteTopology; reduced: boolean }) {
  const links = useMemo<LinkView[]>(() => Object.entries(SITES).flatMap(([id, s]) => {
    const st = sites[id];
    const active = paths.find((p) => p.site === id && p.active) as { path?: string; gateway?: string; kind?: string } | undefined;
    const path = active?.path ?? st?.active_path;
    const pathInfo = path ? topology[id]?.paths?.[path] : undefined;
    const gw = active?.gateway ?? st?.gateway ?? pathInfo?.[1];
    const g = gw ? GATEWAYS[gw] : undefined;
    if (!st || !g || !pathInfo) return [];
    const satellite = pathInfo[0] === 'satellite';
    const top: [number, number, number] = [s.pos[0], 0.95, s.pos[2]];
    const gateway: [number, number, number] = [g.pos[0], 0.9, g.pos[2]];
    return [{ id, points: satellite ? [top, SAT, gateway] : [top, gateway], color: stateColor(palette, st.state),
      packetColor: path === 'B' ? palette.healing : palette.accent, path, state: st.state, satellite }];
  }), [palette, sites, paths, topology]);
  return (
    <group>
      {links.map((link) => <Line key={link.id} points={link.points} color={link.color} lineWidth={link.path === 'B' ? 2 : 1.4}
        transparent opacity={link.state === 'down' ? 0.35 : 0.8} dashed={!link.satellite || link.state === 'down'} dashSize={0.16} gapSize={0.12} />)}
      <Packets links={links} reduced={reduced} />
    </group>
  );
}

function Sites({ palette, sites, focus, compact }: { palette: Palette; sites: Record<string, SiteState>; focus: string | null; compact: boolean }) {
  return (
    <group>
      {Object.entries(SITES).map(([id, s]) => {
        const st = sites[id];
        const color = stateColor(palette, st?.state);
        return (
          <group key={id} position={s.pos}>
            <mesh rotation-x={-Math.PI / 2} position-y={0.005}><ringGeometry args={[0.32, 0.4, 40]} /><meshBasicMaterial color={color} transparent opacity={0.9} /></mesh>
            <Model name="CellTower" palette={palette} scale={0.95} />
            <Model name="UserTerminal" palette={palette} scale={0.32} position={[0.45, 0, 0.25]} />
            <Html position={[0, 1.25, 0]} center>
              <span className={`scn-label ${focus === id ? 'is-focus' : ''}`} data-state={st?.state ?? 'unknown'} data-asset={compact ? id : undefined} title={`${s.name}: ${stateWord(st?.state)}`}><span className="scn-state-icon" aria-hidden>{stateIcon(st?.state)}</span>{s.name}{!compact && <b>{stateWord(st?.state)}</b>}</span>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function Gateways({ palette, gateways, compact }: { palette: Palette; gateways: Record<string, string>; compact: boolean }) {
  return (
    <group>
      {Object.entries(GATEWAYS).map(([id, g]) => (
        <group key={id} position={g.pos}>
          <Model name="GatewayDish" palette={palette} scale={1.1} opacity={g.foreign ? 0.35 : 1} />
          <Html position={[0, 1.4, 0]} center>
            <span className="scn-label" data-state={g.foreign ? 'locked' : gateways[id] === 'down' ? 'down' : gateways[id] === 'up' ? 'ok' : 'unknown'} data-asset={compact ? id : undefined} title={`${g.name}: ${g.foreign ? 'Not allowed' : stateWord(gateways[id] === 'up' ? 'ok' : gateways[id])}`}><span className="scn-state-icon" aria-hidden>{g.foreign ? '×' : stateIcon(gateways[id] === 'up' ? 'ok' : gateways[id])}</span>{compact ? id : g.name}{!compact && <b>{g.foreign ? 'Not allowed' : stateWord(gateways[id] === 'up' ? 'ok' : gateways[id])}</b>}</span>
          </Html>
        </group>
      ))}
    </group>
  );
}

function Attacker({ palette, target, injector }: { palette: Palette; target: string | null; injector: string }) {
  const m = useRef<THREE.Mesh>(null);
  const g = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  const reduced = useReducedMotionFlag();
  useEffect(() => { born.current = null; }, [target, injector]);
  useFrame(({ clock }) => {
    if (m.current && !reduced) { m.current.rotation.y = clock.elapsedTime; m.current.position.y = 2.2 + Math.sin(clock.elapsedTime * 2) * 0.08; }
    if (g.current) { // the threat node rises in
      born.current ??= clock.elapsedTime;
      g.current.scale.setScalar(reduced ? 1 : Math.min(1, (clock.elapsedTime - born.current) / 0.6));
    }
  });
  if (!target) return null;
  const pos = attackerHome(injector, target);
  return (
    <group ref={g} position={pos}>
      <mesh ref={m} position-y={2.2}><octahedronGeometry args={[0.22]} /><meshStandardMaterial color={palette.critical} roughness={0.6} /></mesh>
      <Line points={[[0, 2.2, 0], [0, 0.05, 0]]} color={palette.critical} lineWidth={1.2} dashed dashSize={0.12} gapSize={0.1} />
      <Html position={[0, 2.85, 0]} center><span className="scn-label scn-label--threat">Threat source · director view</span></Html>
    </group>
  );
}

/** SAT-MGMT: the satellite operator's management network, a small server block beside GW-IN-1. */
function Mgmt({ palette, suspected, reduced, compact }: { palette: Palette; suspected: boolean; reduced: boolean; compact: boolean }) {
  const g = GATEWAYS['GW-IN-1'].pos;
  const pulse = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!pulse.current || reduced) return;
    pulse.current.scale.setScalar(1 + 0.12 * Math.sin(clock.elapsedTime * 1.5));
  });
  return (
    <group>
      <group position={MGMT}>
        {suspected && <mesh ref={pulse} rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.55, 0.66, 32]} /><meshBasicMaterial color={palette.warn} transparent opacity={0.38} /></mesh>}
        <mesh position-y={0.3}><boxGeometry args={[0.6, 0.6, 0.42]} /><meshStandardMaterial color={palette.surface2} roughness={0.9} /></mesh>
        <mesh position-y={0.62}><boxGeometry args={[0.6, 0.05, 0.42]} /><meshStandardMaterial color={palette.accent} roughness={0.8} /></mesh>
        <Html position={[0, 0.95, 0]} center><span className="scn-label scn-label--mgmt" data-state={suspected ? 'degraded' : 'unknown'} data-asset={compact ? 'SAT-MGMT' : undefined}><span className="scn-state-icon" aria-hidden>{suspected ? '!' : '?'}</span>SAT-MGMT {!compact && <b>{suspected ? 'Suspected' : 'Not assessed'}</b>}</span></Html>
      </group>
      <Line points={[[MGMT[0], 0.6, MGMT[2]], [g[0], 0.9, g[2]]]} color={palette.border} lineWidth={1} dashed dashSize={0.12} gapSize={0.1} />
    </group>
  );
}

/**
 * Camera: scripted shot per effect kind (threat close-up, agent cluster, commander wide, heal follow), eased with a
 * critically damped exponential. Dragging pauses the auto-follow for 8 s. Without a beat, follows the site in trouble.
 */
function CameraRig({ focus, fx }: { focus: string | null; fx: Effect }) {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const target = useRef(new THREE.Vector3(0, 2.4, 0));
  const want = useRef(new THREE.Vector3(0, 2.4, 0));
  const wantOff = useRef(new THREE.Vector3(...DEFAULT_OFFSET));
  const pausedUntil = useRef(0);
  const reduced = useReducedMotionFlag();
  const nodes = useRef(usePipeline.getState().nodes);
  useEffect(() => usePipeline.subscribe((s) => { nodes.current = s.nodes; }), []);
  useEffect(() => {
    const shot = shotFor(fx, nodes.current);
    if (shot) { want.current.set(...shot.target); wantOff.current.set(...shot.offset); return; }
    const p = focus ? SITES[focus]?.pos ?? GATEWAYS[focus]?.pos : null;
    want.current.set(p ? p[0] * 0.4 : 0, 2.4, p ? p[2] * 0.4 : 0); // overview keeps the satellite (y 5.2) in frame
    wantOff.current.set(...DEFAULT_OFFSET);
  }, [focus, fx]);
  useEffect(() => {
    if (!controls) return;
    // Rotating or zooming by hand holds the scripted camera for 25 s; 'orca-3d-reset' hands control back at once.
    const pause = () => { pausedUntil.current = performance.now() + 25000; };
    const resume = () => { pausedUntil.current = 0; };
    window.addEventListener('orca-3d-reset', resume);
    controls.addEventListener('start', pause);
    controls.addEventListener('end', pause);
    return () => { controls.removeEventListener('start', pause); controls.removeEventListener('end', pause); window.removeEventListener('orca-3d-reset', resume); };
  }, [controls]);
  const goal = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    if (performance.now() < pausedUntil.current) { controls?.update(); return; }
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 3.2); // about 1.2 s per shot, no bounce
    target.current.lerp(want.current, k);
    goal.copy(target.current).add(wantOff.current);
    camera.position.lerp(goal, k);
    if (controls) { controls.target.copy(target.current); controls.update(); } else camera.lookAt(target.current);
  });
  return null;
}

function useReducedMotionFlag() {
  const [r, setR] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const mq = window.matchMedia('(prefers-reduced-motion: reduce)'); const f = () => setR(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  return r;
}

export function NetworkScene({ truth, compact = false }: { truth: boolean; compact?: boolean }) {
  const theme = useUi((s) => s.theme);
  const [palette, setPalette] = useState<Palette>(readPalette);
  useEffect(() => { const id = requestAnimationFrame(() => setPalette(readPalette())); return () => cancelAnimationFrame(id); }, [theme]);
  const sites = useLiveStore((s) => s.sites);
  const gateways = useLiveStore((s) => s.gateways);
  const paths = useLiveStore((s) => s.paths);
  const modelEvents = useLiveStore((s) => s.models);
  const [topology, setTopology] = useState<SiteTopology>({});
  const [topologyError, setTopologyError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    api.catalogue().then((catalogue) => {
      if (!catalogue.sites || typeof catalogue.sites !== 'object' || Array.isArray(catalogue.sites)) {
        throw new Error('The catalogue did not include site paths.');
      }
      if (active) { setTopology(catalogue.sites as SiteTopology); setTopologyError(null); }
    }).catch((error: unknown) => {
      if (active) { setTopology({}); setTopologyError(error instanceof Error ? error.message : 'Catalogue request failed.'); }
    });
    return () => { active = false; };
  }, []);
  const truthEvents = useLiveStore((s) => truth ? s.truth : NO_TRUTH);
  const [focus, setFocus] = useState<string | null>(null);
  const prev = useRef<Record<string, string>>({});
  useEffect(() => {
    for (const [id, st] of Object.entries(sites)) {
      if (prev.current[id] && prev.current[id] !== st.state) setFocus(st.state === 'ok' ? null : id);
      prev.current[id] = st.state;
    }
  }, [sites]);
  // Attacker marker: ground truth only (Stage, Control, Review). Never on the Console.
  const lastInject = truth ? truthEvents.filter((e) => e.kind === 'inject').slice(-1)[0] : undefined;
  const injTarget = lastInject ? String(lastInject.target ?? '') : null;
  const attackTarget = injTarget && (SITES[injTarget] || GATEWAYS[injTarget]) ? injTarget : injTarget ? 'CHN-01' : null;
  const isAttack = lastInject && String(lastInject.truth_class ?? '').startsWith('attack');
  const injector = lastInject ? String(lastInject.injector ?? '') : '';
  const fx = useFxDescriptor();
  const reduced = useReducedMotionFlag();
  const m3 = models({ models: truth ? modelEvents : modelEvents.filter((event) => event.audience !== 'control') }).find((model) => model.id === 'M3');
  const suspected = m3?.klass === 'attack-management-plane' && !m3.abstain;

  return (
    <div className="scn" data-theme-key={theme}>
      <div className="scn-viewport">
      <Canvas dpr={[1, 1.5]} frameloop={reduced ? 'demand' : 'always'} camera={{ position: [10, 9, 12], fov: 42 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={[palette.bg]} />
        <fog attach="fog" args={[palette.bg, 16, 30]} />
        <hemisphereLight args={[palette.ink, palette.bg, 0.9]} />
        <directionalLight position={[4, 8, 3]} intensity={1.1} />
        <Suspense fallback={null}>
          <Ground palette={palette} />
          <Links palette={palette} sites={sites} paths={paths} topology={topology} reduced={reduced} />
          <Sites palette={palette} sites={sites} focus={focus} compact={compact} />
          <Gateways palette={palette} gateways={gateways} compact={compact} />
          <Satellite palette={palette} />
          {truth && isAttack && <Attacker palette={palette} target={attackTarget} injector={injector} />}
          <Mgmt palette={palette} suspected={suspected} reduced={reduced} compact={compact} />
          {truth && <EffectsLayer fx={fx} palette={palette} truth={truth} reduced={reduced} />}
        </Suspense>
        <OrbitControls makeDefault target={[0, 2.2, 0]} enablePan={false} enableZoom zoomSpeed={0.8} minDistance={3.5} maxDistance={24} enableDamping={!reduced} dampingFactor={0.12} maxPolarAngle={Math.PI / 2.15} minPolarAngle={0.35} />
        {truth && <CameraRig focus={focus} fx={fx} />}
      </Canvas>
      <div className="scn-tag">Emulated network - Chennai</div>
      {topologyError && <p className="scn-error" role="alert">Network topology unavailable: {topologyError}</p>}
      <div className="scn-legend" aria-label="Network status and emulated link legend">
        <span data-state="ok"><b>✓</b> Operational</span><span data-state="degraded"><b>!</b> Degraded</span><span data-state="down"><b>×</b> Down</span><span data-state="healing"><b>↻</b> Recovering</span>
        <span className="scn-link-key">Emulated satellite link</span><span className="scn-link-key scn-link-key--land">Emulated terrestrial link</span>
      </div>
      </div>
      {compact && <ul className="scn-roster" aria-label="Observed site and ground-network status">
        {Object.entries(SITES).map(([id, site]) => <li key={id} data-state={sites[id]?.state ?? 'unknown'} title={id}><strong>{site.name}</strong><span aria-hidden>{stateIcon(sites[id]?.state)}</span><b>{stateWord(sites[id]?.state)}</b></li>)}
        {Object.entries(GATEWAYS).map(([id, gateway]) => {
          const state = gateway.foreign ? 'locked' : gateways[id] === 'up' ? 'ok' : gateways[id] === 'down' ? 'down' : 'unknown';
          return <li key={id} data-state={state} title={gateway.name}><strong>{id}</strong><span aria-hidden>{gateway.foreign ? '×' : stateIcon(state)}</span><b>{gateway.foreign ? 'Not allowed' : stateWord(state)}</b></li>;
        })}
        <li data-state={suspected ? 'degraded' : 'unknown'}><strong>SAT-MGMT</strong><span aria-hidden>{suspected ? '!' : '?'}</span><b>{suspected ? 'Suspected' : 'Not assessed'}</b></li>
      </ul>}
    </div>
  );
}

useGLTF.preload('./models/orca-assets.glb');
