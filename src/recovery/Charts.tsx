import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Activity, BarChart3 } from 'lucide-react';
import type { DeriveInput } from '../derive';
import { finite, object, text, timestampMs } from '../policy/data';
import { Empty, Panel } from '../shell';
import { availabilitySeries, deliverySeries, recoveryMarkers, type Marker, type ServiceTrace } from './data';

type PlotRow = { t: number; ts?: string; values: Record<string, number | undefined> };
type Trace = { id: string; label: string; color: string; dash?: string };
const SERVICE_STYLES: Record<string, Pick<Trace, 'color' | 'dash'>> = {
  '112': { color: 'var(--recovery-series-1)' },
  hospital: { color: 'var(--recovery-series-2)', dash: '9 3' },
  grid: { color: 'var(--recovery-series-3)', dash: '3 3' },
  upi_atm: { color: 'var(--recovery-series-4)', dash: '12 3 2 3' },
  general: { color: 'var(--recovery-series-5)', dash: '2 3' },
};
const W = 680, H = 238, LEFT = 54, RIGHT = 14, TOP = 16, BOTTOM = 34;
const plotWidth = W - LEFT - RIGHT, plotHeight = H - TOP - BOTTOM;

const valueText = (value: number | undefined, unit: string) =>
  value === undefined ? 'Unavailable' : `${value.toFixed(unit === '%' ? 1 : 2)} ${unit}`;
// One shared formatter: building Intl.DateTimeFormat per row stalled the page on long runs.
const IST = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
const shortTime = (ts?: string) => {
  const ms = ts ? timestampMs(ts) : undefined;
  return ms === undefined ? 'Time unavailable' : `${IST.format(ms)} IST`;
};

export function AvailabilityChart({ data }: { data: DeriveInput }) {
  const points = useMemo(() => availabilitySeries(data), [data.tickHistory, data.events]);
  const markers = useMemo(() => recoveryMarkers(data), [data.events, data.summary]);
  const byTime = new Map(points.map((point) => [point.t, point]));
  const rows = (data.tickHistory ?? []).filter((tick) => tick.audience !== 'control' && finite(tick.t) !== undefined)
    .map((tick) => {
      const t = finite(tick.t)!;
      const point = byTime.get(t);
      return { t, ts: text(tick.ts) ?? point?.ts, values: { availability: point?.value } };
    }).sort((a, b) => a.t - b.t);
  const restoredAt = timestampMs(object(data.summary?.timings).restored_at);
  const restoredPoint = restoredAt === undefined ? undefined : rows.find((row) => {
    const ts = timestampMs(row.ts);
    return ts !== undefined && ts >= restoredAt;
  });
  const degradation = markers.find((marker) => marker.kind === 'degradation');
  const minimum = points.length ? points.reduce((a, b) => a.value <= b.value ? a : b) : undefined;
  return (
    <Panel title="Network availability" icon={Activity} right={<span className="recovery-muted">Instantaneous, emulated</span>}>
      {!points.length ? <Empty>Availability measurements are unavailable.</Empty> : <>
        <p className="recovery-caption">Delivered demand share from the emulated impact stream. M3 alerts show detection; observed service degradation is marked separately.</p>
        <LinePlot
          rows={rows} traces={[{ id: 'availability', label: 'Availability', color: 'var(--accent)' }]}
          unit="%" markers={markers} minYMax={100}
          bands={degradation ? { degradationT: degradation.t, restoredT: restoredPoint?.t } : undefined}
        />
        <div className="recovery-observation">
          <strong>Lowest observed:</strong> {minimum ? valueText(minimum.value, '%') : 'Unavailable'}
          {minimum && <> at {shortTime(minimum.ts)}</>}
        </div>
      </>}
    </Panel>
  );
}

