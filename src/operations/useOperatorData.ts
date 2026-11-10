import { useMemo } from 'react';
import { useDerived, type DeriveInput } from '../derive';

export function operatorData(data: DeriveInput): DeriveInput {
  const visible = <T extends Record<string, unknown>>(items: T[] | undefined) => items?.filter((item) => item.audience !== 'control');
  return {
    ...data,
    session: data.session?.audience === 'control' ? {} : data.session,
    events: visible(data.events),
    tickHistory: visible(data.tickHistory),
    phaseHistory: visible(data.phaseHistory),
    models: visible(data.models),
    alerts: visible(data.alerts),
    approvals: visible(data.approvals),
    gaps: visible(data.gaps),
    verdicts: visible(data.verdicts),
    obligations: visible(data.obligations),
    impact: data.impact?.audience === 'control' ? null : data.impact,
    summary: data.summary?.audience === 'control' ? null : data.summary,
  };
}

export function useOperatorData(): DeriveInput {
  const data = useDerived();
  return useMemo(() => operatorData(data), [data]);
}
