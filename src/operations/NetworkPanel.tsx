import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { Box, Network, Satellite } from 'lucide-react';
import { GATEWAYS, sites, SITE_STATE } from '../derive';
import { Panel, EmulatedBadge, StatusBadge } from '../shell';
import { useOperatorData } from './useOperatorData';

const NetworkScene = lazy(() => import('../scenes/NetworkScene').then(module => ({ default: module.NetworkScene })));
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="ops-scene-message" role="status">The 3D network is unavailable. Select Topology to inspect observed site states.</div> : this.props.children; }
}

export function NetworkPanel() {
  const [view, setView] = useState<'topology' | '3d'>('topology');
  const data = useOperatorData();
  return <Panel title="Chennai network" icon={Network} right={<div className="operator-network-switch"><button type="button" aria-pressed={view === 'topology'} onClick={() => setView('topology')}>Topology</button><button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}><Box size={12} />3D</button><EmulatedBadge /></div>} className="ops-network" pad={false}>
    {view === '3d' ? <div className="ops-network__scene" aria-label="Emulated Chennai network, ground stations and site states"><SceneBoundary><Suspense fallback={<div className="ops-scene-message" role="status">Loading the emulated network…</div>}><NetworkScene truth={false} compact /></Suspense></SceneBoundary></div> : <div className="operator-topology" aria-label="Observed network topology, all links emulated">
      <div className="operator-topology__satellite"><Satellite size={16} /><strong>Satellite-backed network</strong><span>All links emulated</span></div>
      <div className="operator-topology__gateways">{GATEWAYS.map(gateway => { const current = data.gateways?.[gateway.id]; const status = !gateway.allowed ? { tone: 'warn' as const, word: 'Not allowed' } : current === 'up' ? { tone: 'ok' as const, word: 'Operational' } : current === 'down' ? { tone: 'critical' as const, word: 'Down' } : { tone: 'unknown' as const, word: 'Unobserved' }; return <div key={gateway.id}><code>{gateway.id}</code><StatusBadge size="sm" {...status} /></div>; })}</div>
      <div className="operator-topology__sites">{sites(data).map(site => <div key={site.id} data-state={site.state}><div><strong>{site.area}</strong><StatusBadge size="sm" {...SITE_STATE[site.state]} /></div><small><code>{site.id}</code><span>{site.raw?.gateway ? `${site.raw.gateway} · path ${site.raw.active_path ?? 'unknown'}` : 'Route unobserved'}</span></small></div>)}</div>
    </div>}
  </Panel>;
}
