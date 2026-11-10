import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Palette, V3 } from '../geo';

export type FxCtx = {
  palette: Palette;
  reduced: boolean;
  truth: boolean;
  /** Seconds since the current effect started (resets when kind, site or beat changes). */
  age: MutableRefObject<number>;
  /** Seconds since the last beat or packet arrived (drives packet-dot travel). */
  pktAge: MutableRefObject<number>;
  /** 1 while the beat is fresh, fading to 0 about 3.5 s after the last beat or packet. */
  alpha: MutableRefObject<number>;
  /** Wall-clock seconds, for ambient motion. */
  time: MutableRefObject<number>;
};

export const ease = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Apply an opacity multiplier to every non-shader material below a group (base opacity is remembered). */
export function fadeGroup(g: THREE.Object3D | null, a: number) {
  if (!g) return;
  g.visible = a > 0.01;
  if (!g.visible) return;
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      if ((mat as THREE.ShaderMaterial).isShaderMaterial) continue;
      mat.userData.base ??= mat.opacity;
      mat.opacity = (mat.userData.base as number) * a;
    }
  });
}

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor; uniform float uProgress; uniform float uTime; uniform float uAlpha; uniform float uDash; uniform float uSolid;
void main(){
  if (vUv.x > uProgress) discard;
  float d = fract(vUv.x * uDash - uTime);
  float dash = smoothstep(0.0, 0.1, d) * (1.0 - smoothstep(0.5, 0.62, d));
  float head = smoothstep(0.1, 0.0, uProgress - vUv.x);
  float a = mix(0.18 + 0.82 * dash, 1.0, uSolid) * 0.9 + head;
  gl_FragColor = vec4(uColor * (1.0 + head * 0.8), clamp(a, 0.0, 1.0) * uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Thin tube along a curve with an animated dash pattern and a crawling head (uv-based, no textures). */
export function BeamTube({ curve, color, radius = 0.035, dash = 14, speed = 2.2, solid = 0, progress, alpha, ctx }: {
  curve: THREE.Curve<THREE.Vector3>; color: string; radius?: number; dash?: number; speed?: number; solid?: number;
  progress?: MutableRefObject<number> | (() => number); alpha?: MutableRefObject<number> | number; ctx: FxCtx;
}) {
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 56, radius, 6, false), [curve, radius]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uProgress: { value: 1 }, uTime: { value: 0 }, uAlpha: { value: 1 }, uDash: { value: dash }, uSolid: { value: solid } },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mat.uniforms.uColor.value.set(color); mat.uniforms.uDash.value = dash; mat.uniforms.uSolid.value = solid; }, [mat, color, dash, solid]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(() => {
    const p = progress === undefined ? 1 : typeof progress === 'function' ? progress() : progress.current;
    mat.uniforms.uProgress.value = ctx.reduced ? 1 : p;
    mat.uniforms.uTime.value = ctx.reduced ? 0 : ctx.time.current * speed;
    mat.uniforms.uAlpha.value = (alpha === undefined ? 1 : typeof alpha === 'number' ? alpha : alpha.current) * ctx.alpha.current;
  });
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />;
}

/** Curve through points with a gentle upward arc between each pair. */
export function arcCurve(pts: V3[], lift = 0.5): THREE.CatmullRomCurve3 {
  const out: THREE.Vector3[] = [];
  pts.forEach((p, i) => {
    if (i > 0) { const a = pts[i - 1]; out.push(new THREE.Vector3((a[0] + p[0]) / 2, Math.max(a[1], p[1]) + lift, (a[2] + p[2]) / 2)); }
    out.push(new THREE.Vector3(...p));
  });
  return new THREE.CatmullRomCurve3(out, false, 'catmullrom', 0.3);
}

/** Floating holo card (HTML) that follows a 3D point; opacity is driven from the fx alpha. */
export function HoloCard({ position, text, tone, ctx, keep, sub }: { position: V3; text: string; tone: string; ctx: FxCtx; keep?: boolean; sub?: string }) {
  const el = useRef<HTMLDivElement>(null);
  useFrame(() => { if (el.current) el.current.style.opacity = String(keep ? 1 : ctx.alpha.current); });
  return (
    <Html position={position} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={el} className="scn-holo" data-tone={tone}><b>{text}</b>{sub ? <span>{sub}</span> : null}</div>
    </Html>
  );
}

/** Convenience: group whose descendants fade with the fx alpha (or stay at 1 when `keep`). */
export function FadeGroup({ ctx, keep, children, ...rest }: { ctx: FxCtx; keep?: boolean; children?: ReactNode } & JSX.IntrinsicElements['group']) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => fadeGroup(g.current, keep ? 1 : ctx.alpha.current));
  return <group ref={g} {...rest}>{children}</group>;
}

export const basicMat = (color: string, opacity = 1, extra: Partial<THREE.MeshBasicMaterialParameters> = {}) =>
  ({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, ...extra }) as THREE.MeshBasicMaterialParameters;
