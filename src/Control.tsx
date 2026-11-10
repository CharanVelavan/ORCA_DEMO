import { SimDrawer, SimulatorPanel } from './sim';
import { TopBar } from './stage/TopBar';
import { useUi } from './stage/uiStore';
import { Scene3D } from './stage/StageLayout';
import './stage/stage.css';

/** /control: the Simulator alone (Pi 5 screen). Sees ground truth. */
export function Control() {
  const mode = useUi((s) => s.mode);
  return (
    <div className="st-app">
      <TopBar view="control" />
      <main className="st-main st-main--control">
        <aside className="st-setup">{mode === 'running' ? <SimDrawer inline /> : <SimulatorPanel />}</aside>
        <section className="st-center"><div className="st-scene"><Scene3D truth /></div></section>
      </main>
    </div>
  );
}
