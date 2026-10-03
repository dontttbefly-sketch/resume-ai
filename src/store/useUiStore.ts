/* ============================================================================
 * 界面状态：当前视图、主题、工作台布局偏好
 * ========================================================================== */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AppView = "studio" | "match" | "deliver" | "library";
export type ThemePref = "system" | "light" | "dark";
export type PaperAccent = "blue" | "ink";
/** "fit" = 按可用宽度自适应；数字 = 固定缩放比例 */
export type ZoomMode = "fit" | number;

interface UiState {
  view: AppView;
  theme: ThemePref;
  inspectorOpen: boolean;
  zoom: ZoomMode;
  paperAccent: PaperAccent;
  matchTab: "analyze" | "pool";

  setView: (view: AppView) => void;
  setTheme: (theme: ThemePref) => void;
  toggleInspector: () => void;
  setZoom: (zoom: ZoomMode) => void;
  setPaperAccent: (accent: PaperAccent) => void;
  setMatchTab: (tab: "analyze" | "pool") => void;
}

const LEGACY_VIEW: Record<string, AppView> = {
  resume: "studio",
  jd: "match",
  pool: "match",
  experience: "library",
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      view: "studio",
      theme: "system",
      inspectorOpen: true,
      zoom: "fit",
      paperAccent: "blue",
      matchTab: "analyze",

      setView: (view) => set({ view }),
      setTheme: (theme) => set({ theme }),
      toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
      setZoom: (zoom) => set({ zoom }),
      setPaperAccent: (paperAccent) => set({ paperAccent }),
      setMatchTab: (matchTab) => set({ matchTab }),
    }),
    {
      name: "resume-ai/ui",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // v1 只有 view，且取值是旧的四个视图名
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<UiState> & { view?: string };
        if (version < 2 && p.view) p.view = LEGACY_VIEW[p.view] ?? "studio";
        return p as UiState;
      },
    },
  ),
);

/* ------------------------------ 主题 ------------------------------ */

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(pref: ThemePref): void {
  document.documentElement.dataset.theme = resolveTheme(pref);
}
