import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { Box, Network } from 'lucide-react';
import type { CatalogueSite } from '../sim/useCatalogue';
import { EmulatedBadge } from '../shell/primitives';
import { TopologyView } from './TopologyView';

const NetworkScene = lazy(() => import('../scenes/NetworkScene').then((module) => ({ default: module.NetworkScene })));

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p className="director-scene__fallback" role="status">The 3D network is unavailable. Use Topology instead.</p> : this.props.children;
  }
}

export function NetworkViewport({ metadata }: { metadata: Record<string, CatalogueSite> }) {
  const [view, setView] = useState<'3d' | 'topology'>('topology');
  return (
    <section className="director-network" aria-label="Emulated network view">
      <div className="director-network__bar">
        <div className="director-view-switch" role="group" aria-label="Network view">
          <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}><Box size={15} aria-hidden="true" />3D Network</button>
          <button type="button" aria-pressed={view === 'topology'} onClick={() => setView('topology')}><Network size={15} aria-hidden="true" />Topology</button>
        </div>
        <EmulatedBadge />
      </div>
      {view === '3d' ? (
        <div className="director-scene">
          <SceneBoundary><Suspense fallback={<p className="director-scene__fallback">Loading the 3D network.</p>}><NetworkScene truth={true} /></Suspense></SceneBoundary>
        </div>
      ) : <TopologyView metadata={metadata} />}
      <div className="director-network__caption">Satellite and terrestrial links are Emulated.
        {view === '3d' ? ' Drag the 3D view to rotate.' : ' The active route is shown for each site.'}
      </div>
    </section>
  );
}
