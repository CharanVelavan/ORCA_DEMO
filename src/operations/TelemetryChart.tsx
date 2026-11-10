import { useMemo, useState } from 'react';
import { LineChart } from 'lucide-react';
import { SITES, serviceSeries, type DeriveInput } from '../derive';
import { Empty, Panel, simClockIST } from '../shell';
import { number } from './data';

type Point = { t: number; ts?: string; value: number };
export type Series = { id: string; label: string; points: Point[] };

// Same display labels as the Recovery page, keyed by engine service id (tick.services).
const SERVICE_LABEL: Record<string, string> = { '112': '112', hospital: 'Hospital', upi_atm: 'UPI / ATM', grid: 'Grid', general: 'General' };

/** Per-site delivered Mbps series from tick.sites[*].delivered_mbps. */
export function siteSeries(data: DeriveInput): Series[] {
  const byId = new Map<string, Series>();
  for (const tick of data.tickHistory ?? []) {
    const sites = tick.sites && typeof tick.sites === 'object' ? tick.sites as Record<string, Record<string, unknown>> : {};
    for (const [id, site] of Object.entries(sites)) {
      const value = number(site?.delivered_mbps);
      if (value === undefined) continue;
      if (!byId.has(id)) byId.set(id, { id, label: SITES.find((item) => item.id === id)?.area ?? id, points: [] });
      byId.get(id)!.points.push({ t: number(tick.t) ?? 0, ts: typeof tick.ts === 'string' ? tick.ts : undefined, value });
    }
  }
  return SITES.map((site) => byId.get(site.id)).filter((item): item is Series => Boolean(item));
}

export function serviceLines(data: DeriveInput): Series[] {
  return serviceSeries(data).map((item) => ({ ...item, label: SERVICE_LABEL[item.id] ?? item.label }));
}

const fmt = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 1 });

export function TelemetryChart({ data }: { data: DeriveInput }) {
  const [mode, setMode] = useState<'service' | 'site'>('service');
  const [hover, setHover] = useState<number | null>(null);
  const series = useMemo(() => mode === 'service' ? serviceLines(data) : siteSeries(data), [data, mode]);
  const firstAlert = (data.alerts ?? []).find((event) => event.audience !== 'control');

  const all = series.flatMap((item) => item.points);
  const width = 640, height = 188, left = 44, right = 10, top = 10, bottom = 22;
  const firstT = all.length ? Math.min(...all.map((p) => p.t)) : 0;
  const lastT = all.length ? Math.max(...all.map((p) => p.t)) : 0;
  const max = all.length ? Math.max(...all.map((p) => p.value), 1) : 1;
  const x = (t: number) => left + ((t - firstT) / (lastT - firstT || 1)) * (width - left - right);
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  const longest = series.reduce<Point[]>((a, item) => item.points.length > a.length ? item.points : a, []);
  const cursor = hover !== null ? longest[Math.min(hover, longest.length - 1)] : undefined;
  const at = (item: Series): Point | undefined => cursor ? item.points.find((p) => p.t === cursor.t) : item.points[item.points.length - 1];
  const marker = firstAlert && typeof firstAlert.t === 'number' && firstAlert.t >= firstT && firstAlert.t <= lastT ? firstAlert : undefined;

  return (
    <Panel title="Delivered throughput" icon={LineChart}
      right={<div className="ops-seg" role="group" aria-label="Group throughput by">
        <button type="button" aria-pressed={mode === 'service'} onClick={() => { setMode('service'); setHover(null); }}>By service</button>
        <button type="button" aria-pressed={mode === 'site'} onClick={() => { setMode('site'); setHover(null); }}>By site</button>
      </div>}>
      {!all.length ? <Empty>No delivered-throughput telemetry has been received.</Empty> : (
        <div className="ops-chart">
          <svg viewBox={`0 0 ${width} ${height}`} role="img"
            aria-label={`Delivered Mbps ${mode === 'service' ? 'per service' : 'per site'} from ${simClockIST(longest[0]?.ts)} to ${simClockIST(longest[longest.length - 1]?.ts)} IST (emulated)`}
            onPointerLeave={() => setHover(null)}
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const target = firstT + (((event.clientX - rect.left) / rect.width) * width - left) / (width - left - right) * (lastT - firstT);
              let nearest = 0;
              for (let i = 1; i < longest.length; i++) if (Math.abs(longest[i].t - target) < Math.abs(longest[nearest].t - target)) nearest = i;
              setHover(nearest);
            }}>
            {[0, max / 2, max].map((value) => <g key={value}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="ops-chart__grid" /><text x={left - 6} y={y(value) + 4} textAnchor="end">{fmt(value)}</text></g>)}
            {marker && <g><line x1={x(marker.t)} x2={x(marker.t)} y1={top} y2={height - bottom} className="ops-chart__marker" /><text x={x(marker.t) + 4} y={top + 10}>First alert</text></g>}
            {series.map((item, i) => item.points.length > 1 && <polyline key={item.id} data-series={i % 6} className="ops-chart__line"
              points={item.points.map((p) => `${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')} />)}
            {cursor && <line x1={x(cursor.t)} x2={x(cursor.t)} y1={top} y2={height - bottom} className="ops-chart__cursor" />}
            <text x={left} y={height - 4}>{simClockIST(longest[0]?.ts)} IST</text>
            <text x={width - right} y={height - 4} textAnchor="end">{simClockIST(longest[longest.length - 1]?.ts)} IST</text>
          </svg>
          <ul className="ops-chart__legend" aria-label={cursor ? `Values at ${simClockIST(cursor.ts)} IST` : 'Latest values'}>
            {series.map((item, i) => {
              const point = at(item);
              const first = item.points[0]?.value;
              const delta = point && first !== undefined ? point.value - first : undefined;
              return <li key={item.id} data-series={i % 6}>
                <span className="ops-chart__swatch" aria-hidden />
                <span className="ops-chart__name" title={item.id}>{item.label}</span>
                <strong className="mono">{point ? fmt(point.value) : '—'}</strong>
                <small className={`mono ${delta !== undefined && delta < -0.05 ? 'is-down' : ''}`}>{delta === undefined ? '' : `${delta >= 0 ? '+' : ''}${fmt(delta)}`}</small>
              </li>;
            })}
          </ul>
          <p className="ops-subtle">Mbps on emulated links{cursor ? ` at ${simClockIST(cursor.ts)} IST` : ', latest tick'}; change is against the first tick.{marker ? ' The marker is the first observed alert.' : ''}</p>
        </div>
      )}
    </Panel>
  );
}
