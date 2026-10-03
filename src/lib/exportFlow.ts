/* 导出 PDF 的入口：首次先弹打印设置引导，之后直接打开打印窗口 */

import { create } from "zustand";

import { isPrintGuideDismissed } from "../components/PrintGuide";
import { useUiStore } from "../store/useUiStore";
import { exportPdf } from "./print";
import { switchView } from "./transitions";

interface ExportFlow {
  guideOpen: boolean;
  setGuideOpen: (v: boolean) => void;
}

export const useExportFlow = create<ExportFlow>()((set) => ({
  guideOpen: false,
  setGuideOpen: (guideOpen) => set({ guideOpen }),
}));

export function requestExport(): void {
  // 纸张只在「简历」视图里渲染，别的视图下先切回来
  if (useUiStore.getState().view !== "studio") switchView("studio");
  if (isPrintGuideDismissed()) void exportPdf();
  else useExportFlow.getState().setGuideOpen(true);
}
