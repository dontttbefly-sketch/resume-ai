/* ============================================================================
 * 界面状态：当前在看哪个视图
 * ========================================================================== */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AppView = "resume" | "jd" | "pool";

interface UiState {
  view: AppView;
  setView: (view: AppView) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      view: "resume",
      setView: (view) => set({ view }),
    }),
    {
      name: "resume-ai/ui",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
