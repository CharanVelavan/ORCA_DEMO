import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GATEWAYS as NETWORK_GATEWAYS, SAT, SITES as NETWORK_SITES } from '../scenes/geo';
import type { CatalogueSite } from '../sim/useCatalogue';
import type { SiteState } from '../types';
import type { Palette } from './palette';

const MODEL_URL = './models/orca-assets.glb';

// World layout. Earth top sits at y=0 under Chennai; the GEO arc is drawn about the Earth centre.
const EARTH_R = 30;
const EARTH_C = new THREE.Vector3(0, -EARTH_R, 0);
const SAT_POS = new THREE.Vector3(...SAT);
const ORBIT_R = Math.hypot(SAT_POS.x - EARTH_C.x, SAT_POS.y - EARTH_C.y);
const SAT_SCALE = 1.3;

type Site = { id: string; x: number; z: number; s: number; ry?: number };
const GATEWAYS: Site[] = Object.entries(NETWORK_GATEWAYS)
  .filter(([, gateway]) => !gateway.foreign)
  .map(([id, gateway]) => ({ id, x: gateway.pos[0], z: gateway.pos[2], s: 1.1, ry: 0.6 }));
const TOWERS: Site[] = Object.entries(NETWORK_SITES)
  .map(([id, site]) => ({ id, x: site.pos[0], z: site.pos[2], s: 0.95 }));
const TERMINALS: Site[] = TOWERS.map((site, index) => ({
  id: site.id, x: site.x + 0.45, z: site.z + 0.25, s: 0.32, ry: index * 0.4,
}));

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const LEG = 0.5;
const HOLD = 0.1;

type Waypoint = { p: THREE.Vector3; t: THREE.Vector3 };

/** Camera waypoints: Earth, satellite, gateway, then the emulated Chennai network. */
function buildWaypoints(): Waypoint[] {
  return [
    { p: new THREE.Vector3(-6, 10, 96), t: new THREE.Vector3(0, -9, 0) },
    { p: new THREE.Vector3(2, 9, 15), t: SAT_POS.clone() },
    { p: new THREE.Vector3(1.5, 5, 10), t: new THREE.Vector3(GATEWAYS[0].x, 0.8, GATEWAYS[0].z) },
    { p: new THREE.Vector3(10, 9, 16), t: new THREE.Vector3(-0.9, 2.3, 0) },
  ];
}

function Models({ pal }: { pal: Palette }) {
  const { scene, materials } = useGLTF(MODEL_URL) as unknown as {
    scene: THREE.Group; materials: Record<string, THREE.MeshStandardMaterial>;
  };
  const invalidate = useThree((s) => s.invalidate);

  // Recolour the shared GLB materials from tokens (dark: light-grey body, accent panels, warn trim, bg dark parts).
  useLayoutEffect(() => {
    const ink = new THREE.Color(pal.ink);
    const bg = new THREE.Color(pal.bg);
    const set = (name: string, c: THREE.Color) => {
      const m = materials[name];
      if (!m) return;
      m.color.copy(c);
      m.roughness = 0.85;
      m.metalness = 0;
      m.needsUpdate = true;
    };
    set('body', pal.light ? new THREE.Color(pal.surface2).lerp(ink, 0.14) : ink.clone().lerp(bg, 0.28));
    set('panel', new THREE.Color(pal.accent));
    set('accent', new THREE.Color(pal.warn));
    set('dark', pal.light ? bg.clone().lerp(ink, 0.82) : bg);
    invalidate();
  }, [materials, pal, invalidate]);

  const make = useMemo(() => (name: string) => {
    const src = scene.getObjectByName(name);
    return () => (src ? src.clone(true) : new THREE.Object3D());
  }, [scene]);
  const sat = useMemo(() => make('Satellite')(), [make]);
  const dishes = useMemo(() => GATEWAYS.map(() => make('GatewayDish')()), [make]);
  const towers = useMemo(() => TOWERS.map(() => make('CellTower')()), [make]);
  const terms = useMemo(() => TERMINALS.map(() => make('UserTerminal')()), [make]);

  return (
    <>
      <primitive object={sat} position={SAT_POS} scale={SAT_SCALE} rotation={[0.25, 0.7, 0.1]} />
      {dishes.map((o, i) => <primitive key={GATEWAYS[i].id} object={o} position={[GATEWAYS[i].x, 0, GATEWAYS[i].z]} scale={GATEWAYS[i].s} rotation={[0, GATEWAYS[i].ry ?? 0, 0]} />)}
      {towers.map((o, i) => <primitive key={TOWERS[i].id} object={o} position={[TOWERS[i].x, 0, TOWERS[i].z]} scale={TOWERS[i].s} />)}
      {terms.map((o, i) => <primitive key={TERMINALS[i].id} object={o} position={[TERMINALS[i].x, 0, TERMINALS[i].z]} scale={TERMINALS[i].s} rotation={[0, TERMINALS[i].ry ?? 0, 0]} />)}
    </>
  );
}

