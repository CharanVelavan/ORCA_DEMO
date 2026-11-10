import { GATEWAYS, MGMT, SITE_STATE, sites, useDerived } from '../derive';
import type { CatalogueSite } from '../sim/useCatalogue';
import { StatusBadge } from '../shell/primitives';

export function TopologyView({ metadata }: { metadata: Record<string, CatalogueSite> }) {
  const d = useDerived();
  return (
    <div className="director-topology">
      <div className="director-topology__upstream">
        <div><strong>Satellite</strong><span>Emulated</span></div>
        <div><strong>{MGMT.id}</strong><span>{MGMT.label}</span></div>
        {GATEWAYS.map((gateway) => {
          const current = d.gateways?.[gateway.id];
          const status = !gateway.allowed ? { tone: 'warn' as const, word: 'Not allowed' }
            : current === 'up' ? { tone: 'ok' as const, word: 'Operational' }
              : current === 'down' ? { tone: 'critical' as const, word: 'Down' }
                : { tone: 'unknown' as const, word: 'Unavailable' };
          return <div key={gateway.id}><strong>{gateway.id}</strong><StatusBadge size="sm" {...status} /></div>;
        })}
      </div>
      <div className="director-topology__table-wrap">
        <table className="director-topology__table">
          <caption>Active paths for the emulated Chennai sites</caption>
          <thead><tr><th>Site</th><th>Status</th><th>Active path</th><th>Gateway</th></tr></thead>
          <tbody>{sites(d).map((site) => {
            const route = site.raw?.active_path && metadata[site.id]?.paths?.[site.raw.active_path];
            const kind = Array.isArray(route) && typeof route[0] === 'string' ? route[0] : undefined;
            return (
              <tr key={site.id}>
                <th scope="row"><span className="mono">{site.id}</span><small>{site.area}</small></th>
                <td><StatusBadge size="sm" {...SITE_STATE[site.state]} /></td>
                <td>{site.raw?.active_path ? `${site.raw.active_path}: ${kind ?? 'link type unavailable'} (Emulated)` : 'Unavailable'}</td>
                <td>{site.raw?.gateway ?? 'Unavailable'}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
