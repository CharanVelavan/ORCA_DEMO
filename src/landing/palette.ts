// Reads the theme tokens from CSS so the 3D scene follows the active theme.
export type Palette = {
  light: boolean;
  bg: string; surface: string; surface2: string; ink: string; inkMuted: string;
  border: string; accent: string; warn: string;
};

const DARK: Palette = {
  light: false, bg: '#111316', surface: '#1A1D21', surface2: '#22262B', ink: '#E7E9EC',
  inkMuted: '#9AA3AE', border: '#2A2E34', accent: '#7FA7CF', warn: '#D6A24E',
};

export function readPalette(): Palette {
  const el = document.documentElement;
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    light: el.getAttribute('data-theme') === 'light',
    bg: v('--bg', DARK.bg), surface: v('--surface', DARK.surface), surface2: v('--surface-2', DARK.surface2),
    ink: v('--ink', DARK.ink), inkMuted: v('--ink-muted', DARK.inkMuted), border: v('--border', DARK.border),
    accent: v('--accent', DARK.accent), warn: v('--warn', DARK.warn),
  };
}

export const DEFAULT_PALETTE = DARK;
