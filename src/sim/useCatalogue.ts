import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import { SCENARIO_PATHS } from '../pipeline/scenarioPaths';
import { FALLBACK_INJECTORS, FALLBACK_TARGETS } from './injectors';
import type { InjectorCategory, InjectorInfo } from './injectors';

export type ScenarioKind = 'normal' | 'attack' | 'fault' | 'audit' | 'mixed';
export type ScenarioInfo = {
  id: string; title: string; story: string; kind: ScenarioKind; sites: string[];
  m3_expected: string; region?: string; start?: string; objective?: string;
};
export type CatalogueSite = { area?: string; paths?: Record<string, string[]> };
export type Catalogue = {
  scenarios: ScenarioInfo[]; injectors: InjectorInfo[]; targets: string[];
  sites: Record<string, CatalogueSite>; fixtureScenarios?: string[];
  live: boolean; loading: boolean; error?: string;
};

const ORDER = ['S0', 'S1', 'S2', 'S3', 'N1', 'N2', 'N3', 'N4', 'N5', 'CAP'];
const rank = (id: string) => { const i = ORDER.indexOf(id); return i < 0 ? 99 : i; };
const KINDS: ScenarioKind[] = ['normal', 'attack', 'fault', 'audit', 'mixed'];

const fallbackScenarios = (): ScenarioInfo[] =>
  SCENARIO_PATHS.map((p) => ({ id: p.id, title: p.title, story: p.story, kind: p.kind, sites: p.sites, m3_expected: p.m3Expected }))
    .sort((a, b) => rank(a.id) - rank(b.id));

const asStrings = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? v : String((v as { id?: unknown })?.id ?? ''))).filter(Boolean);
  if (value && typeof value === 'object') return Object.keys(value);
  return [];
};

function parse(raw: Record<string, unknown>): Catalogue {
  const fb = fallbackScenarios();
  const fbById = new Map(fb.map((s) => [s.id, s]));
  const apiScenarios = Array.isArray(raw.scenarios) ? (raw.scenarios as Record<string, unknown>[]) : null;
  let scenarios: ScenarioInfo[];
  if (!apiScenarios) {
    scenarios = fb;
  } else {
    scenarios = apiScenarios.map((s) => {
      const id = String(s.id ?? '').toUpperCase();
      const base = fbById.get(id);
      const kind = KINDS.includes(s.kind as ScenarioKind) ? (s.kind as ScenarioKind) : base?.kind ?? 'normal';
      const objective = s.objective && typeof s.objective === 'object'
        ? (s.objective as Record<string, unknown>).what : undefined;
      return {
        id, kind,
        title: String(s.title ?? base?.title ?? id),
        story: String(s.story ?? base?.story ?? ''),
        sites: Array.isArray(s.sites) ? (s.sites as unknown[]).map(String) : base?.sites ?? [],
        m3_expected: String(s.m3_expected ?? base?.m3_expected ?? ''),
        region: typeof s.region === 'string' ? s.region : typeof raw.region === 'string' ? raw.region : undefined,
        start: typeof s.start === 'string' ? s.start : undefined,
        objective: typeof objective === 'string' ? objective : undefined,
      };
    }).filter((s) => s.id).sort((a, b) => rank(a.id) - rank(b.id));
  }
  const apiInj = Array.isArray(raw.injectors) ? (raw.injectors as Record<string, unknown>[]) : null;
  const injectors: InjectorInfo[] = apiInj
    ? apiInj.map((i) => ({ id: String(i.id), label: String(i.label ?? i.id), default_target: String(i.default_target ?? ''), category: (i.category as InjectorCategory) ?? 'attack' }))
    : FALLBACK_INJECTORS;
  const targets = [...new Set([...asStrings(raw.sites), ...asStrings(raw.gateways), ...asStrings(raw.accounts), 'SAT-MGMT'])];
  const sites = raw.sites && typeof raw.sites === 'object' && !Array.isArray(raw.sites)
    ? raw.sites as Record<string, CatalogueSite> : {};
  const fixtureScenarios = Array.isArray(raw.fixture_scenarios)
    ? raw.fixture_scenarios.filter((id): id is string => typeof id === 'string').map((id) => id.toUpperCase())
    : undefined;
  return { scenarios, injectors, targets: targets.length > 3 ? targets : FALLBACK_TARGETS,
    sites, fixtureScenarios, live: true, loading: false };
}

const fallback = (loading = false, error?: string): Catalogue => ({
  scenarios: fallbackScenarios(), injectors: FALLBACK_INJECTORS, targets: FALLBACK_TARGETS,
  sites: {}, live: false, loading, error,
});

type Source = 'fixture' | 'live';
const cache: Partial<Record<Source, Catalogue>> = {};
const pending: Partial<Record<Source, Promise<Catalogue>>> = {};

function load(source: Source): Promise<Catalogue> {
  if (cache[source]) return Promise.resolve(cache[source]!);
  pending[source] ??= api.catalogue().then(parse).catch((error: unknown) =>
    fallback(false, error instanceof Error ? error.message : 'Catalogue unavailable.'))
    .then((c) => {
      if (c.live) cache[source] = c;
      delete pending[source];
      return c;
    });
  return pending[source]!;
}

/** Loads api.catalogue() once per page; falls back to local data when the API is down. */
export function useCatalogue(): Catalogue {
  const { search } = useLocation();
  const source: Source = new URLSearchParams(search).get('fake') === '1' ? 'fixture' : 'live';
  const [data, setData] = useState<Catalogue>(() => cache[source] ?? fallback(true));
  useEffect(() => {
    let alive = true;
    setData(cache[source] ?? fallback(true));
    void load(source).then((c) => { if (alive) setData(c); });
    return () => { alive = false; };
  }, [source]);
  return data;
}
