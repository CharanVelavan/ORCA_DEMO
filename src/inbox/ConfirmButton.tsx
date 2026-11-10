import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ICON } from './parts';
import { plainError } from './format';
import './inbox.css';

/** Two-step plain confirmation: click the action, then click Confirm. No PIN. */
export function ConfirmButton({ label, confirmLabel = 'Confirm', hint, tone = 'primary', onConfirm }: {
  label: string; confirmLabel?: string; hint?: string; tone?: 'primary' | 'danger' | 'plain'; onConfirm: () => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const cls = `inbox-btn${tone === 'primary' ? ' inbox-btn--primary' : tone === 'danger' ? ' inbox-btn--danger' : ''}`;
  const run = async () => {
    if (pending) return;
    setPending(true); setError('');
    try { await onConfirm(); if (alive.current) setAsking(false); }
    catch (err) { if (alive.current) setError(plainError(err)); }
    finally { if (alive.current) setPending(false); }
  };
  if (!asking) return <button type="button" className={cls} onClick={() => setAsking(true)}>{label}</button>;
  return (
    <div className="inbox-confirm">
      {hint && <p className="inbox-body inbox-body--muted">{hint}</p>}
      <div className="inbox-actions">
        <button type="button" className={cls} disabled={pending} aria-busy={pending} onClick={() => void run()} autoFocus>
          {pending ? <><Loader2 {...ICON} className="inbox-spin" aria-hidden /> Working</> : confirmLabel}
        </button>
        <button type="button" className="inbox-btn" disabled={pending} onClick={() => { setAsking(false); setError(''); }}>Cancel</button>
      </div>
      {error && <p className="inbox-error" role="alert">{error}</p>}
    </div>
  );
}
