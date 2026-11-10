import { isControlEntry, type AuditEntry } from './audit';
import type { AuditChain, LiveEvent } from '../types';

const GROUPS = {
  facts: ['alert', 'tick', 'impact', 'event_released', 'net_state', 'posture'],
  models: ['model'],
  verdicts: ['verdict', 'gap'],
  duties: ['clock_obligation'],
  approvals: ['approval', 'approval_requested', 'approved', 'rejected'],
  execution: ['execute', 'executed', 'execute_refused', 'patch_stage', 'rollback', 'rolled_back', 'heal', 'reattack'],
  outcomes: ['summary'],
} as const;
type Group = keyof typeof GROUPS;
const groups = Object.keys(GROUPS) as Group[];
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : null;
const timeInIst = (date: Date) => `${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium', hour12: false }).format(date)} IST`;

/** One recording is the scope; no inference that it contains one incident. */
export function buildEvidencePackage(input: {
  file: string; events: LiveEvent[]; entries: AuditEntry[]; source: 'stream' | 'audit' | null;
  chain?: AuditChain | null; omittedControl?: number; generatedAt?: Date;
}) {
  const events = input.events.filter(event => event && typeof event === 'object' && !Array.isArray(event) && !isControlEntry(event));
  const entries = input.entries.filter(entry => !isControlEntry(entry.raw));
  const meta = entries.find(entry => entry.kind === 'run_meta')?.payload;
  const session = events.find(event => event.kind === 'session');
  const scenario = text(meta?.scenario) ?? text(session?.scenario);
  const incidentIds = [...new Set([...events.map(event => text(event.incident_id)), ...entries.map(entry => text(entry.payload.incident_id))].filter((id): id is string => id !== null))];
  const timestamps = [...events.map(event => text(event.ts)), ...entries.map(entry => text(entry.ts))]
    .filter((value): value is string => value !== null && Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const grouped = Object.fromEntries(groups.map(group => [group, events.filter(event =>
    (GROUPS[group] as readonly string[]).includes(event.kind))])) as Record<Group, LiveEvent[]>;
  const auditCoverage = (group: Group) => entries.some(entry => (GROUPS[group] as readonly string[]).includes(entry.kind));
  const missing = groups.filter(group => grouped[group].length === 0 && !auditCoverage(group));
  return {
    format: 'orca-recording-evidence-v1',
    generated_at: timeInIst(input.generatedAt ?? new Date()),
    scope: { recording: input.file, scenario, incident_id: null, recorded_incident_ids: incidentIds,
      description: 'Entire selected recording; it may contain multiple conditions or incidents. No incident boundaries were inferred.',
      filters: 'Ignores the Audit view filters and replay playhead.',
      first_public_timestamp: timestamps[0] ?? null, last_public_timestamp: timestamps.at(-1) ?? null },
    provenance: { replay_source: input.source, replay_events: input.source === 'stream' ? 'Public stream events returned by the server.' : input.source === 'audit' ? 'Public events reconstructed by the server from audit entries.' : 'Replay source unavailable.',
      audit_entries: 'Public audit entries returned for the selected recording.',
      original_chain_status: input.chain ?? null,
      original_chain_status_scope: 'Server status applies only to the original recording, not to this package.',
      integrity_limit: 'This selected, control-withheld package cannot verify the original hash chain.',
      audit_control_entries_withheld: input.omittedControl ?? null,
      redaction_limit: 'Known exercise-control and truth entries are withheld. This is not comprehensive secret or personal-data redaction; review before sharing.' },
    missing_evidence: missing.map(group => `No ${group} evidence was present in the public recording.`),
    evidence: grouped,
    public_audit_entries: entries.map(entry => entry.raw),
  };
}
