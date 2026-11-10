import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_PALETTE, readPalette, type Palette } from '../landing/palette';
import type { CatalogueSite } from '../sim/useCatalogue';
import type { SiteState } from '../types';

const Scene3D = lazy(() => import('../landing/Scene3D'));

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() {
    return this.state.failed
      ? <p className="home-scene__message" role="status">The 3D scene is unavailable.</p>
      : this.props.children;
  }
}

export function LandingVisual({ siteStates, topology }: {
  siteStates?: Record<string, SiteState>; topology: Record<string, CatalogueSite>;
}) {
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => setFailed(true), []);

  useEffect(() => {
    const update = () => setPalette(readPalette());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReduced(media.matches);
    media.addEventListener('change', updateMotion);
    return () => { observer.disconnect(); media.removeEventListener('change', updateMotion); };
  }, []);

  return (
    <figure className="home-scene">
      <div className="home-scene__canvas" aria-hidden="true">
        <SceneBoundary onFailure={onFailure}>
          <Suspense fallback={null}>
            <Scene3D pal={palette} reduced={reduced} onReady={onReady} siteStates={siteStates} topology={topology} />
          </Suspense>
        </SceneBoundary>
      </div>
      {!ready && !failed && <span className="home-scene__loading">Loading the emulated network</span>}
      <figcaption>Stylised Chennai network. All links are Emulated.</figcaption>
    </figure>
  );
}
