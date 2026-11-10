import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Check, CircleDashed, Maximize, Minus, Plus } from 'lucide-react';
import { useUi } from '../stage/uiStore';
import { useDerived } from '../derive';
import { graphEvidence } from './evidence';
import { ist } from '../stage/time';
import type { BandId, NodeDef } from './model';
import { ICONS } from './icons';
import { BANDS, NODES } from './pipelineNodes';
import { pathFor } from './scenarioPaths';
import { usePipeline, type Beat, type NodeInfo, type Packet, type Tone } from './pipelineStore';
import { FlowPanel } from '../shell/FlowPanel';
import type { FlowConfig } from '../shell/flowConfig';

// Flowchart (docs/plan/FLOWCHART_V2_PLAN.md, revised 9 Nov after review): one lane per step, top to bottom, a shape
// per kind of node. The whole chart is fitted to the panel with CSS zoom (no scrolling); the presenter can zoom in.
// Edges appear as packets cross them; the latest sentence is a small glass tile by the node that acted; hovering
// any node tells its name, role and what it is doing now.

const BAND_TITLE: Record<BandId, string> = {
  network: 'Chennai network', threat: 'Threat', detect: 'AI models detect', coordinate: 'Agents coordinate',
  commander: 'Commander decides', execute: 'Fix and self-heal', gaps: 'Policy gaps found',
};
const BAND_OF: Record<string, BandId> = Object.fromEntries(NODES.map((n) => [n.id, n.band]));
const DEF: Record<string, NodeDef> = Object.fromEntries(NODES.map((n) => [n.id, n]));
const EXEC_ORDER = ['exec:clone', 'exec:cleanpath', 'exec:failover', 'exec:r5', 'exec:r25', 'exec:r100', 'exec:reattack', 'exec:return', 'exec:rollback'];
const holdMs = (speed: number) => (speed >= 2 ? 750 : speed >= 1 ? 1200 : 1700);
const lit = (n?: NodeInfo) => !!n && (n.phase === 'active' || (n.phase === 'done' && !!n.at));
const MODEL_TAG: Record<string, string> = { 'model:M1': 'M1', 'model:M2': 'M2', 'model:M3': 'M3', 'model:M4': 'M4' };

/** Which nodes each lane shows. Lanes only show what matters to this run, so nothing is crammed. */
function laneNodes(band: BandId, nodes: Record<string, NodeInfo>, truth: boolean): string[] {
  const ids = NODES.filter((n) => n.band === band).map((n) => n.id);
  switch (band) {
    case 'threat':
      return truth ? ids.filter((id) => !DEF[id].consoleOnly && nodes[id] && nodes[id].phase !== 'idle') : ['threat:anomaly'];
    case 'execute': return EXEC_ORDER;
    case 'gaps':
      return ids.filter((id) => nodes[id] && (nodes[id].phase !== 'idle' || lit(nodes[id])));
    default:
      return ids;
  }
}

type Box = { x: number; y: number; w: number; h: number };
type Edge = { key: string; from: string; to: string; tone: Tone; n: number };

/** Curved route between two node boxes: vertical S-curve between lanes, an arc over the top inside a lane. */
function route(a: Box, b: Box): string {
  const ax = a.x + a.w / 2, bx = b.x + b.w / 2;
  if (Math.abs(a.y - b.y) < 8) {
    const y = Math.min(a.y, b.y) + 2, lift = Math.min(34, 14 + Math.abs(ax - bx) / 8);
    return `M${ax},${y} C${ax},${y - lift} ${bx},${y - lift} ${bx},${y}`;
  }
  const down = b.y > a.y;
  const y0 = down ? a.y + a.h : a.y, y1 = down ? b.y : b.y + b.h;
  const k = Math.max(20, Math.abs(y1 - y0) * 0.45) * (down ? 1 : -1);
  return `M${ax},${y0} C${ax},${y0 + k} ${bx},${y1 - k} ${bx},${y1}`;
}

export function FlowGraph({ truth = false, config }: { truth?: boolean; config?: FlowConfig }) {
  return config ? <FlowPanel config={config} /> : <FullFlowGraph truth={truth} />;
}

