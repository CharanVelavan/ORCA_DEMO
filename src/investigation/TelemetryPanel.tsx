import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { type DeriveInput } from '../derive';
import { Empty, Panel, simClockIST } from '../shell';
import { number } from '../operations/data';

type Metric = 'delivered_mbps' | 'snr_db' | 'packet_loss' | 'traffic_load';
const METRICS: { id: Metric; label: string; unit: string; scale: number }[] = [
  { id: 'delivered_mbps', label: 'Delivered throughput', unit: 'Mbps', scale: 1 },
  { id: 'snr_db', label: 'Signal-to-noise ratio', unit: 'dB', scale: 1 },
  { id: 'packet_loss', label: 'Packet loss', unit: '%', scale: 100 },
  { id: 'traffic_load', label: 'Traffic load ratio', unit: '%', scale: 100 },
];

export function TelemetryPanel({ data, site }: { data: DeriveInput; site: string }) {
  const [metric, setMetric] = useState<Metric>('delivered_mbps');
  const [selected, setSelected] = useState<number | null>(null);
  const spec = METRICS.find((item) => item.id === metric)!;
  const points = useMemo(() => (data.tickHistory ?? []).flatMap((tick) => {
    const sites = tick.sites && typeof tick.sites === 'object' ? tick.sites as Record<string, Record<string, unknown>> : {};
    const value = number(sites[site]?.[metric]);
    return value === undefined ? [] : [{ t: tick.t, ts: tick.ts, value: value * spec.scale }];
  }), [data.tickHistory, site, metric, spec.scale]);
  const alert = (data.alerts ?? []).find((event) => event.audience !== 'control' && event.site === site);

  const width = 620, height = 172, left = 54, right = 12, top = 12, bottom = 26;
  const values = points.map((point) => point.value);
  const min = values.length ? Math.min(0, ...values) : 0;
  const max = values.length ? Math.max(...values, min + 1) : 1;
  const firstT = points[0]?.t ?? 0;
  const lastT = points[points.length - 1]?.t ?? firstT;
  const x = (t: number) => left + ((t - firstT) / (lastT - firstT || 1)) * (width - left - right);
  const y = (value: number) => top + (1 - (value - min) / (max - min)) * (height - top - bottom);
  const path = points.map((point) => `${x(point.t).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  const index = Math.min(selected ?? Math.max(0, points.length - 1), Math.max(0, points.length - 1));
  const current = points[index];
  const marker = alert && alert.t >= firstT && alert.t <= lastT ? alert : undefined;
  const fmt = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <Panel title="Site telemetry" icon={Activity} right={<span className="ops-subtle">{site} - Emulated</span>}>
      <label className="ops-field ops-field--inline">Measurement
        <select value={metric} onChange={(event) => { setMetric(event.target.value as Metric); setSelected(null); }}>
          {METRICS.map((item) => <option key={item.id} value={item.id}>{item.label} ({item.unit})</option>)}
        </select>
      </label>
      {!points.length ? <Empty>No {spec.label.toLowerCase()} telemetry has been received for this site.</Empty> : (
        <div className="inv-chart">
          <div className="inv-chart__readout" aria-live="polite">
            <strong>{current ? `${fmt(current.value)} ${spec.unit}` : 'Unavailable'}</strong>
            <span>{current ? `${simClockIST(current.ts)} IST` : ''}</span>
          </div>
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${spec.label} for ${site}, from ${simClockIST(points[0].ts)} to ${simClockIST(points[points.length - 1].ts)} IST`}
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const relative = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
              const target = firstT + ((relative * width - left) / (width - left - right)) * (lastT - firstT);
              let nearest = 0;
              for (let i = 1; i < points.length; i++) if (Math.abs(points[i].t - target) < Math.abs(points[nearest].t - target)) nearest = i;
              setSelected(nearest);
            }}>
            {[min, (min + max) / 2, max].map((value) => <g key={value}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="inv-chart__grid" /><text x={left - 7} y={y(value) + 4} textAnchor="end">{fmt(value)}</text></g>)}
            {marker && <g><line x1={x(marker.t)} x2={x(marker.t)} y1={top} y2={height - bottom} className="inv-chart__marker" /><text x={x(marker.t) + 3} y={top + 9}>Alert</text></g>}
            {points.length > 1 && <polyline points={path} className="inv-chart__line" />}
            {current && <g><line x1={x(current.t)} x2={x(current.t)} y1={top} y2={height - bottom} className="inv-chart__cursor" /><circle cx={x(current.t)} cy={y(current.value)} r="4" className="inv-chart__dot" /></g>}
            <text x={left} y={height - 5}>{simClockIST(points[0].ts)} IST</text>
            <text x={width - right} y={height - 5} textAnchor="end">{simClockIST(points[points.length - 1].ts)} IST</text>
          </svg>
          <label className="inv-chart__slider">Inspect a sample
            <input type="range" min="0" max={Math.max(0, points.length - 1)} value={index} onChange={(event) => setSelected(Number(event.target.value))} aria-valuetext={current ? `${simClockIST(current.ts)} IST, ${fmt(current.value)} ${spec.unit}` : 'Unavailable'} />
          </label>
          <details><summary>View telemetry values</summary>
            <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Simulation time</th><th>{spec.label} ({spec.unit})</th></tr></thead>
              <tbody>{points.map((point, i) => <tr key={`${point.t}-${i}`}><td>{simClockIST(point.ts)} IST</td><td>{fmt(point.value)}</td></tr>)}</tbody>
            </table></div>
          </details>
          {marker && <p className="ops-subtle">Marker shows the observed alert, not exercise ground truth.</p>}
        </div>
      )}
    </Panel>
  );
}
