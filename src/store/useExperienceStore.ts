/* ============================================================================
 * 经历库（Experience Library）
 *
 * 「经历问答」模块的数据底座：AI 和用户聊工作经历，挖出的结构化条目存这里。
 * 写简历时（岗位匹配 / 话术 / AI 生成简历）会**高优先级**参考本库。
 *
 * 本地持久化（localStorage），与 src/data/private/experience-library.md 互为
 * 人工可读的备份（md 是文件版，这里是运行态）。
 * ========================================================================== */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface ExperienceItem {
  id: string;
  company: string;
  project: string;
  summary: string;
  updatedAt: number;
}

interface ExperienceState {
  items: ExperienceItem[];
  addItem: (item: Omit<ExperienceItem, "id" | "updatedAt">) => void;
  removeItem: (id: string) => void;
}

export const useExperienceStore = create<ExperienceState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => ({
          items: [
            ...state.items,
            { ...item, id: crypto.randomUUID(), updatedAt: Date.now() },
          ],
        })),
      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
    }),
    {
      name: "resume-ai/experience-library",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