function FullFlowGraph({ truth }: { truth: boolean }) {
  const data = useDerived();
  const nodes = useMemo(() => graphEvidence(data), [data]);
  const beats = usePipeline((s) => s.beats);
  const mode = usePipeline((s) => s.mode);
  const explainIdx = usePipeline((s) => s.explainIdx);
  const scenario = usePipeline((s) => s.scenario);
  const current = usePipeline((s) => s.current);
  const speed = useUi((s) => s.config.speed);
  const reduced = !!useReducedMotion();

  const lanes = useMemo(() => BANDS.map((b) => ({ band: b, ids: laneNodes(b.id, nodes, truth) })), [nodes, truth]);
  const shown = useMemo(() => new Set(lanes.flatMap((l) => l.ids)), [lanes]);

  const step = mode === 'explain' ? pathFor(scenario)?.steps[explainIdx] : undefined;
  const beat: Beat | undefined = beats[beats.length - 1];
  const focusNode = step?.node ?? beat?.node ?? 'sat';
  const focusBand = BAND_OF[focusNode] ?? 'network';
  const reachedBand = BANDS.reduce((acc, b, i) => (lanes[i].ids.some((id) => lit(nodes[id])) && b.id !== 'network' ? i : acc), 0);

  // ---- fit to the panel: lay the chart out at width viewW / fit, then scale it by fit (plus the presenter's zoom).
  // transform: scale keeps measurement exact; the sizer gives the scroller the right size when zoomed in.
  const view = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [user, setUser] = useState(1);
  const [frame, setFrame] = useState({ vw: 0, vh: 0, lh: 0 });
  const zoom = fit * user;
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const fitRef = useRef(fit); fitRef.current = fit;

  // ---- measuring (boxes are in the chart's own, unscaled coordinates)
  const els = useRef(new Map<string, HTMLElement>());
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [size, setSize] = useState({ w: 0, h: 0 });
  const reg = useCallback((id: string) => (el: HTMLElement | null) => { if (el) els.current.set(id, el); else els.current.delete(id); }, []);
  const tries = useRef(0);
  const measure = useCallback(() => {
    const w = wrap.current, v = view.current; if (!w || !v) return;
    const z = zoomRef.current;
    const base = w.getBoundingClientRect();
    const out: Record<string, Box> = {};
    els.current.forEach((el, id) => { const r = el.getBoundingClientRect(); out[id] = { x: (r.left - base.left) / z, y: (r.top - base.top) / z, w: r.width / z, h: r.height / z }; });
    setBoxes(out); setSize({ w: w.offsetWidth, h: w.offsetHeight });
    const vw = v.clientWidth, vh = v.clientHeight, lh = w.offsetHeight;
    setFrame((f) => (f.vw === vw && f.vh === vh && f.lh === lh ? f : { vw, vh, lh }));
    // Converge on the scale whose re-flowed height fills the panel (a few damped steps).
    if (lh > 0 && vh > 0) {
      const f0 = fitRef.current, target = Math.max(0.6, Math.min(1.3, (vh / lh) * 0.985));
      const overflow = lh * f0 > vh + 2; // never leave the chart cut off, even after the fit has settled
      if (overflow && target < f0) setFit(+Math.max(0.6, Math.min(target, f0 - 0.01)).toFixed(3));
      else if (tries.current < 8 && Math.abs(target - f0) > 0.012) { tries.current++; setFit(+(f0 + (target - f0) * 0.75).toFixed(3)); }
    }
  }, []);
  useLayoutEffect(() => { const id = requestAnimationFrame(measure); return () => cancelAnimationFrame(id); }, [measure, nodes, lanes, zoom]);
  useEffect(() => {
    const v = view.current; if (!v) return;
    let last = '';
    const ro = new ResizeObserver(() => { const k = `${v.clientWidth}x${v.clientHeight}`; if (k !== last) { last = k; tries.current = 0; } measure(); });
    ro.observe(v);
    return () => ro.disconnect();
  }, [measure]);
  // New nodes can change the height: allow the fit to settle again.
  const shownKey = [...shown].join(',');
  useEffect(() => { tries.current = 0; }, [shownKey]);

  // ---- director queue: one packet holds the stage at a time (state is already updated)
  const next = usePipeline((s) => s.nextPacket);
  const queued = usePipeline((s) => s.queue.length);
  useEffect(() => { if (!current && queued) next(); }, [current, queued, next]);
  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(next, reduced ? 0 : holdMs(speed) + 80);
    return () => window.clearTimeout(t);
  }, [current, next, speed, reduced]);

  // ---- edges that have carried a packet this run
  const [edges, setEdges] = useState<Edge[]>([]);
  useEffect(() => { setEdges([]); }, [scenario]);
  useEffect(() => {
    if (!current) return;
    const key = `${current.from}>${current.to}`;
    setEdges((es) => {
      const old = es.find((e) => e.key === key);
      return [...es.filter((e) => e.key !== key), { key, from: current.from, to: current.to, tone: current.tone, n: (old?.n ?? 0) + 1 }].slice(-40);
    });
  }, [current]);

  // ---- hover card
  const [hover, setHover] = useState<string | null>(null);

  const activeKey = current ? `${current.from}>${current.to}` : '';
  const rail0 = boxes[`band:${BANDS[0].id}`], railN = boxes[`band:${BANDS[BANDS.length - 1].id}`], railR = boxes[`band:${BANDS[reachedBand].id}`];
  const railX = rail0 ? rail0.x + rail0.w / 2 : 0;
  const railTop = rail0 ? rail0.y + rail0.h / 2 : 0, railEnd = railN ? railN.y + railN.h / 2 : 0, railFill = railR ? railR.y + railR.h / 2 : railTop;

  return (
    <div className={`fg-view ${user > 1.001 ? 'is-zoomed' : ''}`} ref={view}>
      <div className="fg-sizer" style={{ width: frame.vw ? (frame.vw / fit) * zoom : '100%', height: frame.lh ? frame.lh * zoom : undefined }}>
      <div className="fg" ref={wrap} style={{ width: frame.vw ? frame.vw / fit : '100%', transform: `scale(${zoom})` }} data-reduced={reduced || undefined} onMouseLeave={() => setHover(null)}>
        {rail0 && railN && <>
          <div className="fg-rail" style={{ left: railX - 1.5, top: railTop, height: railEnd - railTop }} aria-hidden />
          <div className="fg-rail fg-rail--fill" style={{ left: railX - 1.5, top: railTop, height: railEnd - railTop, transform: `scaleY(${railEnd > railTop ? (railFill - railTop) / (railEnd - railTop) : 0})` }} aria-hidden />
        </>}
        <svg className="fg-edges" width={size.w} height={size.h} aria-hidden>
          {edges.map((e) => {
            const a = boxes[e.from], b = boxes[e.to];
            if (!a || !b || !shown.has(e.from) || !shown.has(e.to)) return null;
            const on = e.key === activeKey;
            return <path key={e.key} d={route(a, b)} className={`fg-e t-${e.tone} ${on ? 'is-on' : ''}`} />;
          })}
        </svg>
        {lanes.map(({ band, ids }, i) => {
          const state = band.id === focusBand ? 'now' : i <= reachedBand ? 'past' : 'future';
          const Icon = ICONS[band.icon];
          return (
            <section key={band.id} className={`fg-lane is-${state}`} data-band={band.id} aria-label={BAND_TITLE[band.id]}>
              <header className="fg-lh">
                <span className="fg-lh__n mono" ref={reg(`band:${band.id}`)}>{band.n}</span>
                <span className="fg-lh__t"><Icon size={15} strokeWidth={1.75} aria-hidden />{band.id === 'threat' && !truth ? 'Anomaly' : BAND_TITLE[band.id]}</span>
              </header>
              <div className={`fg-row fg-row--${band.id}`}>
                {ids.length === 0 && <Ghost band={band.id} />}
                {ids.map((id) => <GraphNode key={id} id={id} info={nodes[id]} focus={id === focusNode} reg={reg(id)} onHover={setHover} />)}
              </div>
            </section>
          );
        })}
        {current && !reduced && boxes[current.from] && boxes[current.to] && shown.has(current.from) && shown.has(current.to) && (
          <PacketDot key={current.id} p={current} path={route(boxes[current.from], boxes[current.to])} ms={holdMs(speed)} />
        )}
        {!hover && (data.tickHistory?.length ?? 0) > 0 && <Bubble beat={beat} step={step} box={boxes[focusNode] ?? boxes[`band:${focusBand}`]} width={size.w}
          rowEnd={Math.max(0, ...(lanes.find((l) => l.band.id === focusBand)?.ids ?? []).map((id) => (boxes[id] ? boxes[id].x + boxes[id].w : 0)))} />}
        {hover && boxes[hover] && <HoverCard id={hover} info={nodes[hover]} box={boxes[hover]} width={size.w} height={size.h} />}
      </div>
      </div>
      <div className="fg-zoom" role="group" aria-label="Zoom the flowchart">
        <button onClick={() => setUser((u) => Math.max(1, +(u - 0.2).toFixed(2)))} disabled={user <= 1} aria-label="Zoom out"><Minus size={15} /></button>
        <button onClick={() => setUser(1)} aria-label="Fit to screen" title="Fit to screen"><Maximize size={14} /><span>Fit</span></button>
        <button onClick={() => setUser((u) => Math.min(2, +(u + 0.2).toFixed(2)))} aria-label="Zoom in"><Plus size={15} /></button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ nodes, one shape per kind */
const SHAPES: Partial<Record<NodeDef['kind'], ReactNode>> = {
  threat: <polygon points="6,0 94,0 100,50 94,100 6,100 0,50" />,
  rules: <polygon points="50,2 98,50 50,98 2,50" />,
  human: <path d="M50 2 L97 14 L97 50 Q97 82 50 98 Q3 82 3 50 L3 14 Z" />,
  step: <polygon points="0,0 90,0 100,50 90,100 0,100 9,50" />,
  gap: <polygon points="0,0 88,0 100,18 100,100 0,100" />,
};

function GraphNode({ id, info, focus, reg, onHover }: { id: string; info?: NodeInfo; focus: boolean; reg: (el: HTMLElement | null) => void; onHover: (id: string | null) => void }) {
  const def = DEF[id];
  const n = info ?? { phase: 'idle' as const };
  const Icon = ICONS[def.icon] ?? CircleDashed;
  const state = n.phase === 'active' ? 'active' : lit(n) ? 'done' : 'future';
  const cls = `fg-n fg-n--${def.kind} is-${state} t-${n.tone ?? 'unknown'} ${focus ? 'is-focus' : ''}`;
  const style = { '--hue': 'var(--accent)' } as CSSProperties;
  const hov = { onMouseEnter: () => onHover(id), onFocus: () => onHover(id), onBlur: () => onHover(null), tabIndex: 0, 'aria-label': `${def.label}. ${def.role}. ${n.word ?? ''} ${n.detail ?? ''}` };
  const shape = SHAPES[def.kind];
  const word = n.word && !(def.kind === 'site' && n.word === 'OK') && def.kind !== 'satellite' ? n.word : '';

  if (def.kind === 'agent') {
    return (
      <div className={cls} style={style} {...hov}>
        <span className="fg-av" ref={reg}><Icon size={20} strokeWidth={1.6} aria-hidden /></span>
        <b className="fg-n__label">{def.label.replace(' agent', '')}</b>
        <span className="fg-word mono">{n.word ?? 'IDLE'}</span>
      </div>
    );
  }
  if (def.kind === 'model') {
    return (
      <div className={cls} ref={reg} {...hov}>
        <span className="fg-mc__id mono">{MODEL_TAG[id]}</span>
        <span className="fg-n__txt"><b className="fg-n__label">{def.label}</b><span className="fg-word mono">{n.word ?? 'Not observed'}</span></span>
      </div>
    );
  }
  if (def.kind === 'clocks') {
    return (
      <div className={cls} ref={reg} {...hov}>
        <span className="fg-dial" aria-hidden><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" className="fg-dial__bg" /><circle cx="20" cy="20" r="16" className="fg-dial__arc" /></svg><Icon size={15} strokeWidth={1.75} /></span>
        <span className="fg-n__txt"><b className="fg-n__label">{def.label}</b>{word && <span className="fg-word mono">{word}</span>}</span>
      </div>
    );
  }
  return (
    <div className={cls} ref={reg} {...hov}>
      {shape && <svg className="fg-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>{shape}</svg>}
      <Icon className="fg-n__icon" size={def.kind === 'site' ? 14 : 16} strokeWidth={1.6} aria-hidden />
      <span className="fg-n__txt">
        <b className="fg-n__label">{def.label}</b>
        {word && <span className="fg-word mono">{word}</span>}
      </span>
    </div>
  );
}

function Ghost({ band }: { band: BandId }) {
  return <div className="fg-ghost">{band === 'gaps' ? 'Gaps appear here as the rule engine finds them' : band === 'threat' ? 'No attack or fault yet' : 'Waiting'}</div>;
}

/* ------------------------------------------------------------------ packet, glass tiles */
function PacketDot({ p, path, ms }: { p: Packet; path: string; ms: number }) {
  const style = { offsetPath: `path('${path}')`, animationDuration: `${ms}ms` } as CSSProperties;
  return (
    <div className={`fg-pk t-${p.tone} ${p.bounce ? 'is-bounce' : ''}`} style={style} aria-hidden>
      <span className="fg-pk__dot" /><span className="fg-pk__label mono">{p.label}</span>
    </div>
  );
}

/** Place a tile above (or below) a node, inside the chart. */
function place(box: Box, width: number, W: number, H: number, total = Infinity): CSSProperties {
  const cx = box.x + box.w / 2;
  const left = Math.max(6, Math.min(width - W - 6, cx - W / 2));
  const above = box.y > H + 16 || box.y + box.h + H + 16 > total;
  return { left, width: W, ...(above ? { top: box.y - 8, transform: 'translateY(-100%)' } : { top: box.y + box.h + 8 }) };
}

function Bubble({ beat, step, box, width, rowEnd }: { beat?: Beat; step?: { node: string; title: string; text: string }; box?: Box; width: number; rowEnd: number }) {
  if (!box || (!beat && !step)) return null;
  const title = step?.title ?? beat!.title, text = step?.text ?? beat!.text, tone = step ? 'accent' : beat!.tone;
  const actor = DEF[step?.node ?? beat!.node];
  const W = Math.min(220, width * 0.22);
  // Prefer the free space at the end of the active row, so the tile never covers another row.
  const side = rowEnd > 0 && width - rowEnd - 24 >= W;
  const style: CSSProperties = side ? { left: rowEnd + 16, width: Math.min(320, width - rowEnd - 28), top: box.y + box.h / 2, transform: 'translateY(-50%)' } : place(box, width, W, 58);
  return (
    <div key={`${step ? 's' : 'b'}${beat?.id ?? 0}${step?.title ?? ''}`} className={`fg-tile fg-bub t-${tone} ${side ? '' : 'is-compact'}`} style={style} role="status">
      <span className="fg-tile__who">{actor ? actor.label : ''}{beat && !step ? <span className="mono"> · {ist(beat.ts, false)}</span> : null}</span>
      <b>{title}</b>
      {side && <span className="fg-tile__txt">{text}</span>}
    </div>
  );
}

/** Hover: who this is, what it is for, and what it is doing right now. */
function HoverCard({ id, info, box, width, height }: { id: string; info?: NodeInfo; box: Box; width: number; height: number }) {
  const def = DEF[id];
  const n = info ?? { phase: 'idle' as const };
  const now = n.phase === 'active' ? 'Working now' : lit(n) ? 'Done' : def.band === 'network' || def.band === 'detect' ? 'Watching' : 'Not involved yet';
  return (
    <div className={`fg-tile fg-hover t-${n.tone ?? 'unknown'}`} style={place(box, width, 280, 120, height)} role="tooltip">
      <span className="fg-tile__who">{MODEL_TAG[id] ? `${MODEL_TAG[id]} · ` : ''}{now}{n.at ? <span className="mono"> · {ist(n.at, false)}</span> : null}</span>
      <b>{def.label}</b>
      <span className="fg-tile__txt">{def.role}</span>
      {(n.word || n.detail) && <span className="fg-tile__now"><span className="mono">{n.word ?? ''}</span>{n.detail ? ` ${n.detail}` : ''}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ subtitle: the one thing happening now */
export function Subtitle() {
  const beats = usePipeline((s) => s.beats);
  const b = beats[beats.length - 1];
  const d = b ? DEF[b.node] : undefined;
  const Icon = d ? ICONS[d.icon] : CircleDashed;
  return (
    <div className={`fg-sub t-${b?.tone ?? 'unknown'}`} aria-live="polite">
      {b ? <>
        <span className="mono fg-sub__at">{ist(b.ts, false)}</span>
        <Icon size={16} strokeWidth={1.75} aria-hidden />
        <span className="fg-sub__who">{d?.label ?? ''}</span>
        <span className="fg-sub__txt" key={b.id}><b>{b.title}.</b> {b.text}</span>
      </> : <span className="fg-sub__txt">Events appear here as they happen.</span>}
    </div>
  );
}
