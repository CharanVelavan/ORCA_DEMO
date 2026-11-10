import { Component, type ReactNode } from 'react';
/** A stale lazy-loaded asset after a rebuild must leave a recoverable screen. */
export class PageErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() {
    return this.state.failed ? <main className="app-view-error" role="alert"><strong>ORCA—NTN</strong><h1>This view could not load.</h1><p>Reload to fetch the current dashboard build. The backend exercise continues independently.</p><button type="button" className="sh-btn sh-btn--primary" onClick={() => window.location.reload()}>Reload dashboard</button></main> : this.props.children;
  }
}