function Earth({ pal }: { pal: Palette }) {
  const lines = useMemo(() => {
    const pts: number[] = [];
    const seg = 128;
    for (let lat = -75; lat <= 75; lat += 15) {
      const phi = (lat * Math.PI) / 180;
      const r = EARTH_R * 1.003 * Math.cos(phi);
      const y = EARTH_R * 1.003 * Math.sin(phi);
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2;
        const a1 = ((i + 1) / seg) * Math.PI * 2;
        pts.push(Math.cos(a0) * r, y, Math.sin(a0) * r, Math.cos(a1) * r, y, Math.sin(a1) * r);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  useEffect(() => () => lines.dispose(), [lines]);
  const surface = pal.light ? pal.surface2 : pal.surface;
  return (
    <group position={EARTH_C} rotation={[0.28, 0, 0.42]}>
      <mesh>
        <sphereGeometry args={[EARTH_R, 48, 32]} />
        <meshStandardMaterial color={surface} roughness={1} metalness={0} />
      </mesh>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color={pal.border} transparent opacity={0.9} />
      </lineSegments>
    </group>
  );
}

function OrbitAndLinks({ pal, siteStates, topology }: {
  pal: Palette; siteStates?: Record<string, SiteState>; topology?: Record<string, CatalogueSite>;
}) {
  const { orbit, tile } = useMemo(() => {
    const o: number[] = [];
    const n = 160;
    const a0 = (38 * Math.PI) / 180;
    const a1 = (142 * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      const u = a0 + ((a1 - a0) * i) / n;
      const v = a0 + ((a1 - a0) * (i + 1)) / n;
      o.push(EARTH_C.x + ORBIT_R * Math.cos(u), EARTH_C.y + ORBIT_R * Math.sin(u), SAT_POS.z,
        EARTH_C.x + ORBIT_R * Math.cos(v), EARTH_C.y + ORBIT_R * Math.sin(v), SAT_POS.z);
    }
    const mk = (a: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
      return g;
    };
    const box = new THREE.BoxGeometry(12, 0.12, 9);
    return { orbit: mk(o), tile: { box, edges: new THREE.EdgesGeometry(box) } };
  }, []);
  useEffect(() => () => { orbit.dispose(); tile.box.dispose(); tile.edges.dispose(); }, [orbit, tile]);
  const links = useMemo(() => TOWERS.flatMap((site) => {
    const state = siteStates?.[site.id];
    const route = state?.active_path ? topology?.[site.id]?.paths?.[state.active_path] : undefined;
    if (!Array.isArray(route) || !state) return [];
    const gateway = NETWORK_GATEWAYS[state.gateway ?? route[1]];
    if (!gateway) return [];
    const top: [number, number, number] = [site.x, 0.95, site.z];
    const ground: [number, number, number] = [gateway.pos[0], 0.9, gateway.pos[2]];
    const points: [number, number, number][] = route[0] === 'satellite'
      ? [top, [SAT_POS.x, SAT_POS.y, SAT_POS.z], ground] : [top, ground];
    return [{ id: site.id, satellite: route[0] === 'satellite', points }];
  }), [siteStates, topology]);

  return (
    <>
      <lineSegments geometry={orbit}><lineBasicMaterial color={pal.inkMuted} transparent opacity={0.5} /></lineSegments>
      {links.map((link) => <Line key={link.id} points={link.points} color={pal.accent}
        lineWidth={1.3} transparent opacity={0.65} dashed={link.satellite} dashSize={0.22} gapSize={0.12} />)}
      <mesh geometry={tile.box} position={[1, -0.06, 0.2]}>
        <meshStandardMaterial color={pal.light ? pal.surface : pal.surface2} roughness={1} metalness={0} />
      </mesh>
      <lineSegments geometry={tile.edges} position={[1, -0.06, 0.2]}>
        <lineBasicMaterial color={pal.border} />
      </lineSegments>
    </>
  );
}

function City({ pal }: { pal: Palette }) {
  const blocks = useMemo(() => TOWERS.flatMap((site, i) => [
    { x: site.x - 0.6, z: site.z + 0.28, height: 0.22 + (i % 3) * 0.12 },
    { x: site.x + 0.55, z: site.z - 0.45, height: 0.3 + (i % 2) * 0.14 },
  ]), []);
  const building = useMemo(() => new THREE.Color(pal.surface2).lerp(new THREE.Color(pal.ink), pal.light ? 0.17 : 0.08), [pal]);
  return (
    <group>
      <gridHelper args={[10, 20, pal.border, pal.border]} position={[0, 0.012, 0]} />
      {blocks.map((block, i) => (
        <mesh key={i} position={[block.x, block.height / 2 + 0.02, block.z]}>
          <boxGeometry args={[0.3, block.height, 0.35]} />
          <meshStandardMaterial color={building} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function CameraRig({ reduced }: { reduced: boolean }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const wps = useMemo(() => buildWaypoints(), []);
  const t0 = useRef<number | null>(null);
  const look = useRef(new THREE.Vector3());
  const tmp = useRef(new THREE.Vector3());

  // Static framing (reduced motion) and initial pose before the first frame.
  useLayoutEffect(() => {
    const w = reduced ? wps[wps.length - 1] : wps[0];
    t0.current = null;
    camera.position.copy(w.p);
    look.current.copy(w.t);
    camera.lookAt(w.t);
    invalidate();
  }, [camera, wps, reduced, invalidate]);

  useFrame((state) => {
    if (reduced) return;
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    const el = state.clock.elapsedTime - t0.current - HOLD;
    const last = wps.length - 1;
    const p = camera.position;
    if (el < LEG * last) {
      const f = Math.max(0, el) / LEG;
      const leg = Math.min(last - 1, Math.floor(f));
      const k = easeInOutCubic(Math.min(1, f - leg));
      const a = wps[leg];
      const b = wps[leg + 1];
      p.lerpVectors(a.p, b.p, k);
      look.current.lerpVectors(a.t, b.t, k);
    } else {
      const d = el - LEG * last;
      const ramp = Math.min(1, d / 2.5);
      const m = ramp * ramp * (3 - 2 * ramp);
      const e = wps[last];
      p.set(
        e.p.x + Math.sin(d * 0.11) * 0.7 * m,
        e.p.y + Math.sin(d * 0.07 + 1) * 0.28 * m,
        e.p.z + Math.cos(d * 0.09) * 0.5 * m,
      );
      look.current.copy(tmp.current.copy(e.t));
    }
    camera.lookAt(look.current);
  });
  return null;
}

function Background({ color }: { color: string }) {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => { scene.background = new THREE.Color(color); invalidate(); }, [scene, color, invalidate]);
  return null;
}

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => { onReady(); }, [onReady]);
  return null;
}

export default function Scene3D({ pal, reduced, onReady, siteStates, topology }: {
  pal: Palette; reduced: boolean; onReady: () => void;
  siteStates?: Record<string, SiteState>; topology?: Record<string, CatalogueSite>;
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={reduced ? 'demand' : 'always'}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 35, near: 0.1, far: 400, position: [-6, 10, 96] }}
    >
      <Background color={pal.bg} />
      <ambientLight intensity={pal.light ? 1.5 : 0.9} />
      <directionalLight position={[18, 30, 22]} intensity={pal.light ? 1.7 : 2.3} />
      <directionalLight position={[-20, 6, -10]} intensity={0.35} />
      <Earth pal={pal} />
      <OrbitAndLinks pal={pal} siteStates={siteStates} topology={topology} />
      <City pal={pal} />
      <Suspense fallback={null}>
        <Models pal={pal} />
        <Ready onReady={onReady} />
      </Suspense>
      <CameraRig reduced={reduced} />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
