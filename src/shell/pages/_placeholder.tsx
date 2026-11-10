/** Shared placeholder body for wave-1 pages. Wave-2 owners replace the page module. */
import type { ReactNode } from 'react';
import { Panel } from '../primitives';

export function PlaceholderNote({ owner, children }: { owner: string; children?: ReactNode }) {
  return (
    <Panel title="Wave 2 page owner" icon={undefined}>
      <p className="sh-ph">This is the shell placeholder for <b>{owner}</b>. The data layer, header KPIs, bottom
        stepper and the live flow panel are wired by the shell and read real engine events through <code className="sh-code">derive.ts</code>.
        The page owner renders the detailed panels here without editing <code className="sh-code">App.tsx</code>.</p>
      {children}
    </Panel>
  );
}
