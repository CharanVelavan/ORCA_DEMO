import { Satellite, RadioTower, ShieldCheck, HeartPulse, Landmark, PlugZap, PhoneCall, Wifi } from 'lucide-react';

export function NetworkMark() {
  return <div className="learn-network-mark" role="img" aria-label="Illustration: emulated satellite backhaul connects through an operator ground network to everyday services, with cyber checks around recovery.">
    <div className="learn-network-mark__top"><span>NON-TERRESTRIAL NETWORKS</span><span>Emulated / Chennai</span></div>
    <div className="learn-network-mark__diagram" aria-hidden="true">
      <svg viewBox="0 0 520 520"><ellipse cx="260" cy="250" rx="218" ry="120" transform="rotate(-25 260 250)" /><ellipse cx="260" cy="250" rx="218" ry="120" transform="rotate(25 260 250)" /><path d="M260 82 V250 M260 250 L100 405 M260 250 L180 435 M260 250 L260 448 M260 250 L340 435 M260 250 L420 405" /></svg>
      <div className="learn-network-mark__satellite"><Satellite size={44} strokeWidth={1.1} /><small>Emulated NTN</small></div>
      <div className="learn-network-mark__gateway"><RadioTower size={50} strokeWidth={1.1} /><span>Operator<br />ground network</span><ShieldCheck size={22} strokeWidth={1.5} /></div>
      <div className="learn-network-mark__services">{[[PhoneCall, '112'], [HeartPulse, 'Hospital'], [Landmark, 'Payments'], [PlugZap, 'Grid'], [Wifi, 'Everyday']].map(([Icon, label]) => { const ServiceIcon = Icon as typeof PhoneCall; return <div key={label as string}><ServiceIcon size={23} strokeWidth={1.2} /><span>{label as string}</span></div>; })}</div>
    </div>
    <div className="learn-network-mark__bottom"><span>CONTINUITY NEEDS TRUST.</span><small>Watch the signals.<br />Check the recovery path.</small></div>
  </div>;
}
