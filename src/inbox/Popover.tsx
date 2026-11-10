import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import './inbox.css';

/** Small fixed-position popover, portalled to body so panels with overflow:hidden never clip it. */
export function Popover({ anchor, onClose, placement, label, children }: {
  anchor: RefObject<HTMLElement | null>; onClose: () => void; placement: 'right' | 'below'; label: string; children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    const a = anchor.current?.getBoundingClientRect();
    if (!a) return;
    if (placement === 'right') setStyle({ left: a.right + 8, top: Math.max(8, Math.min(a.top, window.innerHeight - 420)) });
    else setStyle({ right: Math.max(8, window.innerWidth - a.right), top: a.bottom + 8 });
  }, [anchor, placement]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (box.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [anchor, onClose]);

  return createPortal(<div ref={box} className="inbox-popover" role="dialog" aria-label={label} style={style}>{children}</div>, document.body);
}
