import { useState } from 'react';
import { Activity, Check, ChevronsRight, Loader, Square } from 'lucide-react';
import { usePipeline } from '../pipeline/pipelineStore';
import { stopInject } from './actions';
import { useUi } from '../stage/uiStore';
import { CATEGORY_LABEL, INJECTOR_ICONS, groupInjectors } from './injectors';
import { useCatalogue } from './useCatalogue';
import { useFire } from './useFire';
import './sim.css';

/** State B. 64px wide, full height. The parent must not clip overflow (tooltips open to the right). */
export function AttackRail() {
  const { injectors } = useCatalogue();
  const fired = useUi((s) => s.fired);
  const toggleDrawer = useUi((s) => s.toggleDrawer);
  const { fire, pending, errors } = useFire();
  const demo = useUi((s) => s.config.run === 'demo');
  const nodes = usePipeline((s) => s.nodes);
  const [stopping, setStopping] = useState<string | null>(null);
  const [stopErr, setStopErr] = useState<Record<string, string>>({});
  // Click once to start an attack, click again to stop it (the network then recovers).
  const toggle = async (id: string, target: string) => {
    if (nodes[`threat:${id}`]?.phase !== 'active') return fire(id, target);
    setStopping(id);
    try { await stopInject(id); setStopErr((e) => ({ ...e, [id]: '' })); }
    catch (err) { setStopErr((e) => ({ ...e, [id]: err instanceof Error ? err.message : 'Could not stop it.' })); }
    finally { setStopping(null); }
  };
  const lastFired = new Map(fired.map((f) => [f.injector, f]));

  return (
    <nav className="sim-rail" aria-label="Attack and fault events">
      {groupInjectors(injectors).map((g) => (
        <div key={g.category} className="sim-rail-group" role="group" aria-label={CATEGORY_LABEL[g.category]}>
          <span className="sim-rail-label">{CATEGORY_LABEL[g.category]}</span>
          {g.items.map((i) => {
            const Icon = INJECTOR_ICONS[i.id] ?? Activity;
            const hit = lastFired.get(i.id);
            const err = errors[i.id] || stopErr[i.id];
            const running = nodes[`threat:${i.id}`]?.phase === 'active';
            return (
              <div key={i.id} className="sim-rail-item">
                <button type="button" className={`sim-rail-btn${running ? ' is-running' : hit ? ' is-fired' : ''}${err ? ' is-failed' : ''}`}
                  aria-label={`${running ? 'Stop' : 'Start'} ${i.label}, target ${i.default_target}`} aria-pressed={running} disabled={demo || pending === i.id || stopping === i.id}
                  onClick={() => void toggle(i.id, i.default_target)}>
                  {pending === i.id || stopping === i.id ? <Loader size={18} strokeWidth={1.5} className="sim-spin" aria-hidden /> : running ? <Square size={16} strokeWidth={1.75} aria-hidden /> : <Icon size={18} strokeWidth={1.5} aria-hidden />}
                  {hit && !err && !running && <span className="sim-rail-check" aria-hidden><Check size={10} strokeWidth={2} /></span>}
                </button>
                {hit && <span className="sim-rail-time mono">{hit.at}</span>}
                {err && <span className="sim-rail-fail">Failed</span>}
                <span className="sim-tip" role="tooltip">
                  <span className="sim-tip-label">{i.label}</span>
                  <span className="sim-tip-target mono">{i.default_target}</span>
                  <span className="sim-tip-hint">{demo ? 'Live mode only' : running ? 'Running. Click to stop it.' : 'Click to start. Click again to stop.'}</span>
                  {err && <span className="sim-tip-err">{err}</span>}
                </span>
              </div>
            );
          })}
        </div>
      ))}
      <div className="sim-rail-spacer" />
      <div className="sim-rail-item">
        <button type="button" className="sim-rail-btn" title="Open simulator (S)" aria-label="Open simulator (S)" onClick={() => toggleDrawer(true)}>
          <ChevronsRight size={18} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
