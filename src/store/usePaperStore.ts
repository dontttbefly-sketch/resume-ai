/* 纸张的实时度量：画布写、底部浮条读（内容高度、当前缩放） */

import { create } from "zustand";

interface PaperState {
  contentPx: number;
  scale: number;
  set: (patch: Partial<Pick<PaperState, "contentPx" | "scale">>) => void;
}

export const usePaperStore = create<PaperState>()((set) => ({
  contentPx: 0,
  scale: 1,
  set: (patch) => set(patch),
}));
