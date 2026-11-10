/**
 * Shell primitives — the shared building blocks every page composes with.
 * Exported via src/shell/index.ts. See docs/plan/SHELL_API.md.
 * Data-only status mapping lives in derive.ts; this file renders it.
 */
import type { CSSProperties, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, XCircle, type LucideIcon } from 'lucide-react';
import type { Tone } from '../derive';

/* --- Panel: the standard card --- */
export function Panel({
  title, icon: Icon, right, children, className, style, pad = true,
}: {
  title?: ReactNode; icon?: LucideIcon; right?: ReactNode; children?: ReactNode;
  className?: string; style?: CSSProperties; pad?: boolean;
}) {
  return (
    <section className={`sh-panel${className ? ' ' + className : ''}`} style={style}>
      {(title || right) && (
        <header className="sh-panel__head">
          <div className="sh-panel__title">{Icon && <Icon size={15} strokeWidth={2} />}<span>{title}</span></div>
          {right && <div className="sh-panel__right">{right}</div>}
        </header>
      )}
      <div className={pad ? 'sh-panel__body' : 'sh-panel__body sh-panel__body--flush'}>{children}</div>
    </section>
  );
}

/* --- Stat: a labelled KPI --- */
export function Stat({
  label, value, unit, delta, deltaTone = 'ok', icon: Icon, tone, hint, testid,
}: {
  label: ReactNode; value: ReactNode; unit?: string; delta?: string; deltaTone?: Tone;
  icon?: LucideIcon; tone?: Tone; hint?: ReactNode; testid?: string;
}) {
  return (
    <div className="sh-stat" data-testid={testid}>
      <div className="sh-stat__label">{Icon && <Icon size={14} strokeWidth={2} />}<span>{label}</span></div>
      <div className="sh-stat__value" style={tone ? { color: `var(--${toneVar(tone)})` } : undefined}>
        <span data-testid={testid ? `${testid}-value` : undefined}>{value}</span>{unit && <span className="sh-stat__unit">{unit}</span>}
        {delta && <span className="sh-stat__delta" style={{ color: `var(--${toneVar(deltaTone)})` }}>{delta}</span>}
      </div>
      {hint && <div className="sh-stat__hint">{hint}</div>}
    </div>
  );
}

/* --- Status: icon + word + colour (never colour alone) --- */
const TONE_ICON: Record<Tone, LucideIcon> = {
  ok: CheckCircle2, warn: AlertTriangle, critical: XCircle, healing: Loader2, accent: CircleDashed, unknown: CircleDashed,
};
export function toneVar(tone: Tone): string {
  return tone === 'accent' ? 'accent' : tone;
}
export function StatusBadge({ tone, word, size = 'md', spin }: { tone: Tone; word: ReactNode; size?: 'sm' | 'md'; spin?: boolean }) {
  const Icon = TONE_ICON[tone];
  return (
    <span className={`sh-status sh-status--${size}`} style={{ color: `var(--${toneVar(tone)})`, background: `var(--${toneVar(tone)}-soft)` }}>
      <Icon size={size === 'sm' ? 12 : 13} strokeWidth={2.2} className={spin || tone === 'healing' ? 'sh-spin' : undefined} />
      <span>{word}</span>
    </span>
  );
}
/** Small coloured dot + word, for dense rows. */
export function StatusDot({ tone, word }: { tone: Tone; word: ReactNode }) {
  return (
    <span className="sh-dot"><i style={{ background: `var(--${toneVar(tone)})` }} /><span>{word}</span></span>
  );
}

/* --- Pill / Chip --- */
export function Pill({ tone = 'unknown', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`sh-pill${className ? ' ' + className : ''}`} style={{ color: `var(--${toneVar(tone)})`, background: `var(--${toneVar(tone)}-soft)` }}>{children}</span>;
}
export function Chip({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return <span className="sh-chip">{Icon && <Icon size={12} strokeWidth={2} />}{children}</span>;
}

/* --- Emulated badge (always shown where network is referenced) --- */
export function EmulatedBadge({ small }: { small?: boolean }) {
  return <span className={`sh-emulated${small ? ' sh-emulated--sm' : ''}`}><i />Emulated</span>;
}

/* --- Code / record id --- */
export function Code({ children }: { children: ReactNode }) {
  return <code className="sh-code">{children}</code>;
}

/* --- Empty state --- */
export function Empty({ children }: { children: ReactNode }) {
  return <div className="sh-empty">{children}</div>;
}

/* --- Sparkline (tiny inline SVG, for M2 and series) --- */
export function Sparkline({ points, tone = 'accent', width = 96, height = 28 }: { points: number[]; tone?: Tone; width?: number; height?: number }) {
  if (!points.length) return <span className="sh-empty sh-empty--inline">—</span>;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - ((p - min) / span) * height).toFixed(1)}`).join(' ');
  return (
    <svg className="sh-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={`var(--${toneVar(tone)})`} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
