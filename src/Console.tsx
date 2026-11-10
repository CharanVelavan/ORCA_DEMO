import { StatusRail } from './inbox';
import { StageLayout } from './stage/StageLayout';

/** /console: the operator's view. Never receives ground truth (DataBridge uses store.add, Pipeline truth=false). */
export function Console() {
  return <StageLayout view="console" truth={false} running rail={<StatusRail />} />;
}
