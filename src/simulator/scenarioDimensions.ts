/** Reviewed project mappings, not official scores or observed-run results. */
export const DIMENSIONS = {
  D3: 'Cross-domain evidence', D4: 'Contextualisation', D6: 'Human interface',
  D7: 'Role objectives', D8: 'Collaboration with AI', D9: 'Human decisions',
  D10: 'AI and policies', D11: 'Emergency-service protection', D13: 'Digital infrastructure',
} as const;
export type Dimension = keyof typeof DIMENSIONS;
const all = Object.keys(DIMENSIONS) as Dimension[];
const reasons: Record<string, string> = {
  S0: 'Routine telemetry, weather and domestic routing establish the baseline. No manual intervention or recovery is planned, so D6, D8, D9 and D11 are excluded.',
  S1: 'A ground-management intrusion crosses telecom, hospital, emergency and payment services. Owner coordination, human sequencing, cited duties and guarded recovery exercise the full planned chain.',
  S2: 'Weather, power and service evidence inform human priorities and constrained-capacity recovery for emergency, hospital and grid traffic.',
  S3: 'Jamming evidence and unsafe route offers require human review, domestic-path verification and protection of emergency communications.',
  N1: 'Hospital and emergency traffic depend on site power. Forecasts, human priorities, warnings and authorised backup recovery link the nine capabilities.',
  N2: 'Routing and transaction evidence support a merchant advisory and approved domestic failover. Payment availability alone does not establish inclusion, so D11 is excluded.',
  N3: 'A feeder-link audit combines configuration and traffic evidence, model abstention, policy-gap analysis and approved migration. No service-priority or inclusion outcome is scripted, so D11 is excluded.',
  N4: 'Independent emergency-service evidence challenges false management telemetry. Human resolution of conflicting reports, containment, failover and warnings exercise the planned chain.',
  N5: 'A telecom/grid incident affects emergency routing. Separate reporting triggers, human clock review, warnings and authorised recovery connect the nine capabilities.',
  CAP: 'Concurrent weather, intrusion, power and capacity constraints require human triage of emergency, hospital and grid services, unsafe-route rejection and coordinated recovery.',
};
export function scenarioDimensions(id: string) {
  const key = id.toUpperCase();
  if (!Object.hasOwn(reasons, key)) return null;
  const excluded: Dimension[] = key === 'S0' ? ['D6', 'D8', 'D9', 'D11'] : ['N2', 'N3'].includes(key) ? ['D11'] : [];
  const dimensions = all.filter(dimension => !excluded.includes(dimension));
  return { dimensions, count: dimensions.length, total: all.length, reason: reasons[key] };
}
