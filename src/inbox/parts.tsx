import type { ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import './inbox.css';

export type Tone = 'ok' | 'warn' | 'critical' | 'healing' | 'accent' | 'unknown';

/** Status = icon + word + colour. */
export function Chip({ tone = 'unknown', icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return <span className={`inbox-chip inbox-chip--${tone}`}>{icon}{children}</span>;
}

export const ICON = { size: 14, strokeWidth: 1.5, 'aria-hidden': true } as const;

/** Card enter 240 ms ease-out-quart (opacity + 6px), exit 180 ms. Instant for reduced motion. */
export function useCardMotion() {
  const reduce = useReducedMotion();
  if (reduce) return { initial: false as const, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0 } };
  return {
    initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.165, 0.84, 0.44, 1] as const } },
    exit: { opacity: 0, transition: { duration: 0.18, ease: [0.165, 0.84, 0.44, 1] as const } },
  };
}
