/* ============================================================================
 * 选择状态：用户在简历预览上点选了什么（AI 改进的上下文）
 *
 * 核心模型：点选 → AI 面板自动滑出并携带上下文 → 对话改进 → 候选应用
 *   - bullet  级：点了某条要点
 *   - entry   级：点了公司名（选整个条目）
 *   - section 级：点了模块标题（选整块）
 * ========================================================================== */

import { create } from "zustand";

export type SelectionLevel = "section" | "entry" | "bullet";

export interface Selection {
  level: SelectionLevel;
  sectionKey: string;
  sectionLabel: string;
  entryId?: string;
  entryLabel?: string;
  bulletIndex?: number;
  bulletText?: string;
}

interface SelectionState {
  selection: Selection | null;
  /** AI 面板是否滑出 */
  aiOpen: boolean;
  /** AI 正在处理 → 选区高斯模糊 */
  thinking: boolean;
  /** 经历库浮窗 */
  vaultOpen: boolean;

  select: (s: Selection) => void;
  clear: () => void;
  setThinking: (v: boolean) => void;
  setAiOpen: (v: boolean) => void;
  setVaultOpen: (v: boolean) => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selection: null,
  aiOpen: false,
  thinking: false,
  vaultOpen: false,

  select: (s) => set({ selection: s, aiOpen: true }),
  clear: () => set({ selection: null }),
  setThinking: (v) => set({ thinking: v }),
  setAiOpen: (v) => set({ aiOpen: v }),
  setVaultOpen: (v) => set({ vaultOpen: v }),
}));
