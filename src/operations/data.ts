import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import type { LiveEvent } from '../types';

export type CatalogueRecord = {
  id: string;
  instrument?: string;
  clause?: string;
  binding_status?: string;
  in_force_status?: string;
};
export type CataloguePlaybook = { id: string; title?: string; risk?: string };
export type Catalogue = { records: CatalogueRecord[]; playbooks: CataloguePlaybook[]; error?: string; loading: boolean };

export function useOperationsCatalogue(): Catalogue {
  const { search } = useLocation();
  const [catalogue, setCatalogue] = useState<Catalogue>({ records: [], playbooks: [], loading: true });
  useEffect(() => {
    let active = true;
    setCatalogue({ records: [], playbooks: [], loading: true });
    api.catalogue().then((data) => {
      if (!active) return;
      setCatalogue({
        records: Array.isArray(data.records) ? data.records as CatalogueRecord[] : [],
        playbooks: Array.isArray(data.playbooks) ? data.playbooks as CataloguePlaybook[] : [],
        loading: false,
      });
    }).catch((error: unknown) => {
      if (active) setCatalogue({ records: [], playbooks: [], loading: false, error: error instanceof Error ? error.message : 'Catalogue unavailable.' });
    });
    return () => { active = false; };
  }, [search]);
  return catalogue;
}

export const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;
export const number = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
export const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export function eventRole(event: LiveEvent): string | undefined {
  return text(event.role) ?? text(event.actor)?.replace(/^human:/, '');
}

export function eventCitations(event: LiveEvent): string[] {
  return [...new Set([...strings(event.citations), ...strings(event.citations_accepted), ...strings(event.records), ...strings(event.record_ids), ...strings(event.refs)])];
}

export function safeJson(value: unknown): string {
  const seen = new WeakSet<object>();
  const result = JSON.stringify(value, (key, item: unknown) => {
    if (/pin|password|secret|token|credential/i.test(key)) return '[redacted]';
    if (item && typeof item === 'object') {
      if (seen.has(item)) return '[circular]';
      seen.add(item);
    }
    return item;
  }, 2);
  return result ?? 'Unavailable';
}

export function featurePairs(value: unknown): { name: string; value: string }[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') return [{ name: item, value: 'Reported' }];
      if (!item || typeof item !== 'object') return [];
      const feature = item as Record<string, unknown>;
      const name = text(feature.name) ?? text(feature.feature) ?? text(feature.signal);
      const val = number(feature.value) ?? number(feature.importance) ?? text(feature.value);
      return name ? [{ name, value: val === undefined ? 'Reported' : String(val) }] : [];
    });
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([name, value]) => {
      const val = number(value) ?? text(value);
      return val === undefined ? [] : [{ name, value: String(val) }];
    });
  }
  return [];
}
