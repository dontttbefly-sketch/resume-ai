import { EditorPanel } from "./components/EditorPanel";
import { Toolbar } from "./components/Toolbar";
import { JdPanel } from "./components/jd/JdPanel";
import { PoolPanel } from "./components/pool/PoolPanel";
import { PreviewPanel } from "./components/preview/PreviewPanel";
import { useUiStore } from "./store/useUiStore";

export default function App() {
  const view = useUiStore((s) => s.view);

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-slate-100">
      <Toolbar />
      <div className="app-main flex min-h-0 flex-1">
        {view === "resume" && (
          <>
            <EditorPanel />
            <PreviewPanel />
          </>
        )}
        {view === "jd" && <JdPanel />}
        {view === "pool" && <PoolPanel />}
      </div>
    </div>
  );
}
