import type { LiveEvent } from './types';

export function connectStream(since:number, onEvent:(event:LiveEvent)=>void, onError?:(error:Error)=>void) {
  let closed = false;
  let source:EventSource|undefined;
  let retry:number|undefined;
  const report = (error:Error) => { if (onError) onError(error); else console.error(error.message); };
  const open = () => {
    if (closed) return;
    source = new EventSource(`/api/stream?since=${since}`);
    source.onmessage = ({data}) => {
      let event:LiveEvent;
      try {
        const parsed:unknown = JSON.parse(data);
        if (!parsed || typeof parsed !== 'object' || !('seq' in parsed) || typeof parsed.seq !== 'number' || !('kind' in parsed) || typeof parsed.kind !== 'string') {
          throw new Error('Invalid event envelope');
        }
        event = parsed as LiveEvent;
      } catch (error) {
        report(new Error(`Could not read engine event: ${error instanceof Error ? error.message : 'invalid JSON'}`));
        return;
      }
      since = event.seq;
      onEvent(event);
    };
    source.onerror = () => {
      source?.close();
      report(new Error('Engine connection interrupted. Reconnecting to the recorded event stream.'));
      if (!closed) retry = window.setTimeout(open, 1000);
    };
  };
  open();
  return () => { closed = true; source?.close(); window.clearTimeout(retry); };
}
