import { Activity } from 'lucide-react';
import { deliveredMbps, services, type DeriveInput } from '../derive';
import { Empty, Panel, StatusBadge } from '../shell';
import { text } from '../operations/data';

export function NetworkImpact({ data }: { data: DeriveInput }) {
  const ticks = data.tickHistory ?? [];
  const first = ticks[0];
  const latest = ticks[ticks.length - 1];
  const current = deliveredMbps(data);
  const baseline = first ? deliveredMbps({ ...data, tickHistory: [first] }) : undefined;
  const delta = current !== undefined && baseline !== undefined ? current - baseline : undefined;
  const qos = text(latest?.qos_state) ?? text(latest?.qos);
  const rows = services(data);
  return (
    <Panel title="Network impact" icon={Activity} right={qos ? <StatusBadge tone="unknown" word={`QoS: ${qos}`} size="sm" /> : undefined}>
      <p className="ops-subtle">{delta === undefined ? 'Delivered-Mbps change is unavailable until comparable telemetry is received.' : `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} Mbps delivered since the first observed sample. Demand may also change.`}</p>
      {!rows.length ? <Empty>No service delivery measurements have been received.</Empty> : <div className="ops-table-wrap">
        <table className="ops-table"><thead><tr><th>Service</th><th>Delivered / demand Mbps</th><th>Share</th></tr></thead>
          <tbody>{rows.map((row) => {
            const share = row.delivered === undefined || row.demand === undefined || row.demand <= 0 ? undefined : 100 * row.delivered / row.demand;
            return <tr key={row.id}><td>{row.label}</td><td className="mono">{row.delivered === undefined ? '—' : row.delivered.toFixed(1)} / {row.demand === undefined ? '—' : row.demand.toFixed(1)}</td>
              <td className={share !== undefined && share < 99.95 ? 'inv-short' : undefined}>{share === undefined ? 'Unavailable' : `${share.toFixed(1)}%`}</td></tr>;
          })}</tbody>
        </table>
      </div>}
    </Panel>
  );
}
