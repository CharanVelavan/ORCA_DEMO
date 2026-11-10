import { useLiveStore } from '../store';
import { useUi } from '../stage/uiStore';

export const PLAYBACK_NOTICE = 'Recorded playback is read-only. No action will be sent to the engine.';

export function isReadOnlyPlayback(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('fake') === '1'
    || useLiveStore.getState().source === 'replay'
    || (window.location.pathname === '/stage' && useUi.getState().config.run === 'demo');
}
