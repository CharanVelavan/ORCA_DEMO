import type { KeyboardEvent } from 'react';
/** Standard roving-focus keyboard navigation for a horizontal tab list. */
export function tabKeys<T extends string>(event: KeyboardEvent, ids: T[], index: number, select: (id:T) => void, prefix:string) {
  if (!['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? ids.length-1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
  select(ids[next]); document.getElementById(`${prefix}${ids[next]}`)?.focus();
}
