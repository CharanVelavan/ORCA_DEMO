import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { GripHorizontal, GripVertical } from 'lucide-react';

const PREFIX = 'orca-console-split-';
export const CONSOLE_SPLITS = ['scenario', 'attack', 'evidence', 'truth'] as const;
export function resetConsoleSplits() { try { CONSOLE_SPLITS.forEach(id => localStorage.removeItem(PREFIX + id)); localStorage.removeItem('orca-flow-split'); } catch { /* private mode */ } }
const clamp = (n:number) => Math.min(80, Math.max(20, n));

/** Keyboard and pointer accessible split. Percentages persist independently. */
export function WorkspaceSplit({ id, direction, initial, first, second, label }: { id:string; direction:'horizontal'|'vertical'; initial:number; first:ReactNode; second:ReactNode; label:string }) {
  const parent = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(() => { try { const n = Number(localStorage.getItem(PREFIX + id)); return n >= 20 && n <= 80 ? n : initial; } catch { return initial; } });
  const change = (next:number) => { const v = clamp(next); setValue(v); try { localStorage.setItem(PREFIX + id, String(v)); } catch { /* private mode */ } };
  const drag = (event:PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !parent.current) return;
    const box = parent.current.getBoundingClientRect();
    const fraction = direction === 'horizontal' ? (event.clientX - box.left) / box.width : (event.clientY - box.top) / box.height;
    change(fraction * 100);
  };
  const onKey = (event:KeyboardEvent<HTMLDivElement>) => {
    const before = direction === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    const after = direction === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    if (event.key === before || event.key === after) { event.preventDefault(); change(value + (event.key === before ? -5 : 5)); }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); change(event.key === 'Home' ? 20 : 80); }
  };
  return <div className={`console-split console-split--${direction}`} ref={parent}>
    <div className="console-split__part" style={{ flexBasis:`${value}%` }}>{first}</div>
    <div className="console-split__handle" role="separator" tabIndex={0} aria-label={label} aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'} aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(value)} onKeyDown={onKey} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={drag}>{direction === 'horizontal' ? <GripVertical size={14}/> : <GripHorizontal size={14}/>}</div>
    <div className="console-split__part" style={{ flexBasis:`${100 - value}%` }}>{second}</div>
  </div>;
}
