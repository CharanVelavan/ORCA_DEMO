import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { Expand, Maximize, Minus, Plus } from 'lucide-react';
import { FlowPanel } from './FlowPanel';
import type { FlowConfig } from './flowConfig';
import './fitted-flow.css';

/** The original decision chart, fitted as one canvas. Zoom and pan never need scrollbars. */
export function FittedFlow({ config }: { config: FlowConfig }) {
  const shell = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const chart = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0, chartHeight: 1 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const width = 440;
  const fit = Math.min(1, Math.max(1, size.width - 12) / width, Math.max(1, size.height - 12) / size.chartHeight);
  const scale = fit * zoom;
  const bounds = (next: { x: number; y: number }, nextScale = scale) => ({
    x: Math.max(Math.min(0, size.width - width * nextScale - 12), Math.min(0, next.x)),
    y: Math.max(Math.min(0, size.height - size.chartHeight * nextScale - 12), Math.min(0, next.y)),
  });
  useLayoutEffect(() => {
    const update = () => {
      if (!viewport.current || !chart.current) return;
      const next = { width: viewport.current.clientWidth, height: viewport.current.clientHeight, chartHeight: chart.current.offsetHeight };
      setSize(old => old.width === next.width && old.height === next.height && old.chartHeight === next.chartHeight ? old : next);
    };
    const observer = new ResizeObserver(update);
    if (viewport.current) observer.observe(viewport.current);
    if (chart.current) observer.observe(chart.current);
    update();
    return () => observer.disconnect();
  }, []);
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const changeZoom = (next: number) => {
    const value = Math.max(1, Math.min(6, next));
    setZoom(value);
    setPan(value === 1 ? { x: 0, y: 0 } : bounds(pan, fit * value));
  };
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      changeZoom(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [zoom, fit, pan, size]);
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (zoom === 1 || event.button !== 0 || (event.target as HTMLElement).closest('button,a,input,select,textarea')) return;
    drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const visiblePan = bounds(pan);
  const offsetX = Math.max(6, (size.width - width * scale) / 2) + visiblePan.x;
  return <section ref={shell} className="fitted-flow" aria-label={`${config.title} diagram`}>
    <div className="fitted-flow__tools" role="group" aria-label="Flowchart zoom">
      <button type="button" className="sh-btn sh-btn--sm" onClick={() => changeZoom(zoom / 1.4)} disabled={zoom === 1} aria-label="Zoom out flowchart"><Minus size={14} /></button>
      <label className="fitted-flow__zoom"><span className="sr-only">Diagram zoom</span><input type="range" min="1" max="6" step="0.1" value={zoom} onChange={event => changeZoom(Number(event.target.value))} aria-valuetext={`${Math.round(zoom * 100)}% of fitted size`} /><output>{Math.round(zoom * 100)}%</output></label>
      <button type="button" className="sh-btn sh-btn--sm" onClick={() => changeZoom(zoom * 1.4)} disabled={zoom === 6} aria-label="Zoom in flowchart"><Plus size={14} /></button>
      <button type="button" className="sh-btn sh-btn--sm" onClick={reset}><Maximize size={13} /> Fit</button>
      {typeof document !== 'undefined' && document.fullscreenEnabled && <button type="button" className="sh-btn sh-btn--sm" aria-label="Toggle diagram fullscreen" onClick={() => { if (document.fullscreenElement === shell.current) void document.exitFullscreen(); else void shell.current?.requestFullscreen().catch(() => {}); }}><Expand size={14} /></button>}
    </div>
    <div ref={viewport} className={`fitted-flow__viewport${zoom > 1 ? ' is-zoomed' : ''}`} tabIndex={0} role="region" aria-label="Response diagram. Zoom in, then drag the background or use arrow keys to pan. Fit restores the complete chart."
      onPointerDown={pointerDown} onPointerMove={event => { if (drag.current) setPan(bounds({ x: drag.current.px + event.clientX - drag.current.x, y: drag.current.py + event.clientY - drag.current.y })); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onFocusCapture={event => {
        if (event.target === event.currentTarget || zoom === 1) return;
        const outer = event.currentTarget.getBoundingClientRect();
        const target = event.target.getBoundingClientRect();
        const dx = target.left < outer.left ? outer.left - target.left + 8 : target.right > outer.right ? outer.right - target.right - 8 : 0;
        const dy = target.top < outer.top ? outer.top - target.top + 8 : target.bottom > outer.bottom ? outer.bottom - target.bottom - 8 : 0;
        if (dx || dy) setPan(bounds({ x: pan.x + dx, y: pan.y + dy }));
      }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === '+' || event.key === '=') { event.preventDefault(); changeZoom(zoom * 1.4); }
        if (event.key === '-') { event.preventDefault(); changeZoom(zoom / 1.4); }
        if (event.key === '0' || event.key === 'Home') { event.preventDefault(); reset(); }
        if (zoom > 1 && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) {
          event.preventDefault(); setPan(bounds({ x: pan.x + (event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0), y: pan.y + (event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0) }));
        }
      }}>
      <div ref={chart} className="fitted-flow__chart" style={{ width, transform: `translate(${offsetX}px, ${6 + visiblePan.y}px) scale(${scale})` }}><FlowPanel config={config} /></div>
    </div>
    <p className="fitted-flow__hint">{zoom > 1 ? 'Drag or use arrow keys to pan · Fit resets' : 'Whole chart fitted · Zoom for details'}</p>
  </section>;
}
