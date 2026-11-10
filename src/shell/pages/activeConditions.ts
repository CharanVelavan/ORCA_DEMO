/** The engine's director-only condition snapshot, in simulated minutes. */
export type ActiveCondition = { id:string; kind:string; label:string; target:string; start:number; end:number|null; state:'pending'|'active'; cancellable:boolean };
export function conditionTime(item:ActiveCondition, t:number): string {
  if (item.end === null) return item.state === 'pending' ? 'Starts next step · duration unavailable' : 'End time unavailable';
  const remaining = Math.max(0, item.end - Math.max(t, item.start));
  return item.state === 'pending' ? `Starts next step · ${remaining} min` : `${remaining} min remaining`;
}
export function parseActiveConditions(value:unknown): { t:number; items:ActiveCondition[] } | null {
  if (!value || typeof value !== 'object') return null;
  const result = value as Record<string,unknown>;
  if (typeof result.t !== 'number' || !Number.isFinite(result.t) || !Array.isArray(result.running_injections)) return null;
  const items:ActiveCondition[] = [];
  for (const entry of result.running_injections) {
    if (!entry || typeof entry !== 'object') return null;
    const row = entry as Record<string,unknown>;
    if (typeof row.id !== 'string' || typeof row.kind !== 'string' || typeof row.target !== 'string' || typeof row.start !== 'number' || !Number.isFinite(row.start) || !(row.end === null || typeof row.end === 'number' && Number.isFinite(row.end)) || !(row.state === 'pending' || row.state === 'active') || typeof row.cancellable !== 'boolean') return null;
    items.push({id:row.id,kind:row.kind,label:typeof row.label === 'string' ? row.label : row.kind,target:row.target,start:row.start,end:row.end,state:row.state,cancellable:row.cancellable});
  }
  return {t:result.t,items};
}
