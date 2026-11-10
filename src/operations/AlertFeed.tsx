import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BellRing, OctagonAlert, TriangleAlert } from 'lucide-react';
import { SITES, type DeriveInput, type Tone } from '../derive';
import { Empty, Panel, StatusBadge, simClockIST } from '../shell';
import type { LiveEvent } from '../types';
import { text } from './data';

const EASE_OUT = [0.165, 0.84, 0.44, 1] as const;

export function alertTone(event: LiveEvent): { tone: Tone; word: string } {
  const severity = (text(event.severity) ?? text(event.level) ?? '').toLowerCase();
  if (severity === 'critical' || severity === 'high') return { tone: 'critical', word: 'Critical' };
  if (severity === 'info' || severity === 'low') return { tone: 'accent', word: 'Notice' };
  return { tone: 'warn', word: 'Alert' };
}

/** Observed alerts only (audience "control" is filtered out upstream and again here). */
export function visibleAlerts(data: DeriveInput, limit = 6): LiveEvent[] {
  return (data.alerts ?? []).filter((event) => event.audience !== 'control').slice(-limit).reverse();
}

export function AlertFeed({ data }: { data: DeriveInput }) {
  const reduced = useReducedMotion();
  const alerts = visibleAlerts(data);
  const total = (data.alerts ?? []).filter((event) => event.audience !== 'control').length;
  return (
    <Panel title="Alert feed" icon={BellRing} right={<StatusBadge tone={total ? 'warn' : 'unknown'} word={total ? `${total} received` : 'None received'} size="sm" />}>
      {!alerts.length ? <Empty>No alert has been raised by the models.</Empty> : (
        <ol className="ops-alerts" aria-live="polite">
          <AnimatePresence initial={false}>
            {alerts.map((alert) => {
              const view = alertTone(alert);
              const site = text(alert.site);
              const area = SITES.find((item) => item.id === site)?.area;
              const Icon = view.tone === 'critical' ? OctagonAlert : TriangleAlert;
              return (
                <motion.li key={`${alert.seq}-${text(alert.id) ?? ''}`} data-tone={view.tone}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0.12 : 0.22, ease: EASE_OUT }}>
                  <span className="ops-alerts__icon" aria-hidden><Icon size={14} /></span>
                  <div className="ops-alerts__body">
                    <div className="ops-alerts__head">
                      <strong>{text(alert.label) ?? text(alert.id) ?? 'Alert'}</strong>
                      <time className="mono">{simClockIST(alert.ts)} IST</time>
                    </div>
                    <p>{[site && `${site}${area ? ` (${area})` : ''}`, text(alert.source) && `raised by ${alert.source}`].filter(Boolean).join(' · ')}</p>
                    {text(alert.text) && <p className="ops-alerts__text">{text(alert.text)}</p>}
                  </div>
                  <StatusBadge tone={view.tone} word={view.word} size="sm" />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </Panel>
  );
}
