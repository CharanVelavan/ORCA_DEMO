import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { CATEGORY_LABEL, groupInjectors, type InjectorInfo } from '../sim/injectors';
import { isReadOnlyNow } from '../sim/readOnly';
import { Panel } from '../shell/primitives';

export function InjectionToolbar({ injectors, targets, disabled, onInject }: {
  injectors: InjectorInfo[]; targets: string[]; disabled: boolean;
  onInject: (kind: string, target: string, duration: number) => void;
}) {
  const [kind, setKind] = useState('');
  const [target, setTarget] = useState('');
  const [duration, setDuration] = useState('');
  const selected = injectors.find(item => item.id === kind);
  useEffect(() => {
    if (injectors.some(item => item.id === kind)) return;
    setKind(injectors[0]?.id ?? ''); setTarget(injectors[0]?.default_target ?? '');
  }, [injectors, kind]);
  const options = target && !targets.includes(target) ? [target, ...targets] : targets;
  const minutes = Number(duration);
  const valid = Boolean(selected && target && duration && Number.isInteger(minutes) && minutes > 0);
  return <Panel title="Launch an emulated condition" icon={Target} className="director-inject">
    {!injectors.length ? <p className="director-muted">No injectors are available in the catalogue.</p> : <>
      <div className="director-inject__compact">
        <label>Condition<select aria-label="Condition" value={kind} disabled={disabled} onChange={event => { if (disabled || isReadOnlyNow()) return; const injector = injectors.find(item => item.id === event.target.value); setKind(event.target.value); setTarget(injector?.default_target ?? ''); }}>{groupInjectors(injectors).map(group => <optgroup key={group.category} label={CATEGORY_LABEL[group.category]}>{group.items.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>)}</select></label>
        <label>Target<select aria-label="Target" value={target} disabled={disabled} onChange={event => setTarget(event.target.value)}>{!target && <option value="">Select target</option>}{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
        <label>Minutes<input aria-label="Minutes" type="number" min="1" step="1" inputMode="numeric" placeholder="e.g. 5" value={duration} disabled={disabled} onChange={event => setDuration(event.target.value)} /></label>
        <button type="button" className="sh-btn sh-btn--primary" disabled={disabled || !valid} onClick={() => { if (!disabled && !isReadOnlyNow() && valid) onInject(kind, target, minutes); }}>Launch</button>
      </div><p className="director-inject__boundary">Sandbox injection only. A request becomes effective when recorded by the engine.</p>
    </>}
  </Panel>;
}
