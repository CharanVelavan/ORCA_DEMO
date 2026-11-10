import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useLiveStore } from './store';
useLiveStore.getState().setSource('replay');
import { Shell } from './shell';
import { PageErrorBoundary } from './shell/PageErrorBoundary';
import { ReplayProvider } from './review/ReplayProvider';
import { useUi } from './stage/uiStore';
import './shell/shell.css';
import './shell/workspace-shell.css';

/** The seven primary console routes lazy-load their page modules inside the shared shell. */
const Home = lazy(() => import('./shell/pages/Home'));
const Scenarios = lazy(() => import('./shell/pages/Scenarios'));
const Workspace = lazy(() => import('./shell/pages/Workspace'));
const Investigation = lazy(() => import('./shell/pages/Investigation'));
const Policy = lazy(() => import('./shell/pages/Policy'));
const Recovery = lazy(() => import('./shell/pages/Recovery'));
const Audit = lazy(() => import('./shell/pages/Audit'));
const Guide = lazy(() => import('./shell/pages/Guide'));
const NotFound = lazy(() => import('./shell/pages/NotFound'));

function ThemeSync() {
  const theme = useUi(s => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111111' : '#F3F3F3');
  }, [theme]);
  return null;
}

function Loading() {
  return <main className="app-loading"><span className="mono">ORCA-NTN</span><span>Loading view</span></main>;
}

/** Redirect legacy entrypoints to the new routes, preserving ?fake / ?scn query. */
function KeepQueryRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeSync />
      <ReplayProvider><PageErrorBoundary><Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route path="/simulator" element={<Navigate to="/scenarios" replace />} />
            <Route path="/scenarios" element={<Scenarios />} />
            <Route path="/workspace" element={<Workspace />} />
            <Route path="/operations" element={<Navigate to="/workspace" replace />} />
            <Route path="/investigation" element={<Investigation />} />
            <Route path="/policy" element={<Policy />} />
            <Route path="/recovery" element={<Recovery />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/console" element={<KeepQueryRedirect to="/workspace" />} />
          <Route path="/stage" element={<KeepQueryRedirect to="/operations" />} />
          <Route path="/control" element={<KeepQueryRedirect to="/simulator" />} />
          <Route path="/review" element={<KeepQueryRedirect to="/audit" />} />
        </Routes>
      </Suspense></PageErrorBoundary></ReplayProvider>
    </BrowserRouter>
  );
}
