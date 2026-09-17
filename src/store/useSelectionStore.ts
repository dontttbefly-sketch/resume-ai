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
      if (exists) {
        return {
          selections: st.selections.filter((x) => x.key !== s.key),
          panelOpen: true,
        };
      }
      let next = [...st.selections, s];
      /* 层级互斥：父级包含子级 —— 选了整块就不能再选其中的小段 */
      if (s.level === "entry") {
        next = next.filter((x) => !(x.level === "bullet" && x.entryId === s.entryId));
      } else if (s.level === "section") {
        next = next.filter((x) => x.sectionKey !== s.sectionKey || x.level === "section");
      } else if (s.level === "bullet") {
        /* 父级已被选中 → 本次点击忽略（不能在整块里再选一小段） */
        const parentEntry = st.selections.some((x) => x.level === "entry" && x.entryId === s.entryId);
        const parentSection = st.selections.some(
          (x) => x.level === "section" && x.sectionKey === s.sectionKey,
        );
        if (parentEntry || parentSection) return { selections: st.selections, panelOpen: true };
      }
      return { selections: next, panelOpen: true };
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
