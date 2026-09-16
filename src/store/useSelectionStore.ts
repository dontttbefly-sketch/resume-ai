/* ============================================================================
 * 选择状态：用户在简历预览上点选了什么（AI 改进的上下文）
 *
 * 面板双模式（见 9-16 讨论定稿）：
 *   compact（局部编辑）：点简历段落触发 → 矮面板，只改进当前选区
 *   full（AI 聊天）：点顶栏 ✦AI 触发 → 高面板，自由对话（聊简历/经历）
 *   null：关闭
 * ========================================================================== */

import { create } from "zustand";

export type SelectionLevel = "section" | "entry" | "bullet";
export type PanelMode = "compact" | "full" | null;

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
  /** null = 面板关闭；compact = 局部编辑矮面板；full = AI 聊天高面板 */
  panelMode: PanelMode;
  /** AI 正在处理 → 选区高斯模糊 */
  thinking: boolean;
  /** 经历库浮窗 */
  vaultOpen: boolean;

  /** 点选简历段落 → compact 模式 */
  select: (s: Selection) => void;
  /** 点顶栏 AI → full 模式 */
  openFull: () => void;
  /** 解除选区关联（面板转 full 自由聊） */
  detach: () => void;
  /** 关闭面板 + 清选区 */
  close: () => void;
  setThinking: (v: boolean) => void;
  setVaultOpen: (v: boolean) => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selection: null,
  panelMode: null,
  thinking: false,
  vaultOpen: false,

  select: (s) => set({ selection: s, panelMode: "compact" }),
  openFull: () => set({ panelMode: "full" }),
  detach: () => set({ selection: null, panelMode: "full" }),
  close: () => set({ selection: null, panelMode: null }),
  setThinking: (v) => set({ thinking: v }),
  setVaultOpen: (v) => set({ vaultOpen: v }),
}));
