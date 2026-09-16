/* ============================================================================
 * 选区状态：支持多选（点段落 = 添加/移除一个选区标签）
 *
 * 模式（9-16 第三轮定稿）：
 *   只有一种面板：full 高面板（自由聊）
 *   选中段落 → 在输入框上方挂彩色「选区标签」（#公司名·第N条 ✕）
 *   点空白 → 清空选区 + 关面板
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
  /** 稳定 key（去重用） */
  key: string;
}

interface SelectionState {
  /** 当前所有选区（多选） */
  selections: Selection[];
  panelOpen: boolean;
  thinking: boolean;
  vaultOpen: boolean;

  /** 点选一个块：已选则移除，未选则添加；同时打开面板 */
  toggle: (s: Selection) => void;
  /** 移除一个选区 */
  remove: (key: string) => void;
  /** 清空全部选区 */
  clearSelections: () => void;
  /** 打开面板（顶栏 AI） */
  open: () => void;
  /** 关闭面板 + 清空选区 */
  close: () => void;
  setThinking: (v: boolean) => void;
  setVaultOpen: (v: boolean) => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selections: [],
  panelOpen: false,
  thinking: false,
  vaultOpen: false,

  toggle: (s) =>
    set((st) => {
      const exists = st.selections.some((x) => x.key === s.key);
      return {
        selections: exists ? st.selections.filter((x) => x.key !== s.key) : [...st.selections, s],
        panelOpen: true,
      };
    }),
  remove: (key) => set((st) => ({ selections: st.selections.filter((x) => x.key !== key) })),
  clearSelections: () => set({ selections: [] }),
  open: () => set({ panelOpen: true }),
  close: () => set({ selections: [], panelOpen: false }),
  setThinking: (v) => set({ thinking: v }),
  setVaultOpen: (v) => set({ vaultOpen: v }),
}));

/** 生成稳定 key */
export function selectionKey(s: Omit<Selection, "key">): string {
  return `${s.sectionKey}:${s.entryId ?? "-"}:${s.bulletIndex ?? "-"}`;
}
