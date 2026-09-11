/* ============================================================================
 * 岗位池状态
 *
 * 存的是「实习僧抓下来的岗位列表」，和简历、JD 分三个 localStorage key。
 *
 * 为什么不自动持久化整池数据：JD 正文加起来可能有几百 KB，
 * 塞进 localStorage 容易顶到 5MB 配额。所以：
 *   - 池子本体只在内存里，重新载入很便宜（点一下 / 自动读 public 里的快照）
 *   - 只把「筛选条件」落盘，刷新后不用重设
 *   - 真要留档，用「导出 JSON」存成文件
 * ========================================================================== */

import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  applyFilter,
  DEFAULT_FILTER,
  parseJobPool,
  rankJobs,
  statsOf,
  type JobPool,
  type PoolFilter,
  type ScoredJob,
} from "../lib/jobPool";
import { flattenResume } from "../lib/resumeText";
import { useResumeStore } from "./useResumeStore";

/** 抓取脚本跑完会把产物复制到这里，所以打开页面就能直接看到 */
export const AUTO_POOL_URL = "shixiseng-jobs.json";

export type PoolStatus = "idle" | "loading" | "ready" | "error";

interface PoolState {
  pool: JobPool | null;
  sourceName: string;
  status: PoolStatus;
  error: string | null;
  filter: PoolFilter;
  /** 展开看细节的岗位 id（一次只开一个，列表长了不会满屏都是展开的） */
  expandedId: string | null;

  loadFromUrl: (url: string, sourceName?: string) => Promise<void>;
  loadFromText: (text: string, sourceName: string) => void;
  setFilter: (patch: Partial<PoolFilter>) => void;
  resetFilter: () => void;
  toggleExpanded: (internId: string) => void;
  clear: () => void;
}

export const usePoolStore = create<PoolState>()(
  persist(
    (set, get) => ({
      pool: null,
      sourceName: "",
      status: "idle",
      error: null,
      filter: { ...DEFAULT_FILTER },
      expandedId: null,

      loadFromUrl: async (url, sourceName) => {
        set({ status: "loading", error: null });
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) {
            // 404 是最常见的情况：还没跑过抓取脚本
            throw new Error(
              res.status === 404
                ? `没找到 ${url}，先跑一次 ./scripts/shixiseng/run.sh`
                : `读取失败：HTTP ${res.status}`,
            );
          }
          const text = await res.text();
          const pool = parseJobPool(text);
          set({
            pool,
            sourceName: sourceName ?? url,
            status: "ready",
            error: null,
            expandedId: null,
          });
        } catch (err) {
          set({
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },

      loadFromText: (text, sourceName) => {
        try {
          const pool = parseJobPool(text);
          set({
            pool,
            sourceName,
            status: "ready",
            error: null,
            expandedId: null,
          });
        } catch (err) {
          set({
            status: "error",
            error: `解析失败：${err instanceof Error ? err.message : String(err)}`,
          });
        }
      },

      setFilter: (patch) => set({ filter: { ...get().filter, ...patch } }),

      resetFilter: () => set({ filter: { ...DEFAULT_FILTER } }),

      toggleExpanded: (internId) =>
        set({ expandedId: get().expandedId === internId ? null : internId }),

      clear: () =>
        set({ pool: null, sourceName: "", status: "idle", error: null, expandedId: null }),
    }),
    {
      name: "resume-ai/pool",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ filter: state.filter }),
      merge: (persisted, current) => {
        const p = persisted as Partial<PoolState> | undefined;
        if (!p?.filter) return current;
        return { ...current, filter: { ...DEFAULT_FILTER, ...p.filter } };
      },
    },
  ),
);

/* ---------------------------------------------------------------------------
 * 派生数据
 *
 * 打分完全是本地计算（词典比对），一次几百条也就几十毫秒，
 * 但没必要每帧重算，所以用 useMemo 挂在 pool / filter / 简历 上。
 * ------------------------------------------------------------------------- */

export function useRankedJobs(): {
  rows: ScoredJob[];
  filtered: ScoredJob[];
  stats: ReturnType<typeof statsOf>;
} {
  const pool = usePoolStore((s) => s.pool);
  const filter = usePoolStore((s) => s.filter);
  const sections = useResumeStore((s) => s.sections);
  const visibility = useResumeStore((s) => s.visibility);

  return useMemo(() => {
    const flat = flattenResume(sections, visibility);
    const rows = pool ? rankJobs(pool.jobs, flat) : [];
    const filtered = applyFilter(rows, filter);
    return { rows, filtered, stats: statsOf(filtered) };
  }, [pool, filter, sections, visibility]);
}