export function DeliveryChart({ data }: { data: DeriveInput }) {
  const series = useMemo(() => deliverySeries(data), [data.tickHistory]);
  const markers = useMemo(() => recoveryMarkers(data), [data.events, data.summary]);
  const rows = useMemo(() => alignSeries(data, series), [data.tickHistory, series]);
  const plotted = series.filter((trace) => SERVICE_STYLES[trace.id]);
  const traces = plotted.map((trace) => ({ id: trace.id, label: trace.label, ...SERVICE_STYLES[trace.id] }));
  return (
    <Panel title="Delivered Mbps by service" icon={BarChart3} right={<span className="recovery-muted">tick.services</span>}>
      {!rows.length || !series.length ? <Empty>Per-service delivery measurements are unavailable.</Empty> : <>
        <p className="recovery-caption">Observed delivery per simulated minute. Missing measurements are not plotted as zero.</p>
        {traces.length > 0 && <LinePlot rows={rows} traces={traces} unit="Mbps" markers={markers} />}
        {series.some((trace) => !SERVICE_STYLES[trace.id]) && <p className="recovery-muted">Additional services are available in the data table.</p>}
        <DataTable rows={rows} traces={series.map((trace) => ({ id: trace.id, label: trace.label, color: '' }))} unit="Mbps" />
      </>}
    </Panel>
  );
}

function alignSeries(data: DeriveInput, series: ServiceTrace[]): PlotRow[] {
  const rows = new Map<number, PlotRow>();
  for (const tick of data.tickHistory ?? []) {
    if (tick.audience === 'control') continue;
    const t = finite(tick.t);
    if (t !== undefined) rows.set(t, { t, ts: text(tick.ts), values: {} });
  }
  for (const trace of series) for (const point of trace.points) {
    const row = rows.get(point.t);
    if (row) row.values[trace.id] = point.value;
  }
  return [...rows.values()].sort((a, b) => a.t - b.t);
}

