import { useEffect, useState } from 'react';
import { api } from '../api';
import type { DeriveInput, Tone } from '../derive';
import type { LiveEvent } from '../types';

export type RecordInfo = {
  id: string;
  jurisdiction?: string;
  instrument?: string;
  clause?: string;
  authority?: string;
  binding_status?: string;
  in_force_from?: string | null;
  in_force_status?: string;
  topic?: string;
  pinpoint?: string;
  verified?: boolean;
  source_url?: string;
  source_sha256?: string;
  quote?: string;
  summary?: string;
};

export type CatalogueGap = {
  id: string;
  title?: string;
  jurisdiction?: string;
  status?: string;
  topic?: string;
  evidence?: unknown[];
  global_examples?: unknown[];
};

export type PolicyCatalogue = { records: RecordInfo[]; gaps: CatalogueGap[] };

export const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;
export const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
export const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
export const objects = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : [];
export const unique = (values: string[]): string[] => [...new Set(values)];
export const humanDecision = (value: unknown): 'confirm' | 'reject' | null =>
  value === 'confirm' || value === 'confirmed' ? 'confirm' : value === 'reject' || value === 'rejected' ? 'reject' : null;

export function usePolicyCatalogue(kb: unknown) {
  const [catalogue, setCatalogue] = useState<PolicyCatalogue | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setCatalogue(null);
    setError(null);
    api.catalogue().then((result) => {
      if (!Array.isArray(result.records) || !Array.isArray(result.gaps)) {
        throw new Error('The policy catalogue does not contain records and gaps.');
      }
      if (active) setCatalogue({
        records: result.records.filter((row): row is RecordInfo => Boolean(text(object(row).id))),
        gaps: result.gaps.filter((row): row is CatalogueGap => Boolean(text(object(row).id))),
      });
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Policy catalogue unavailable.');
    });
    return () => { active = false; };
  }, [kb]);
  return { catalogue, error };
}

const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
});
const dateOnly = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
});

