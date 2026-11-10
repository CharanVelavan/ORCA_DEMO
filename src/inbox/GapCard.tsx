import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, FileSearch, XCircle } from 'lucide-react';
import { api } from '../api';
import { humanDecision, object, objects, recommendationText, recordIdsForGap, strings, text } from '../policy/data';
import { useLiveStore } from '../store';
import type { LiveEvent } from '../types';
import { Chip, ICON, useCardMotion } from './parts';
import './inbox.css';
import '../policy/gap-card.css';

type Decision = 'confirm' | 'reject';

export function GapCard({ gap, defaultExpanded = false }: { gap: LiveEvent; defaultExpanded?: boolean }) {
  const motionProps = useCardMotion();
  const gapId = text(gap.gap_id) ?? text(gap.id) ?? '';
  const liveGap = useLiveStore((state) => state.gaps.find((event) => event.audience !== 'control' && event.gap_id === gapId));
  const logged = useLiveStore((state) => [...state.raw].reverse().find((event) =>
    event.audience !== 'control' && event.kind === 'gap_human_decision' && (event.draft_id === gapId || event.gap_id === gapId)));
  const source = useLiveStore((state) => state.source);
  const info: Record<string, unknown> = liveGap ? { ...gap, ...liveGap } : gap;
  const [localDecision, setLocalDecision] = useState<Decision | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [pending, setPending] = useState<Decision | null>(null);
  const [error, setError] = useState('');
  const readonly = source === 'replay' || new URLSearchParams(window.location.search).get('fake') === '1';

  const recorded = humanDecision(text(object(info.decision).decision) ?? text(info.decision) ?? text(logged?.decision));
  const decided = localDecision ?? recorded;
  const title = text(info.title) ?? text(info.topic) ?? text(info.question) ?? 'Policy gap';
  const finding = text(info.finding) ?? text(info.explanation) ?? text(info.india);
  const findingExcerpt = finding && finding.length > 220 ? `${finding.slice(0, 220).replace(/\s+\S*$/, '')}…` : finding;
  const records = recordIdsForGap(info);
  const examples = objects(info.global_examples);
  const recommendation = recommendationText(info.recommendation);
  const regulator = strings(object(info.recommendation).regulator);
  const interim = object(info.interim_action);

  const submit = async (decision: Decision) => {
    if (pending) return;
    setError('');
    if (useLiveStore.getState().source === 'replay' || new URLSearchParams(window.location.search).get('fake') === '1') {
      setError('Decisions are unavailable during playback.');
      return;
    }
    if (!gapId) { setError('The gap identifier is unavailable.'); return; }
    setPending(decision);
    try {
      await api.gap({ gap_id: gapId, decision });
      setLocalDecision(decision);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The gap decision failed for an unknown reason.');
    } finally {
      setPending(null);
    }
  };

  const status = decided === 'confirm'
    ? <Chip tone="ok" icon={<CheckCircle2 {...ICON} />}>Commander confirmed</Chip>
    : decided === 'reject'
      ? <Chip tone="critical" icon={<XCircle {...ICON} />}>Commander rejected</Chip>
      : <Chip tone="healing" icon={<FileSearch {...ICON} />}>{text(info.status) ? `Register: ${text(info.status)}` : 'Candidate'}</Chip>;

  if (gap.audience === 'control') return null;

  return (
    <motion.article className="inbox-card inbox-gap" {...motionProps} layout={false}>
      <button type="button" className="inbox-gap__line" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
        <span className="mono inbox-id inbox-gap__id" title={gapId}>{gapId || 'Id unavailable'}</span>
        <span className="inbox-gap__topic" title={title}>{title}</span>
        {status}
        <ChevronDown {...ICON} className="inbox-gap__chev" />
      </button>
      {expanded && (
        <div className="gap-detail">
          {finding && <>
            <p className="inbox-body">{findingExcerpt}</p>
            {findingExcerpt !== finding && <details className="gap-detail__finding">
              <summary>Read complete finding</summary>
              <p className="inbox-body">{finding}</p>
            </details>}
          </>}
          <div>
            <strong className="gap-detail__label">Cited records</strong>
            <div className="inbox-records">
              {records.length ? records.map((record) => <span key={record} className="mono inbox-record" title={record}>{record}</span>) : <span className="inbox-note">{gap.source === 'candidate' || gap.status === 'candidate' ? 'No record ids are attached to this candidate yet.' : 'Record ids unavailable.'}</span>}
            </div>
          </div>
          {examples.length > 0 && (
            <div>
              <strong className="gap-detail__label">Global examples</strong>
              <ul className="gap-detail__examples">
                {examples.map((example, index) => {
                  const id = text(example.record) ?? text(example.staged);
                  return (
                    <li key={`${id ?? 'example'}-${index}`}>
                      <strong>{text(example.jurisdiction) ?? 'Jurisdiction unavailable'}</strong>
                      {' / '}{text(example.instrument) ?? 'Instrument unavailable'}
                      {text(example.clause) && <> / {text(example.clause)}</>}
                      <span className="inbox-note"> {text(example.tier) ?? 'Tier unavailable'}{text(example.binding_status) ? ` / ${text(example.binding_status)}` : ''}{id ? ` / ${id}` : ''}</span>
                      {text(example.shows) && <div className="inbox-note">{text(example.shows)}</div>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {recommendation && <p className="inbox-body"><strong>KB recommendation for human review:</strong> {recommendation}{regulator.length ? ` (${regulator.join(', ')})` : ''}</p>}
          {text(interim.action) && <p className="inbox-body inbox-body--muted"><strong>Interim action:</strong> {text(interim.action)}</p>}
          {readonly && decided && <p className="inbox-note">Playback is read-only. Gap decisions require a live session.</p>}
          {!decided && (
            <div className="gap-detail__decision">
              {readonly && <p className="inbox-note">Playback is read-only. Gap decisions require a live session.</p>}
              {!readonly && <p className="inbox-note">Confirm or reject this candidate after reviewing the evidence.</p>}
              <div className="inbox-actions">
                <button className="inbox-btn inbox-btn--primary" type="button" disabled={readonly || Boolean(pending)} onClick={() => void submit('confirm')}>
                  {pending === 'confirm' ? 'Confirming' : 'Confirm gap'}
                </button>
                <button className="inbox-btn" type="button" disabled={readonly || Boolean(pending)} onClick={() => void submit('reject')}>
                  {pending === 'reject' ? 'Rejecting' : 'Reject gap'}
                </button>
              </div>
              {error && <p className="inbox-error" role="alert">{error}</p>}
            </div>
          )}
        </div>
      )}
    </motion.article>
  );
}
