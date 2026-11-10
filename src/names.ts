// Plain names for scenarios (user decision, 9 Nov). Engine ids stay the same; only what people read changes.
export const SCENARIO_NAME: Record<string, string> = {
  S0: 'Normal day',
  S1: 'Satellite operator hacked',
  S2: 'Storm cuts capacity',
  S3: 'Jamming and an unsafe backup',
  N1: 'Hospital site loses power',
  N2: 'Payment outage, no warning',
  N3: 'Weak feeder link found',
  N4: 'Network dashboard faked',
  N5: 'One incident, many deadlines',
  CAP: 'Storm and cyber attack together',
};
export const scenarioName = (id?: unknown, fallback = ''): string => SCENARIO_NAME[String(id ?? '').toUpperCase()] ?? (fallback || String(id ?? ''));
