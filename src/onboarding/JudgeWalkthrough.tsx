import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, X } from 'lucide-react';
import { useDerived } from '../derive';
import { useLiveStore } from '../store';
import { simClockIST } from '../shell/ContextStrip';
import { checkpointKey, judgeCheckpoints, reviewProofPresent } from './judgeEvidence';
import { useJudgeReview } from './judgeStore';
import './judge-walkthrough.css';

export function JudgeWalkthrough() {
  const d = useDerived();
  const source = useLiveStore(state => state.source);
  const session = useLiveStore(state => state.session);
  const review = useJudgeReview();
  const { search } = useLocation();
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  useEffect(() => { review.bind(session, source + search); }, [session,source,search,review.bind]);
  const bound = review.session === session && review.source === source + search;
  const checkpoints = judgeCheckpoints(d);
  const reviewed = checkpoints.filter(checkpoint => bound && reviewProofPresent(review.reviewed[checkpoint.id], d, checkpoint.id)).length;
  const ready = checkpoints.filter(checkpoint => checkpoint.evidence).length;
  const close = () => { dialog.current?.close(); launcher.current?.focus(); };
  const label = new URLSearchParams(search).get('fake') === '1' ? 'Fixture' : source === 'replay' ? 'Recorded replay' : session.llm === 'local' ? 'Live endpoint' : session.llm === 'mock' ? 'Mock simulation' : 'Source unavailable';
  return <><button ref={launcher} type="button" className="sh-btn sh-btn--sm judge-launch" aria-label="Judge walkthrough" title="Judge walkthrough" onClick={() => dialog.current?.showModal()}><ClipboardCheck size={14} /><span className="judge-launch__label">Judge walkthrough</span><span>{reviewed}/6</span></button><dialog ref={dialog} className="judge-dialog" aria-labelledby="judge-title" onCancel={event => { event.preventDefault(); close(); }}><header><div><span>SHORT JUDGE WALKTHROUGH</span><h2 id="judge-title">Six evidence checkpoints</h2></div><button type="button" aria-label="Close judge walkthrough" onClick={close}><X size={19} /></button></header><p className="judge-intro">Use S1 for the full response path. Inspect each available checkpoint, then mark it reviewed. View links only navigate; exercise actions stay manual.</p><div className="judge-run"><strong>{String(session.scenario ?? 'No current scenario')}</strong><span>{label}</span><span>{d.ts ? `${simClockIST(d.ts)} IST` : 'Clock unavailable'}</span></div><ol>{checkpoints.map((checkpoint,index) => { const key = checkpointKey(checkpoint); const done = Boolean(bound && reviewProofPresent(review.reviewed[checkpoint.id], d, checkpoint.id)); return <li key={checkpoint.id} data-state={done ? 'reviewed' : checkpoint.evidence ? 'ready' : 'waiting'}><div className="judge-step-icon">{done ? <CheckCircle2 size={18} /> : <span>{index+1}</span>}</div><div><h3>{checkpoint.title}</h3><p>{checkpoint.instruction}</p><small>{checkpoint.detail}{checkpoint.evidence ? ` · event #${checkpoint.evidence.seq} · ${simClockIST(checkpoint.evidence.ts)} IST` : ''}</small><div className="judge-step-actions"><Link className="sh-btn sh-btn--sm" to={`${checkpoint.route}${search}`} onClick={() => { review.setFocus(checkpoint.tab ?? null); dialog.current?.close(); }}>Inspect evidence</Link><button type="button" className="sh-btn sh-btn--sm" disabled={!checkpoint.evidence || !bound} aria-pressed={done} onClick={() => review.mark(checkpoint.id,key)}>{done ? 'Reviewed' : checkpoint.evidence ? 'Mark reviewed' : 'Awaiting evidence'}</button></div></div></li>; })}</ol><section className="judge-summary" aria-live="polite"><ClipboardCheck size={21} /><div><h3>{reviewed === 6 ? 'Walkthrough review complete' : `${reviewed} of 6 checkpoints reviewed`}</h3><p>{ready} have recorded evidence; {6-ready} await evidence. Completion tracks your review. Recovery and policy outcomes remain as recorded.</p>{ready < 6 && <small>Some scenarios and model runs may not produce every checkpoint.</small>}</div></section><footer><button type="button" className="sh-btn sh-btn--sm" onClick={review.reset}>Reset review marks</button><button type="button" className="sh-btn sh-btn--sm sh-btn--primary" onClick={close}>Return to exercise</button></footer></dialog></>;
}
