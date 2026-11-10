import { useState } from 'react';
import { motion } from 'framer-motion';
import { Ban, CheckCircle2, Clock, FlaskConical, Hourglass, Bot, XCircle } from 'lucide-react';
import { api } from '../api';
import type { Approval } from '../types';
import { useLiveStore } from '../store';
import { ApproveButton } from './ApproveButton';
import { Chip, ICON, useCardMotion } from './parts';
import type { Tone } from './parts';
import { clockText, plainError, roleName, toMs } from './format';
import { isReadOnlyPlayback, PLAYBACK_NOTICE } from './readOnly';
import './inbox.css';

type StatusKey = 'requested' | 'approved' | 'rejected' | 'auto' | 'expired' | 'unknown';

const STATUS: Record<StatusKey, { tone: Tone; word: string; Icon: typeof Clock }> = {
  requested: { tone: 'warn', word: 'Requested', Icon: Hourglass },
  approved: { tone: 'ok', word: 'Approved', Icon: CheckCircle2 },
  rejected: { tone: 'critical', word: 'Rejected', Icon: XCircle },
  auto: { tone: 'accent', word: 'Auto', Icon: Bot },
  expired: { tone: 'unknown', word: 'Expired', Icon: Ban },
  unknown: { tone: 'unknown', word: 'Unavailable', Icon: Ban },
};

function firstSentence(v: unknown): string {
  const t = typeof v === 'string' ? v.trim() : '';
  const m = t.match(/^.*?[.!?](?=\s|$)/);
  return m ? m[0] : t;
}

function cloneTest(value: unknown): { state: 'pass' | 'fail' | 'none'; detail: string } {
  if (typeof value === 'string') {
    const state = value.trim().toLowerCase();
    if (state === 'passed' || state === 'pass') return { state: 'pass', detail: value };
    if (state === 'failed' || state === 'fail' || state === 'refused') return { state: 'fail', detail: value };
    return { state: 'none', detail: value || 'Not verified' };
  }
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    const state = v.passed === true ? 'pass' : v.passed === false ? 'fail' : 'none';
    return { state, detail: typeof v.detail === 'string' ? v.detail : state === 'pass' ? 'Passed' : state === 'fail' ? 'Failed' : 'Not verified' };
  }
  return { state: 'none', detail: 'Not verified' };
}

