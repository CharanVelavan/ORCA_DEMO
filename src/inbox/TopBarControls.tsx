import { useCallback, useRef, useState } from 'react';
import { CircleHelp, Gauge, OctagonAlert, ShieldCheck } from 'lucide-react';
import { Popover } from './Popover';
import { AutonomyPanel, useAutonomy } from './autonomy';
import { KillPanel, useKillStatus } from './KillPanel';
import { ICON } from './parts';
import './inbox.css';

const MODE_TONE = { MANUAL: 'unknown', ASSISTED: 'accent', AUTO: 'warn' } as const;

/** Compact top-bar badge: MANUAL / ASSISTED / AUTO. Click opens the autonomy popover. */
export function AutonomyBadge() {
  const { mode } = useAutonomy();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button ref={ref} type="button" className={`inbox-topbtn inbox-topbtn--${MODE_TONE[mode]}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Gauge {...ICON} /><span className="inbox-topbtn__lbl">Autonomy</span><span className="mono">{mode}</span>
      </button>
      {open && <Popover anchor={ref} onClose={close} placement="below" label="Autonomy mode"><AutonomyPanel onDone={close} /></Popover>}
    </>
  );
}

/** Compact top-bar button: ARMED (ready) or ENGAGED. Click opens reason and confirm. */
export function KillSwitchButton() {
  const status = useKillStatus();
  const killed = status === 'engaged';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button ref={ref} type="button" className={`inbox-topbtn ${killed ? 'inbox-topbtn--critical' : status === 'armed' ? 'inbox-topbtn--ok' : 'inbox-topbtn--unknown'}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {killed ? <OctagonAlert {...ICON} /> : status === 'armed' ? <ShieldCheck {...ICON} /> : <CircleHelp {...ICON} />}<span className="inbox-topbtn__lbl">Kill switch</span><span className="inbox-topbtn__word">{killed ? 'Engaged' : status === 'armed' ? 'Armed' : 'State unavailable'}</span>
      </button>
      {open && <Popover anchor={ref} onClose={close} placement="below" label="Kill switch"><KillPanel onDone={close} /></Popover>}
    </>
  );
}