export function timestampMs(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function dateIST(value: unknown): string {
  const ms = timestampMs(value);
  return ms === undefined ? 'Unavailable' : dateOnly.format(ms);
}

export function timeIST(value: unknown): string {
  const ms = timestampMs(value);
  return ms === undefined ? 'Unavailable' : `${dateTime.format(ms)} IST`;
}

export function minuteDuration(value: unknown): string {
  const minutes = finite(value);
  if (minutes === undefined || minutes < 0) return 'Unavailable';
  return `${Number(minutes.toFixed(2))} min`;
}

export function secondsDuration(value: unknown): string {
  const seconds = finite(value);
  if (seconds === undefined || seconds < 0) return 'Unavailable';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  return [hours ? `${hours} h` : '', minutes ? `${minutes} min` : '', `${remainder} s`].filter(Boolean).join(' ');
}

export function recordBinding(record: RecordInfo): { word: string; tone: Tone } {
  if (record.binding_status === 'binding') return { word: 'Binding', tone: 'accent' };
  if (record.binding_status === 'binding_not_in_force') {
    return record.in_force_status === 'in_force'
      ? { word: 'Binding', tone: 'accent' }
      : { word: 'Binding, not yet in force', tone: 'warn' };
  }
  if (record.binding_status === 'non_binding') {
    return { word: record.id.startsWith('IN-SPACEFW-') ? 'Advisory, non-binding' : 'Non-binding', tone: 'unknown' };
  }
  return { word: 'Binding status not stated', tone: 'unknown' };
}

export function recordInForce(record: RecordInfo): string {
  if (record.in_force_status === 'in_force') return 'In force';
  if (record.in_force_status === 'not_yet') {
    return record.in_force_from ? `Not in force until ${dateIST(record.in_force_from)}` : 'Not yet in force';
  }
  if (record.in_force_status === 'not_binding') return 'Non-binding';
  return 'In-force status not stated';
}

export const VERDICTS = [
  'COMPLIANT', 'VIOLATION', 'AMBIGUITY', 'CONFLICT', 'POTENTIAL_GAP', 'INSUFFICIENT_EVIDENCE',
] as const;
export type Verdict = typeof VERDICTS[number];

export function verdictTone(value: unknown): Tone {
  if (value === 'COMPLIANT') return 'ok';
  if (value === 'VIOLATION' || value === 'CONFLICT') return 'critical';
  if (value === 'AMBIGUITY' || value === 'POTENTIAL_GAP') return 'warn';
  return 'unknown';
}

export function actualVerdicts(events: LiveEvent[]): LiveEvent[] {
  return events.filter((event) =>
    event.audience !== 'control' && event.kind === 'verdict' && VERDICTS.some((verdict) => verdict === event.verdict));
}

export type ClockView = {
  event: LiveEvent;
  regime: string;
  recordIds: string[];
  trigger?: string;
  start?: string;
  due?: string;
  notifiedAt?: string;
  notifiedBeforeStart: boolean;
  notifyMin?: number;
  windowMin?: number;
  status: 'met' | 'missed' | 'open' | 'overdue' | 'unavailable';
  remainingMs?: number;
};

export function reportingClocks(data: DeriveInput): ClockView[] {
  const timing = object(data.summary?.audience === 'control' ? undefined : data.summary?.timings);
  const summaries = objects(timing.clocks);
  const now = timestampMs(data.ts);
  return (data.obligations ?? []).filter((event) => event.audience !== 'control').map((event) => {
    const regime = text(event.regime) ?? 'Rule id unavailable';
    const summary = summaries.find((row) => {
      if (text(event.obligation_id) && text(row.obligation_id)) return event.obligation_id === row.obligation_id;
      if (typeof row.obligation_seq === 'number') return row.obligation_seq === event.seq;
      // Legacy recordings have no ids: only an exact obligation tuple can join.
      return row.regime === regime && row.started_at === event.started_at && row.due_at === event.due_at
        && typeof event.started_at === 'string' && typeof event.due_at === 'string';
    });
    const due = text(event.due_at) ?? text(summary?.due_at);
    const dueMs = timestampMs(due);
    const remainingMs = now !== undefined && dueMs !== undefined ? dueMs - now : undefined;
    const explicit = text(event.status);
    const status: ClockView['status'] =
      explicit === 'met' || summary?.met === true ? 'met'
        : explicit === 'missed' || summary?.met === false ? 'missed'
          : remainingMs !== undefined && remainingMs < 0 ? 'overdue'
            : remainingMs !== undefined || explicit === 'open' ? 'open' : 'unavailable';
    const ids = unique([...strings(event.records), ...(text(summary?.record_id) ? [text(summary?.record_id)!] : [])]);
    return {
      event, regime, recordIds: ids,
      trigger: text(event.trigger) ?? text(summary?.trigger),
      start: text(event.started_at) ?? text(summary?.started_at),
      due,
      notifiedAt: text(summary?.notified_at),
      notifiedBeforeStart: summary?.notified_before_start === true,
      notifyMin: finite(summary?.time_to_notify_min),
      windowMin: finite(summary?.window_min),
      status, remainingMs,
    };
  });
}

export function remainingText(clock: ClockView): string {
  if (clock.status === 'met' || clock.status === 'missed') return 'Decision recorded';
  if (clock.remainingMs === undefined) return 'Countdown unavailable';
  const seconds = Math.floor(Math.abs(clock.remainingMs) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} h ${String(minutes).padStart(2, '0')} min ${clock.remainingMs < 0 ? 'overdue' : 'remaining'}`;
}

export function recordIdsForGap(gap: Record<string, unknown>): string[] {
  return unique([...strings(gap.records), ...strings(gap.record_ids), ...strings(gap.evidence), ...strings(object(gap.india).records)]);
}

export function recommendationText(value: unknown): string | undefined {
  return text(value) ?? text(object(value).ask) ?? text(object(value).action);
}

export function roleLabel(value: unknown): string | undefined {
  const role = text(value);
  return role?.replace(/^human:/, '').replace(/_/g, ' ');
}