export function ApprovalCard({ approval }: { approval: Approval }) {
  const motionProps = useCardMotion();
  const ts = useLiveStore((s) => s.ts);
  const source = useLiveStore((s) => s.source);
  const now = toMs(ts);
  const readOnly = source === 'replay' || isReadOnlyPlayback();
  const [form, setForm] = useState<'reject' | 'modify' | 'analysis' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');

  const expMs = toMs(approval.expires_at), reqMs = toMs((approval as Record<string, unknown>).requested_at);
  const left = expMs - now;
  let status = (approval.status === 'pending' ? 'requested' : approval.status in STATUS ? approval.status : 'unknown') as StatusKey;
  if (status === 'requested' && Number.isFinite(left) && left <= 0) status = 'expired';
  const S = STATUS[status];
  const open = status === 'requested';
  const title = typeof approval.title === 'string' ? approval.title : '';
  const ct = cloneTest(approval.clone_test);
  const total = Number.isFinite(reqMs) && Number.isFinite(expMs) && expMs > reqMs ? expMs - reqMs : NaN;
  const frac = Number.isFinite(left) && Number.isFinite(total) ? Math.min(1, Math.max(0, left / total)) : undefined;

  const submit = async () => {
    if (!form) return;
    if (isReadOnlyPlayback()) { setError(PLAYBACK_NOTICE); return; }
    if ((form === 'modify' || form === 'analysis') && !reason.trim()) { setError('Enter your request.'); return; }
    if ((form === 'modify' || form === 'analysis') && !approval.owner) { setError('The request has no owner.'); return; }
    setBusy(true); setError('');
    try {
      if (form === 'reject') await api.reject({ hash: approval.hash, reason: reason.trim() || 'Rejected by commander' });
      if (form === 'modify') await api.order({ to: approval.owner, text: `Review the requested ${approval.playbook} plan: ${reason.trim()}` });
      if (form === 'analysis') await api.ask({ to: approval.owner, question: reason.trim() });
      setSent(form === 'reject' ? 'Rejection sent.' : 'Request sent. Await the agent response.');
      setReason(''); setForm(null);
    }
    catch (err) { setError(plainError(err)); }
    finally { setBusy(false); }
  };

  const why = firstSentence(approval.reason);
  const heading = title || String(approval.playbook);
  const ruleChecks = Array.isArray(approval.verdicts) ? approval.verdicts.length : undefined;
  return (
    <motion.article className={`inbox-card inbox-approval inbox-approval--${status}`} {...motionProps} layout={false}>
      <header className="inbox-card__head">
        <div className="inbox-card__title">
          <h3 className="inbox-card__h" title={heading}>{heading}</h3>
          <span className="mono inbox-id">{approval.playbook}</span>
        </div>
        <div className="inbox-card__chips">
          <Chip tone={S.tone} icon={<S.Icon {...ICON} />}>{S.word}</Chip>
        </div>
      </header>
      <p className="inbox-why" title={String(approval.reason ?? '')}>{why}</p>
      <dl className="inbox-facts">
        <dt>Asked by</dt><dd title={roleName(approval.owner)}>{roleName(approval.owner)}</dd>
        <dt>Targets</dt><dd className="mono" title={(approval.targets ?? []).join(', ')}>{(approval.targets ?? []).join(', ') || 'none'}</dd>
        <dt>Clone test</dt>
        <dd className={`inbox-clone inbox-clone--${ct.state}`} title={ct.detail}>
          <FlaskConical {...ICON} />
          <strong>{ct.state === 'pass' ? 'Passed' : ct.state === 'fail' ? 'Failed' : 'Not verified'}</strong>
        </dd>
        {ct.detail !== 'Passed' && ct.detail !== 'Failed' && ct.detail !== 'Not verified' && <><dt>Test evidence</dt><dd>{ct.detail}</dd></>}
        {typeof approval.risk === 'string' && <><dt>Risk</dt><dd>{approval.risk}</dd></>}
        {ruleChecks !== undefined && <><dt>Rule checks</dt><dd>{ruleChecks} reported; see policy evidence for rule and record IDs.</dd></>}
      </dl>
      {open && (
        <div className="inbox-timer" role="timer" aria-label="Simulation time left to decide">
          <span className="mono inbox-timer__text"><Clock {...ICON} /> {Number.isFinite(left) ? `${clockText(left)} left` : 'Expiry unavailable'}</span>
          {frac !== undefined && <span className="inbox-timer__bar"><span style={{ transform: `scaleX(${frac})` }} /></span>}
        </div>
      )}
      {!open && approval.reject_reason != null && <p className="inbox-note">Reason: {String(approval.reject_reason)}</p>}
      {open && !form && (
        <div className="inbox-actions">
          <ApproveButton hash={approval.hash} />
          <button type="button" className="inbox-btn" disabled={readOnly} title={readOnly ? PLAYBACK_NOTICE : undefined} onClick={() => setForm('modify')}>Modify</button>
          <button type="button" className="inbox-btn" disabled={readOnly} title={readOnly ? PLAYBACK_NOTICE : undefined} onClick={() => setForm('reject')}>Reject</button>
          <button type="button" className="inbox-btn" disabled={readOnly} title={readOnly ? PLAYBACK_NOTICE : undefined} onClick={() => setForm('analysis')}>Request analysis</button>
        </div>
      )}
      {open && form && (
        <form className="inbox-reject" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          {form === 'modify' && <p className="inbox-note">The owner must propose a new plan; this does not change or approve the current one.</p>}
          <label className="inbox-field">{form === 'reject' ? 'Reason for rejection' : form === 'modify' ? 'Requested change' : 'Question for the owner'}
            <input autoFocus value={reason} maxLength={300} disabled={readOnly || busy} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setForm(null); }} />
          </label>
          <div className="inbox-actions">
            <button type="submit" className={`inbox-btn ${form === 'reject' ? 'inbox-btn--danger' : 'inbox-btn--primary'}`} disabled={busy || readOnly}>{busy ? 'Sending' : form === 'reject' ? 'Confirm rejection' : 'Send request'}</button>
            <button type="button" className="inbox-btn" onClick={() => { setForm(null); setReason(''); setError(''); }}>Cancel</button>
          </div>
          {error && <p className="inbox-error" role="alert">{error}</p>}
        </form>
      )}
      {sent && <p className="inbox-note" role="status">{sent}</p>}
    </motion.article>
  );
}
