import { AttackRail, SimDrawer, SimulatorPanel } from './sim';
import { StageLayout } from './stage/StageLayout';
import { useUi } from './stage/uiStore';

/** /stage: Simulator and Console together, for the video and the live demo. Sees ground truth. */
export function Stage() {
  const mode = useUi((s) => s.mode);
  return (
    <StageLayout view="stage" truth running={mode === 'running'}
      setupPanel={<SimulatorPanel />}
      rail={<AttackRail />}
      drawer={<SimDrawer />} />
  );
}
