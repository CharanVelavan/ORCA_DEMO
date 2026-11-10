import { Bug, CloudRain, FilePen, MapPinOff, PhoneIncoming, RadioTower, Satellite, ServerOff, ShieldAlert, Shuffle, TrendingUp, ZapOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type InjectorCategory = 'attack' | 'fault' | 'benign';
export type InjectorInfo = { id: string; label: string; default_target: string; category: InjectorCategory };

/** Local copy of orca/live/inject.py INJECTORS, used when the API is unreachable. */
export const FALLBACK_INJECTORS: InjectorInfo[] = [
  { id: 'mgmt_intrusion', label: 'KA-SAT style management intrusion', default_target: 'noc-vendor-7', category: 'attack' },
  { id: 'jamming', label: 'Jam the satellite uplink', default_target: 'CHN-02', category: 'attack' },
  { id: 'failover_lure', label: 'Lure failover to a foreign gateway', default_target: 'CHN-02', category: 'attack' },
  { id: 'gnss_spoof', label: 'GNSS spoofing (timing)', default_target: 'CHN-03', category: 'attack' },
  { id: 'ss7_abuse', label: 'SS7 location tracking', default_target: 'CHN-04', category: 'attack' },
  { id: 'telemetry_edit', label: 'Fake all-green telemetry', default_target: 'SAT-MGMT', category: 'attack' },
  { id: 'firmware_exploit', label: 'Exploit old terminal firmware', default_target: 'CHN-01', category: 'attack' },
  { id: 'feeder_intercept', label: 'Intercept unencrypted feeder link', default_target: 'GW-IN-1', category: 'attack' },
  { id: 'rain', label: 'Monsoon rain cell', default_target: 'CHN-01', category: 'fault' },
  { id: 'power_cut', label: 'Grid power cut', default_target: 'CHN-05', category: 'fault' },
  { id: 'gateway_power', label: 'Gateway outage', default_target: 'GW-IN-1', category: 'fault' },
  { id: 'surge', label: 'Festival traffic surge', default_target: 'CHN-01', category: 'benign' },
];

export const INJECTOR_ICONS: Record<string, LucideIcon> = {
  mgmt_intrusion: ShieldAlert, jamming: RadioTower, failover_lure: Shuffle, gnss_spoof: MapPinOff,
  ss7_abuse: PhoneIncoming, telemetry_edit: FilePen, firmware_exploit: Bug, feeder_intercept: Satellite,
  rain: CloudRain, power_cut: ZapOff, gateway_power: ServerOff, surge: TrendingUp,
};

export const CATEGORY_LABEL: Record<InjectorCategory, string> = { attack: 'Attack', fault: 'Fault', benign: 'Benign' };
export const CATEGORY_ORDER: InjectorCategory[] = ['attack', 'fault', 'benign'];

export const FALLBACK_TARGETS = ['CHN-01', 'CHN-02', 'CHN-03', 'CHN-04', 'CHN-05', 'CHN-06', 'GW-IN-1', 'GW-IN-2', 'GW-XX', 'SAT-MGMT', 'noc-vendor-7'];

export function groupInjectors(list: InjectorInfo[]): { category: InjectorCategory; items: InjectorInfo[] }[] {
  return CATEGORY_ORDER.map((category) => ({ category, items: list.filter((i) => i.category === category) })).filter((g) => g.items.length > 0);
}
