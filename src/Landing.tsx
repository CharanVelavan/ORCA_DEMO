import { Component, lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useUi } from './stage/uiStore';
import { DEFAULT_PALETTE, readPalette } from './landing/palette';
import type { Palette } from './landing/palette';
import './landing/landing.css';

const Scene3D = lazy(() => import('./landing/Scene3D'));

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

const prefersReduced = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export function Landing() {
  const theme = useUi((s) => s.theme);
  const [pal, setPal] = useState<Palette>(DEFAULT_PALETTE);
  const [ready, setReady] = useState(false);
  const [reduced] = useState(prefersReduced);
  const onReady = useCallback(() => setReady(true), []);

  // Read tokens at mount and whenever the theme changes (attribute is applied outside this component).
  useEffect(() => {
    setPal(readPalette());
    const el = document.documentElement;
    const mo = new MutationObserver(() => setPal(readPalette()));
    mo.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [theme]);

  return (
    <main className="land">
      <div className={`land-canvas${ready ? ' land-canvas--on' : ''}`} aria-hidden="true">
        <SceneBoundary>
          <Suspense fallback={null}>
            <Scene3D pal={pal} reduced={reduced} onReady={onReady} />
          </Suspense>
        </SceneBoundary>
      </div>
      <div className="land-scrim" aria-hidden="true" />
      <div className="land-overlay">
        <div className="land-copy">
          <p className="land-eyebrow land-in" style={{ '--i': 0 } as React.CSSProperties}>ITU AI for Good Sandbox, UAE · Solar Sailors</p>
          <h1 className="land-title land-in" style={{ '--i': 1 } as React.CSSProperties}>ORCA-NTN</h1>
          <p className="land-sub land-in" style={{ '--i': 2 } as React.CSSProperties}>Secure self-healing and cyber incident coordination for satellite-backed networks.</p>
          <p className="land-line land-in" style={{ '--i': 3 } as React.CSSProperties}>Models detect, agents coordinate, code decides, humans approve.</p>
          <p className="land-tag land-in" style={{ '--i': 4 } as React.CSSProperties}><span className="land-tag-dot" aria-hidden="true" />EMULATED NETWORK</p>
          <nav className="land-actions land-in" style={{ '--i': 5 } as React.CSSProperties} aria-label="Start">
            <Link className="land-btn land-btn--primary" to="/stage">Run exercise <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" /></Link>
            <Link className="land-btn" to="/control">Simulator</Link>
            <Link className="land-btn" to="/console">Operator console</Link>
          </nav>
        </div>
        <p className="land-foot land-in" style={{ '--i': 6 } as React.CSSProperties}>All satellite links are emulated. Chennai, India.</p>
      </div>
    </main>
  );
}
