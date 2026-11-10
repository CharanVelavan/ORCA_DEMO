// Shared contract for the Pipeline Flow. Owner: lead. Data files (pipelineNodes.ts, scenarioPaths.ts)
// are typed against this file and must not redefine these types.

export type BandId = 'network' | 'threat' | 'detect' | 'coordinate' | 'commander' | 'execute' | 'gaps';

export type NodeKind =
  | 'satellite' | 'mgmt' | 'gateway' | 'site'      // band 1
  | 'threat'                                        // band 2
  | 'model'                                         // band 3
  | 'agent'                                         // band 4
  | 'rules' | 'clocks' | 'human'                    // band 5
  | 'step'                                          // band 6
  | 'gap';                                          // band 7

/** Lucide icon names used by the Pipeline (PascalCase, as exported by lucide-react). */
export type IconName =
  | 'Satellite' | 'Server' | 'RadioTower' | 'Lock' | 'Building2' | 'Hospital' | 'CreditCard' | 'Phone' | 'Zap'
  | 'Waves' | 'TrafficCone' | 'KeyRound' | 'RadioReceiver' | 'Shuffle' | 'MapPinOff' | 'PhoneForwarded'
  | 'FileWarning' | 'Cpu' | 'Cable' | 'CloudRain' | 'PlugZap' | 'ServerOff' | 'Users' | 'HelpCircle'
  | 'Activity' | 'TrendingDown' | 'Brain' | 'ListOrdered' | 'Smartphone' | 'Orbit' | 'Bolt' | 'ShieldAlert'
  | 'Landmark' | 'Scale' | 'Gavel' | 'Timer' | 'UserCheck' | 'FlaskConical' | 'Gauge' | 'Route' | 'GitBranch'
  | 'ShieldCheck' | 'Undo2' | 'HeartPulse' | 'FileSearch' | 'Globe' | 'Lightbulb' | 'Network' | 'Eye'
  | 'Users2' | 'BadgeCheck';

export type ThreatGroup = 'attack' | 'fault' | 'benign';

export type NodeDef = {
  /** Stable id. Conventions:
   *  band 1: 'sat', 'mgmt', 'gw:GW-IN-1', 'gw:GW-IN-2', 'gw:GW-XX', 'site:CHN-01' .. 'site:CHN-06'
   *  band 2: 'threat:<injector id>' for the 12 injectors in orca/live/inject.py, plus 'threat:anomaly' (Console variant)
   *  band 3: 'model:M1' .. 'model:M4'
   *  band 4: 'agent:<role>' for mobile_operator, satellite_operator, power_utility, cert_in, regulator, gap_analyst
   *  band 5: 'rules', 'clocks', 'human'
   *  band 6: 'exec:clone', 'exec:r5', 'exec:r25', 'exec:r100', 'exec:cleanpath', 'exec:failover', 'exec:reattack',
   *          'exec:rollback', 'exec:return'
   *  band 7: 'gap:GAP-IN-01' .. 'gap:GAP-IN-09' (engine gap ids are matched by this 10-char prefix)
   */
  id: string;
  band: BandId;
  kind: NodeKind;
  /** Short display name, at most 18 characters. */
  label: string;
  /** Mono role line, at most 26 characters, e.g. 'Chennai primary' or 'Isolation Forest'. */
  role: string;
  icon: IconName;
  /** Band 2 only. */
  group?: ThreatGroup;
  /** Engine identifiers this node answers to (site id, model id, role ids, injector id, gap prefix). */
  refs: string[];
  /** Band 1 sites only: which everyday service the site carries. */
  service?: string;
  /** Visible only to ground-truth views (Stage, Control, Review). True for all band 2 threat chips except 'threat:anomaly'. */
  truthOnly?: boolean;
  /** 'threat:anomaly' only: shown only on the Console. */
  consoleOnly?: boolean;
};

export type BandDef = { id: BandId; n: 1 | 2 | 3 | 4 | 5 | 6 | 7; title: string; subtitle: string; icon: IconName };

/** One narration step. `node` must be an id from pipelineNodes.ts. */
export type PathStep = { node: string; title: string; text: string };

export type ScenarioKind = 'normal' | 'attack' | 'fault' | 'audit' | 'mixed';

export type ScenarioPath = {
  /** Scenario id exactly as in scenarios/*.yaml `id:` (S0, S1, S2, S3, N1..N5, CAP). */
  id: string;
  title: string;
  kind: ScenarioKind;
  m3Expected: string;
  sites: string[];
  story: string;
  /** Node ids on this scenario's path, used for the faint "on path" outline. */
  path: string[];
  /** Ordered narration steps (8-14 per scenario), taken from the YAML events and plan section 6. */
  steps: PathStep[];
};