function LinePlot({ rows, traces, unit, markers, minYMax = 0, bands }: {
  rows: PlotRow[]; traces: Trace[]; unit: string; markers: Marker[]; minYMax?: number;
  bands?: { degradationT: number; restoredT?: number };
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const allT = [...rows.map((row) => row.t), ...markers.map((marker) => marker.t)];
  const from = Math.min(...allT), to = Math.max(...allT);
  const x = (t: number) => LEFT + ((t - from) / (to - from || 1)) * plotWidth;
  const values = rows.flatMap((row) => traces.map((trace) => row.values[trace.id]).filter((n): n is number => n !== undefined));
  const max = Math.max(minYMax, ...values, 0);
  const ceiling = max > 0 ? Math.ceil(max / (unit === '%' ? 10 : 10)) * 10 : 1;
  const y = (value: number) => TOP + plotHeight - (value / ceiling) * plotHeight;
  const hovered = selected === null ? undefined : rows[selected];
  const markerKinds = new Set(markers.map((marker) => marker.kind));
  const pointer = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - bounds.left) / bounds.width * W;
    const at = from + (Math.max(LEFT, Math.min(LEFT + plotWidth, px)) - LEFT) / plotWidth * (to - from);
    const index = rows.reduce((best, row, i) => Math.abs(row.t - at) < Math.abs(rows[best].t - at) ? i : best, 0);
    setSelected((previous) => previous === index ? previous : index);
  };
  const keyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    setSelected((current) => event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1
      : Math.max(0, Math.min(rows.length - 1, (current ?? rows.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))));
  };
  return (
    <figure className="recovery-figure">
      {traces.length > 1 && <div className="recovery-legend" aria-label="Service legend">
        {traces.map((trace) => <span key={trace.id}><svg width="26" height="10" aria-hidden="true"><line x1="0" x2="24" y1="5" y2="5" stroke={trace.color} strokeWidth="2" strokeDasharray={trace.dash} /></svg>{trace.label}</span>)}
      </div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="recovery-chart" role="group" tabIndex={0}
        aria-label={`${unit} time series. Use left and right arrow keys to inspect samples.`}
        onPointerMove={pointer} onPointerLeave={() => setSelected(null)} onFocus={() => setSelected((value) => value ?? rows.length - 1)} onKeyDown={keyboard}>
        {bands && <>
          {bands.degradationT > from && <rect x={x(from)} y={TOP} width={x(bands.degradationT) - x(from)} height={plotHeight} className="recovery-band-before" />}
          <rect x={x(bands.degradationT)} y={TOP} width={Math.max(0, x(bands.restoredT ?? to) - x(bands.degradationT))} height={plotHeight} className="recovery-band-during" />
          {bands.restoredT !== undefined && <rect x={x(bands.restoredT)} y={TOP} width={Math.max(0, x(to) - x(bands.restoredT))} height={plotHeight} className="recovery-band-after" />}
        </>}
        {[0, 0.5, 1].map((fraction) => <g key={fraction}>
          <line x1={LEFT} x2={W - RIGHT} y1={y(ceiling * fraction)} y2={y(ceiling * fraction)} className="recovery-gridline" />
          <text x={LEFT - 8} y={y(ceiling * fraction) + 4} textAnchor="end" className="recovery-axis">{Number((ceiling * fraction).toFixed(1))}{unit === '%' ? '%' : ''}</text>
        </g>)}
        {traces.map((trace) => {
          let previous = false;
          const path = rows.map((row) => {
            const value = row.values[trace.id];
            if (value === undefined) { previous = false; return ''; }
            const command = previous ? 'L' : 'M';
            previous = true;
            return `${command}${x(row.t).toFixed(1)} ${y(value).toFixed(1)}`;
          }).join(' ');
          const isolated = rows.filter((row, index) => row.values[trace.id] !== undefined
            && (index === 0 || rows[index - 1].values[trace.id] === undefined)
            && (index === rows.length - 1 || rows[index + 1].values[trace.id] === undefined));
          return <g key={trace.id}>
            <path d={path} fill="none" stroke={trace.color} strokeWidth="2" strokeDasharray={trace.dash} strokeLinecap="round" strokeLinejoin="round" />
            {isolated.map((row) => <circle key={row.t} cx={x(row.t)} cy={y(row.values[trace.id]!)} r="3" fill={trace.color} />)}
          </g>;
        })}
        {markers.map((marker) => <line key={`${marker.kind}-${marker.seq}`} x1={x(marker.t)} x2={x(marker.t)} y1={TOP} y2={H - BOTTOM} className={`recovery-marker recovery-marker--${marker.kind}`} />)}
        {hovered && <line x1={x(hovered.t)} x2={x(hovered.t)} y1={TOP} y2={H - BOTTOM} className="recovery-crosshair" />}
        <text x={LEFT} y={H - 10} className="recovery-axis">{shortTime(rows[0]?.ts)}</text>
        <text x={W - RIGHT} y={H - 10} textAnchor="end" className="recovery-axis">{shortTime(rows.at(-1)?.ts)}</text>
      </svg>
      <figcaption className="recovery-readout">
        {hovered ? <><strong>{shortTime(hovered.ts)}</strong>{traces.map((trace) => <span key={trace.id}>{trace.label}: {valueText(hovered.values[trace.id], unit)}</span>)}</>
          : <span>Hover or focus the chart to inspect a sample. The data table contains every value.</span>}
      </figcaption>
      {bands && <p className="recovery-muted">Bands: before measured service degradation / degraded until restoration / after observed restoration, when available.</p>}
      {markerKinds.size > 0 && <details className="recovery-markers">
        <summary>Public event markers ({markers.length})</summary>
        <ul>{markers.map((marker) => <li key={`${marker.kind}-${marker.seq}`}><strong>{shortTime(marker.ts)}</strong> {marker.label}</li>)}</ul>
      </details>}
      {unit === '%' && <DataTable rows={rows} traces={traces} unit={unit} />}
    </figure>
  );
}

function DataTable({ rows, traces, unit }: { rows: PlotRow[]; traces: Trace[]; unit: string }) {
  const [open, setOpen] = useState(false);
  return <details className="recovery-data-table" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>View chart data as a table ({rows.length} samples)</summary>
    {open &&
    <div className="recovery-table-wrap" role="region" aria-label={`Observed ${unit} data`} tabIndex={0}>
      <table className="recovery-table">
        <caption>Observed {unit} by simulation time</caption>
        <thead><tr><th scope="col">Simulation time</th>{traces.map((trace) => <th scope="col" key={trace.id}>{trace.label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.t}><th scope="row">{shortTime(row.ts)}</th>{traces.map((trace) => <td key={trace.id}>{valueText(row.values[trace.id], unit)}</td>)}</tr>)}</tbody>
      </table>
    </div>}
  </details>;
}
