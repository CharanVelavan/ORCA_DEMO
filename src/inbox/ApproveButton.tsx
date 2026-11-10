import { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { api } from '../api';
import { usePipeline } from '../pipeline/pipelineStore';
import { useLiveStore } from '../store';
import { ICON } from './parts';
import { plainError } from './format';
import { isReadOnlyPlayback, PLAYBACK_NOTICE } from './readOnly';
import './inbox.css';

export function ApproveButton({ hash, variant = 'inbox', label = 'Approve', onDone }: { hash: string; variant?: 'inbox' | 'node'; label?: string; onDone?: () => void }) {
  const source = useLiveStore((s) => s.source);
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const readOnly = source === 'replay' || isReadOnlyPlayback();
  const go = async () => {
    if (pending) return;
    if (isReadOnlyPlayback()) { setError(PLAYBACK_NOTICE); return; }
    setPending(true); setError('');
    try {
      await api.approve({ hash });
      usePipeline.setState((st) => ({ pending: st.pending.filter((p) => p.hash !== hash) }));
      if (alive.current) setAsking(false);
      onDone?.();
    } catch (err) {
      if (alive.current) setError(plainError(err));
    }
    finally { if (alive.current) setPending(false); }
  };
  const node = variant === 'node';
  return (
    <div className="inbox-approval-action">
      {!asking ? (
        <button type="button" className={node ? 'fc-btn' : 'inbox-btn inbox-btn--primary'} disabled={readOnly} title={readOnly ? PLAYBACK_NOTICE : undefined} onClick={() => { setError(''); setAsking(true); }}>
          {label}
        </button>
      ) : (
        <form className="inbox-confirm" onSubmit={(event) => { event.preventDefault(); void go(); }}>
          <p className="inbox-body">Confirm this exact plan for execution.</p>
          <div className="inbox-actions">
            <button type="submit" className={node ? 'fc-btn' : 'inbox-btn inbox-btn--primary'} disabled={pending || readOnly} aria-busy={pending}>
              {pending ? <><Loader2 {...ICON} className="inbox-spin" aria-hidden /> Approving</> : 'Confirm approval'}
            </button>
            <button type="button" className="inbox-btn" disabled={pending} onClick={() => { setAsking(false); setError(''); }}>Cancel</button>
          </div>
        </form>
      )}
      {readOnly && <p className="inbox-body inbox-body--muted">{PLAYBACK_NOTICE}</p>}
      {error && (
        <p className={node ? 'fc-ask__refusal' : 'inbox-refusal'} role="alert">
          <ShieldAlert {...ICON} aria-hidden /><span><strong>Refused.</strong> {error}</span>
        </p>
      )}
    </div>
  );
}
