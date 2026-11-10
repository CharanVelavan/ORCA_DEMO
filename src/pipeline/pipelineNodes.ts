// Pipeline Flow node and band data. Typed against model.ts (the contract); do not redefine its types here.
// Ids follow the conventions in model.ts. Emulated network only: every link shown here is simulated.
import type { BandDef, NodeDef } from './model';

export const BANDS: BandDef[] = [
  { id: 'network', n: 1, title: 'Network', subtitle: 'Normal operation, emulated', icon: 'Satellite' },
  { id: 'threat', n: 2, title: 'Threat', subtitle: 'Scripted attacks and faults', icon: 'ShieldAlert' },
  { id: 'detect', n: 3, title: 'Detect', subtitle: 'ML models watching the links', icon: 'Brain' },
  { id: 'coordinate', n: 4, title: 'Coordinate', subtitle: 'Six agents exchange packets', icon: 'Users2' },
  { id: 'commander', n: 5, title: 'Commander', subtitle: 'Code decides, human approves', icon: 'Scale' },
  { id: 'execute', n: 6, title: 'Execute & heal', subtitle: 'Agents apply the approved fix', icon: 'Route' },
  { id: 'gaps', n: 7, title: 'Policy gaps', subtitle: 'Found in sources, not assumed', icon: 'FileWarning' },
];

