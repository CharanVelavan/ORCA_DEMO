import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Activity, Check, Loader, X } from 'lucide-react';
import { useUi } from '../stage/uiStore';
import { CATEGORY_LABEL, INJECTOR_ICONS, groupInjectors } from './injectors';
import { useCatalogue } from './useCatalogue';
import { useFire } from './useFire';
import './sim.css';

const EASE = [0.165, 0.84, 0.44, 1] as const;
const DURATIONS = [5, 15, 30];

/** Overlay over the 3D view. The parent positions it (absolute, left, full height). */
export function SimDrawer({ inline = false }: { inline?: boolean }) {
  const open = useUi((s) => s.simDrawer);
  const toggleDrawer = useUi((s) => s.toggleDrawer);
  const fired = useUi((s) => s.fired);
  const { injectors, targets } = useCatalogue();
  const { fire, pending, errors } = useFire();
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<Record<string, { target?: string; minutes?: number }>>({});

  useEffect(() => {
    if (!open || inline) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') toggleDrawer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, inline, toggleDrawer]);

  const shift = reduce ? 0 : -32;
  const content = (
    <>
          <header className="sim-head">
            <h2 className="sim-title">Simulator</h2>
            <span className="sim-tag">Ground truth, director only</span>
            {!inline && <button type="button" className="sim-icon-btn" aria-label="Close simulator" title="Close (Esc)" onClick={() => toggleDrawer(false)}>
              <X size={18} strokeWidth={1.5} aria-hidden />
            </button>}
          </header>
          <div className="sim-scroll">
            {groupInjectors(injectors).map((g) => (
              <div key={g.category} className="sim-drawer-group">
                <h3 className="sim-sub">{CATEGORY_LABEL[g.category]}</h3>
                {g.items.map((i) => {
                  const Icon = INJECTOR_ICONS[i.id] ?? Activity;
                  const p = picked[i.id] ?? {};
                  const target = p.target ?? i.default_target;
                  const minutes = p.minutes ?? 15;
                  const set = (patch: { target?: string; minutes?: number }) => setPicked((s) => ({ ...s, [i.id]: { ...s[i.id], ...patch } }));
                  const options = targets.includes(target) ? targets : [target, ...targets];
                  return (
                    <div key={i.id} className="sim-drow">
                      <span className="sim-drow-name"><Icon size={16} strokeWidth={1.5} aria-hidden />{i.label}</span>
                      <div className="sim-drow-ctl">
                        <select className="sim-select mono" aria-label={`Target for ${i.label}`} value={target} onChange={(e) => set({ target: e.target.value })}>
                          {options.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select className="sim-select mono" aria-label={`Duration for ${i.label}`} value={minutes} onChange={(e) => set({ minutes: Number(e.target.value) })}>
                          {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
                        </select>
                        <button type="button" className="sim-fire" disabled={pending === i.id} onClick={() => void fire(i.id, target, minutes)}>
                          {pending === i.id ? <Loader size={14} strokeWidth={1.5} className="sim-spin" aria-hidden /> : 'Fire'}
                        </button>
                      </div>
                      {errors[i.id] && <p className="sim-error" role="alert">{errors[i.id]}</p>}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="sim-drawer-group">
              <h3 className="sim-sub">Fired this run</h3>
              {fired.length === 0 ? <p className="sim-empty">Nothing fired yet.</p> : (
                <ul className="sim-fired">
                  {[...fired].reverse().map((f, n) => (
                    <li key={`${f.injector}-${f.at}-${n}`}>
                      <Check size={14} strokeWidth={1.5} className="sim-tone-ok" aria-hidden />
                      <span className="mono">{f.at}</span>
                      <span className="sim-fired-name">{injectors.find((i) => i.id === f.injector)?.label ?? f.injector}</span>
                      <span className="mono sim-fired-target">{f.target}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
    </>
  );
  if (inline) return <aside className="sim-drawer sim-drawer-inline" aria-label="Simulator">{content}</aside>;
  return (
    <AnimatePresence>
      {open && (
        <motion.aside key="sim-drawer" className="sim-drawer" role="dialog" aria-label="Simulator"
          initial={{ opacity: 0, x: shift }} animate={{ opacity: 1, x: 0, transition: { duration: reduce ? 0 : 0.24, ease: EASE } }}
          exit={{ opacity: 0, x: shift, transition: { duration: reduce ? 0 : 0.18, ease: EASE } }}>
          {content}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
