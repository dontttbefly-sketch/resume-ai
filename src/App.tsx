/* ============================================================================
 * 简历工作台 · 外壳
 *
 *   顶栏（悬浮玻璃）+ 四个视图：
 *     简历  画布上的 A4 纸 + 内容面板 + AI 顾问
 *     岗位  JD 匹配分析 / 岗位池
 *     投递  BOSS 直聘逐张投递（本机服务）
 *     经历  经历库 + 经历挖掘
 *     用户  用户管理（线上版站长专属：给熟人加 AI 额度）
 *
 * 视图切换走 View Transitions（只对快照做合成动画，几乎零开销）。
 * ========================================================================== */

import { useEffect } from "react";

import { AdminView } from "./components/admin/AdminView";
import { DeliverView } from "./components/deliver/DeliverView";
import { DialogHost } from "./components/kit/Dialog";
import { Toaster } from "./components/kit/Toast";
import { LibraryView } from "./components/library/LibraryView";
import { MatchView } from "./components/match/MatchView";
import { TopBar } from "./components/shell/TopBar";
import { StudioView } from "./components/studio/StudioView";
import { requestExport } from "./lib/exportFlow";
import { switchView } from "./lib/transitions";
import { useSelectionStore } from "./store/useSelectionStore";
import { applyTheme, useUiStore } from "./store/useUiStore";

/** 主题：偏好变化时应用；「跟随系统」时监听系统切换 */
function useThemeSync() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);
}

/** ⌘P 导出 · ⌘K AI 顾问 · ⌘\ 内容面板 */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "p") {
        e.preventDefault();
        requestExport();
      } else if (key === "k") {
        e.preventDefault();
        if (useUiStore.getState().view !== "studio") switchView("studio");
        const sel = useSelectionStore.getState();
        if (sel.panelOpen) sel.close();
        else sel.open();
      } else if (key === "\\") {
        if (useUiStore.getState().view !== "studio") return;
        e.preventDefault();
        useUiStore.getState().toggleInspector();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export default function App() {
  const view = useUiStore((s) => s.view);
  useThemeSync();
  useShortcuts();

  return (
    <div className="app-shell relative h-full">
      <div className="app-canvas" aria-hidden="true" />
      <TopBar />
      <main className="app-view vt-view absolute inset-0">
        {view === "studio" && <StudioView />}
        {view === "match" && <MatchView />}
        {view === "deliver" && <DeliverView />}
        {view === "library" && <LibraryView />}
        {view === "admin" && <AdminView />}
      </main>
      <DialogHost />
      <Toaster />
    </div>
  );
}
