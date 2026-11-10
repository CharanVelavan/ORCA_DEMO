import { useCallback, useState } from 'react';
import { fireInject } from './actions';

/** Fires an injector and tracks which one is pending or failed, by injector id. */
export function useFire() {
  const [pending, setPending] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fire = useCallback(async (injector: string, target: string, durationMin = 15) => {
    setPending(injector);
    setErrors((e) => { const { [injector]: _drop, ...rest } = e; return rest; });
    try {
      await fireInject(injector, target, durationMin);
    } catch (error) {
      setErrors((e) => ({ ...e, [injector]: error instanceof Error ? error.message : 'Could not fire that event.' }));
    } finally {
      setPending((p) => (p === injector ? null : p));
    }
  }, []);
  return { fire, pending, errors };
}
