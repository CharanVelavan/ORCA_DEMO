import { Info } from 'lucide-react';
import { useLiveStore } from '../store';
import { isReadOnlyPlayback, PLAYBACK_NOTICE } from '../inbox/readOnly';

export function ReadOnlyNotice() {
  const source = useLiveStore((state) => state.source);
  if (source !== 'replay' && !isReadOnlyPlayback()) return null;
  return <div className="ops-readonly" role="status"><Info size={16} aria-hidden /><strong>Read-only</strong><span>{PLAYBACK_NOTICE}</span></div>;
}
