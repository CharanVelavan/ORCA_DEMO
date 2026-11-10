import { useState } from 'react';
import { api } from '../api';
import { useLiveStore } from '../store';
import { plainError } from './format';
import { isReadOnlyPlayback, PLAYBACK_NOTICE } from './readOnly';
import './inbox.css';

export function useKilled(): boolean {
  return (useLiveStore((s) => s.kill) as Record<string, unknown> | null)?.engaged === true;
}

export function useKillStatus(): 'engaged' | 'armed' | 'unknown' {
  const engaged = (useLiveStore((s) => s.kill) as Record<string, unknown> | null)?.engaged;
  const killed = (useLiveStore((s) => s.autonomy) as Record<string, unknown> | null)?.killed;
  const state = typeof engaged === 'boolean' ? engaged : killed;
  return state === true ? 'engaged' : state === false ? 'armed' : 'unknown';
}

export function KillPanel({ onDone }: { onDone: () => void }) {
  const status = useKillStatus();
  const killed = status === 'engaged';
  const source = useLiveStore((s) => s.source);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const readOnly = source === 'replay' || isReadOnlyPlayback();
  const submit = async () => {
    if (pending) return;
    if (isReadOnlyPlayback()) { setError(PLAYBACK_NOTICE); return; }
    setPending(true); setError('');
    try {
      if (killed) await api.releaseKill({});
      else await api.kill({ reason: reason.trim() || 'Engaged by commander' });
      onDone();
    } catch (err) {
      setError(plainError(err));
    } finally { setPending(false); }
  };
  return (
    <form className="inbox-pop" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div className="inbox-pop__title">{killed ? 'Kill switch engaged' : status === 'armed' ? 'Kill switch armed' : 'Kill switch state unavailable'}</div>
      <p className="inbox-body inbox-body--muted">
        {killed ? 'All tokens are revoked and no playbook can execute.' : 'Engaging revokes every unused token, drops all autonomy grants, and refuses execution.'}
      </p>
      {!killed && (
        <label className="inbox-field">Reason
          <input value={reason} maxLength={160} disabled={readOnly || pending} onChange={(e) => setReason(e.target.value)} placeholder="Short reason" />
        </label>
      )}
      <button className={`inbox-btn ${killed ? 'inbox-btn--primary' : 'inbox-btn--danger'}`} type="submit" disabled={pending || readOnly} aria-busy={pending}>
        {pending ? 'Sending' : killed ? 'Release kill switch' : 'Engage kill switch'}
      </button>
      {readOnly && <p className="inbox-body inbox-body--muted">{PLAYBACK_NOTICE}</p>}
      {error && <p className="inbox-error" role="alert">{error}</p>}
    </form>
  );
}