export const NODES: NodeDef[] = [
  // Band 1 - network
  { id: 'sat', band: 'network', kind: 'satellite', label: 'GEO satellite', role: 'Ku-band, emulated', icon: 'Satellite', refs: [] },
  { id: 'mgmt', band: 'network', kind: 'mgmt', label: 'Ground management network', role: 'Operator management network', icon: 'Server', refs: ['SAT-MGMT'] },
  { id: 'gw:GW-IN-1', band: 'network', kind: 'gateway', label: 'Main ground station', role: 'GW-IN-1, Chennai', icon: 'RadioTower', refs: ['GW-IN-1'] },
  { id: 'gw:GW-IN-2', band: 'network', kind: 'gateway', label: 'Backup ground station', role: 'GW-IN-2, Bengaluru', icon: 'RadioTower', refs: ['GW-IN-2'] },
  { id: 'gw:GW-XX', band: 'network', kind: 'gateway', label: 'Foreign ground station', role: 'GW-XX, blocked, never used', icon: 'Lock', refs: ['GW-XX'] },
  { id: 'site:CHN-01', band: 'network', kind: 'site', label: 'Park Town', role: 'CHN-01 hospital corridor', icon: 'Hospital', refs: ['CHN-01'], service: 'hospital, 112' },
  { id: 'site:CHN-02', band: 'network', kind: 'site', label: 'T. Nagar', role: 'CHN-02 shops, UPI, ATMs', icon: 'CreditCard', refs: ['CHN-02'], service: 'payments, 112' },
  { id: 'site:CHN-03', band: 'network', kind: 'site', label: 'Adyar', role: 'CHN-03 homes, 112', icon: 'Phone', refs: ['CHN-03'], service: '112' },
  { id: 'site:CHN-04', band: 'network', kind: 'site', label: 'Guindy', role: 'CHN-04 grid comms', icon: 'Zap', refs: ['CHN-04'], service: 'grid, 112' },
  { id: 'site:CHN-05', band: 'network', kind: 'site', label: 'Ennore', role: 'CHN-05 coastal, cyclone', icon: 'Waves', refs: ['CHN-05'], service: 'alerts, 112' },
  { id: 'site:CHN-06', band: 'network', kind: 'site', label: 'OMR', role: 'CHN-06 offices, signals', icon: 'TrafficCone', refs: ['CHN-06'], service: 'traffic signals, 112' },

  // Band 2 - threat (truth views only, except the console anomaly chip)
  { id: 'threat:mgmt_intrusion', band: 'threat', kind: 'threat', label: 'Control centre break-in', role: 'KA-SAT style, attack', icon: 'ShieldAlert', group: 'attack', refs: ['mgmt_intrusion'], truthOnly: true },
  { id: 'threat:jamming', band: 'threat', kind: 'threat', label: 'Uplink jamming', role: 'Uplink jammed, attack', icon: 'Waves', group: 'attack', refs: ['jamming'], truthOnly: true },
  { id: 'threat:failover_lure', band: 'threat', kind: 'threat', label: 'Fake backup route', role: 'Foreign gateway bait', icon: 'Shuffle', group: 'attack', refs: ['failover_lure'], truthOnly: true },
  { id: 'threat:gnss_spoof', band: 'threat', kind: 'threat', label: 'GPS timing spoofed', role: 'Timing spoofed, attack', icon: 'MapPinOff', group: 'attack', refs: ['gnss_spoof'], truthOnly: true },
  { id: 'threat:ss7_abuse', band: 'threat', kind: 'threat', label: 'Phone location tracking', role: 'Signalling abuse, attack', icon: 'PhoneForwarded', group: 'attack', refs: ['ss7_abuse'], truthOnly: true },
  { id: 'threat:telemetry_edit', band: 'threat', kind: 'threat', label: 'Faked dashboard data', role: 'All-green lie, attack', icon: 'FileWarning', group: 'attack', refs: ['telemetry_edit'], truthOnly: true },
  { id: 'threat:firmware_exploit', band: 'threat', kind: 'threat', label: 'Old terminal software', role: 'Old terminal firmware', icon: 'Cpu', group: 'attack', refs: ['firmware_exploit'], truthOnly: true },
  { id: 'threat:feeder_intercept', band: 'threat', kind: 'threat', label: 'Feeder link tapped', role: 'Unencrypted feeder link', icon: 'Cable', group: 'attack', refs: ['feeder_intercept'], truthOnly: true },
  { id: 'threat:rain', band: 'threat', kind: 'threat', label: 'Heavy rain', role: 'Rain fade, fault', icon: 'CloudRain', group: 'fault', refs: ['rain'], truthOnly: true },
  { id: 'threat:power_cut', band: 'threat', kind: 'threat', label: 'Power cut', role: 'Mains lost, fault', icon: 'PlugZap', group: 'fault', refs: ['power_cut'], truthOnly: true },
  { id: 'threat:gateway_power', band: 'threat', kind: 'threat', label: 'Gateway outage', role: 'Gateway down, fault', icon: 'ServerOff', group: 'fault', refs: ['gateway_power'], truthOnly: true },
  { id: 'threat:surge', band: 'threat', kind: 'threat', label: 'Festival surge', role: 'Traffic spike, benign', icon: 'Users', group: 'benign', refs: ['surge'], truthOnly: true },
  { id: 'threat:anomaly', band: 'threat', kind: 'threat', label: 'Anomaly observed', role: 'Cause not yet known', icon: 'Eye', refs: [], consoleOnly: true },

  // Band 3 - detect
  { id: 'model:M1', band: 'detect', kind: 'model', label: 'Anomaly detector', role: 'Spots unusual link behaviour', icon: 'Activity', refs: ['M1'] },
  { id: 'model:M2', band: 'detect', kind: 'model', label: 'Failure forecaster', role: 'Predicts link or battery failure', icon: 'TrendingDown', refs: ['M2'] },
  { id: 'model:M3', band: 'detect', kind: 'model', label: 'Attack classifier', role: 'Decides: fault or cyber attack', icon: 'Brain', refs: ['M3'] },
  { id: 'model:M4', band: 'detect', kind: 'model', label: 'Capacity planner', role: 'Configured priority allocation', icon: 'Gauge', refs: ['M4'] },

  // Band 4 - coordinate
  { id: 'agent:mobile_operator', band: 'coordinate', kind: 'agent', label: 'Mobile network agent', role: 'Runs the cell sites', icon: 'Smartphone', refs: ['mobile_operator'] },
  { id: 'agent:satellite_operator', band: 'coordinate', kind: 'agent', label: 'Satellite link agent', role: 'Runs the satellite backhaul', icon: 'Orbit', refs: ['satellite_operator'] },
  { id: 'agent:power_utility', band: 'coordinate', kind: 'agent', label: 'Power grid agent', role: 'Reports mains and battery', icon: 'Bolt', refs: ['power_utility'] },
  { id: 'agent:cert_in', band: 'coordinate', kind: 'agent', label: 'Cyber response agent', role: 'National CERT (CERT-In)', icon: 'ShieldCheck', refs: ['cert_in'] },
  { id: 'agent:regulator', band: 'coordinate', kind: 'agent', label: 'Regulator agent', role: 'Telecom regulator (DoT, TRAI)', icon: 'Gavel', refs: ['regulator'] },
  { id: 'agent:gap_analyst', band: 'coordinate', kind: 'agent', label: 'Gap analyst agent', role: 'Documents candidate policy gaps', icon: 'FileSearch', refs: ['gap_analyst', 'policy_adviser'] },

  { id: 'agent:policy_adviser', band: 'coordinate', kind: 'agent', label: 'Policy adviser agent', role: 'Explains applicable records', icon: 'FileSearch', refs: ['policy_adviser'] },

  // Band 5 - commander
  { id: 'rules', band: 'commander', kind: 'rules', label: 'Rule engine', role: 'Evaluates the active KB in code', icon: 'Scale', refs: ['verdict'] },
  { id: 'clocks', band: 'commander', kind: 'clocks', label: 'Deadlines', role: 'Legal reporting clocks', icon: 'Timer', refs: ['clock_obligation'] },
  { id: 'human', band: 'commander', kind: 'human', label: 'Incident commander', role: 'Reviews and confirms scoped plans', icon: 'UserCheck', refs: ['approval'] },

  // Band 6 - execute and heal
  { id: 'exec:clone', band: 'execute', kind: 'step', label: 'Clone test', role: 'Cloned sandbox', icon: 'FlaskConical', refs: ['exec:clone'] },
  { id: 'exec:r5', band: 'execute', kind: 'step', label: 'Stage 5%', role: 'First guarded rollout stage', icon: 'Gauge', refs: ['exec:r5'] },
  { id: 'exec:r25', band: 'execute', kind: 'step', label: 'Stage 25%', role: 'Second guarded rollout stage', icon: 'Gauge', refs: ['exec:r25'] },
  { id: 'exec:r100', band: 'execute', kind: 'step', label: 'Stage 100%', role: 'Final guarded rollout stage', icon: 'Gauge', refs: ['exec:r100'] },
  { id: 'exec:cleanpath', band: 'execute', kind: 'step', label: 'Clean-path check', role: 'Verified path only', icon: 'ShieldCheck', refs: ['exec:cleanpath'] },
  { id: 'exec:failover', band: 'execute', kind: 'step', label: 'Failover', role: 'Domestic path only', icon: 'Route', refs: ['exec:failover'] },
  { id: 'exec:reattack', band: 'execute', kind: 'step', label: 'Re-attack check', role: 'Attack blocked', icon: 'BadgeCheck', refs: ['exec:reattack'] },
  { id: 'exec:rollback', band: 'execute', kind: 'step', label: 'Auto-rollback', role: 'Only on failure', icon: 'Undo2', refs: ['exec:rollback'] },
  { id: 'exec:return', band: 'execute', kind: 'step', label: 'Return to normal', role: 'Back to normal', icon: 'HeartPulse', refs: ['exec:return'] },

  // Band 7 - policy gaps (India knowledge base; titles in kb/gaps/india.yaml)
  { id: 'gap:GAP-IN-01', band: 'gaps', kind: 'gap', label: 'Four reports', role: 'India gap 01', icon: 'Timer', refs: ['GAP-IN-01'] },
  { id: 'gap:GAP-IN-02', band: 'gaps', kind: 'gap', label: 'Warning-duty coverage', role: 'India gap 02', icon: 'Users2', refs: ['GAP-IN-02'] },
  { id: 'gap:GAP-IN-03', band: 'gaps', kind: 'gap', label: 'Priority-order coverage', role: 'India gap 03', icon: 'ListOrdered', refs: ['GAP-IN-03'] },
  { id: 'gap:GAP-IN-04', band: 'gaps', kind: 'gap', label: 'Battery-reserve coverage', role: 'India gap 04', icon: 'Bolt', refs: ['GAP-IN-04'] },
  { id: 'gap:GAP-IN-05', band: 'gaps', kind: 'gap', label: 'Breach clock 2027', role: 'India gap 05', icon: 'Gavel', refs: ['GAP-IN-05'] },
  { id: 'gap:GAP-IN-06', band: 'gaps', kind: 'gap', label: 'Feeder link std', role: 'India gap 06', icon: 'Cable', refs: ['GAP-IN-06'] },
  { id: 'gap:GAP-IN-07', band: 'gaps', kind: 'gap', label: 'Joint-lead coverage', role: 'India gap 07', icon: 'Users', refs: ['GAP-IN-07'] },
  { id: 'gap:GAP-IN-08', band: 'gaps', kind: 'gap', label: 'Path-check coverage', role: 'India gap 08', icon: 'Route', refs: ['GAP-IN-08'] },
  { id: 'gap:GAP-IN-09', band: 'gaps', kind: 'gap', label: 'Space-baseline coverage', role: 'India gap 09', icon: 'FileSearch', refs: ['GAP-IN-09'] },
];
