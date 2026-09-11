/* ============================================================================
 * 全局状态：唯一数据源
 *
 * - 所有编辑都写到这里，预览直接读这里，因此「输入即同步」无需额外同步逻辑
 * - persist 中间件自动写 localStorage，所以没有保存按钮
 * ========================================================================== */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { EntryData, FieldValue } from "../data/schema";
import { SECTION_MAP, SECTIONS, type SectionKey } from "../data/sections";
import { buildMyResume, buildFullResume } from "../data/privateResume";
import { buildEmptyResume, buildSampleResume, makeBlankEntry, normalizeSections } from "../data/sampleResume";

const STORAGE_KEY = "resume-ai/resume";
// v2：默认内容从「完整转录版（3 页）」换成「一页精简版」，
// 因此旧缓存（v1）一律作废、重新以新版默认内容启动。
// 老的完整内容没丢，点「载入完整版」可以整份切回来。
// v3：新增多档案（最多 3 份简历）。v2 缓存升级时**内容保留**，
//     只是补上档案结构（原有内容整体成为「简历 1」）。
const STORAGE_VERSION = 3;

/* ------------------------------ 多档案 ------------------------------ */

export const MAX_PROFILES = 3;
const DEFAULT_PROFILE_ID = "default";

export interface ProfileMeta {
  id: string;
  name: string;
  updatedAt: number;
}

export interface ProfileSnapshot {
  sections: Record<string, EntryData[]>;
  visibility: Record<string, boolean>;
}

const newProfileId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `p${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

export interface ResumeState {
  /** sectionKey -> 条目数组 */
  sections: Record<string, EntryData[]>;
  /** sectionKey -> 是否显示 */
  visibility: Record<string, boolean>;
  updatedAt: number;

  /* 多档案：当前展示的就是 activeId 这一份，其余整份存进 snapshots */
  profiles: ProfileMeta[];
  activeId: string;
  snapshots: Record<string, ProfileSnapshot>;
  createProfile: () => string | null;
  duplicateProfile: () => string | null;
  renameProfile: (name: string) => void;
  deleteProfile: () => void;
  switchProfile: (id: string) => void;
  /** 云同步：把云端档案合并进本机（同名覆盖，新名建档案，超 3 份丢弃）。返回合并数 */
  importCloudProfiles: (rows: { name: string; snapshot: ProfileSnapshot }[]) => number;

  /* 字段 */
  setField: (section: SectionKey, id: string, field: string, value: FieldValue) => void;

  /* 条目 */
  addEntry: (section: SectionKey) => void;
  removeEntry: (section: SectionKey, id: string) => void;
  moveEntry: (section: SectionKey, id: string, dir: -1 | 1) => void;

  /* 要点列表 */
  addBullet: (section: SectionKey, id: string, field: string, after: number) => void;
  setBullet: (section: SectionKey, id: string, field: string, index: number, text: string) => void;
  removeBullet: (section: SectionKey, id: string, field: string, index: number) => void;
  moveBullet: (section: SectionKey, id: string, field: string, index: number, dir: -1 | 1) => void;

  /* 模块开关 */
  toggleSection: (section: SectionKey) => void;
  setAllVisible: (visible: boolean) => void;

  /* 整体操作 */
  loadMine: () => void;
  loadFull: () => void;
  loadSample: () => void;
  clearAll: () => void;
}

/** 不可变地替换某一条条目 */
function mapEntry(
  sections: Record<string, EntryData[]>,
  key: string,
  id: string,
  fn: (entry: EntryData) => EntryData,
): Record<string, EntryData[]> {
  const list = sections[key];
  if (!list) return sections;
  let hit = false;
  const next = list.map((e) => {
    if (e.id !== id) return e;
    hit = true;
    return fn(e);
  });
  return hit ? { ...sections, [key]: next } : sections;
}

/** 交换数组两个位置 */
function swap<T>(list: T[], i: number, j: number): T[] {
  const next = [...list];
  if (i < 0 || j < 0 || i >= next.length || j >= next.length) return next;
  const tmp = next[i];
  next[i] = next[j];
  next[j] = tmp;
  return next;
}

/** 首次打开 / 清空缓存后看到的默认内容：真实简历 */
const initial = buildMyResume();

export const useResumeStore = create<ResumeState>()(
  persist(
    (set, get) => ({
      sections: initial.sections,
      visibility: initial.visibility,
      updatedAt: initial.updatedAt,

      profiles: [{ id: DEFAULT_PROFILE_ID, name: "简历 1", updatedAt: initial.updatedAt }],
      activeId: DEFAULT_PROFILE_ID,
      snapshots: {},

      /* ---------------------------- 多档案 ----------------------------
       * 当前展示的内容就是活跃档案；其余整份存 snapshots。
       * 活跃档案的快照不在这里手动维护 —— partialize 每次落盘时都会把
       * 当时的 sections/visibility 写回 snapshots[activeId]，天然最新。
       * ---------------------------------------------------------------- */

      createProfile: () => {
        const { profiles } = get();
        if (profiles.length >= MAX_PROFILES) return null;

        const id = newProfileId();
        const blank = buildEmptyResume();
        set((state) => ({
          profiles: [
            ...state.profiles,
            { id, name: `简历 ${state.profiles.length + 1}`, updatedAt: Date.now() },
          ],
          activeId: id,
          // 新档案从空白开始；旧档案内容照常由 partialize 存回快照
          sections: blank.sections,
          visibility: blank.visibility,
          updatedAt: Date.now(),
        }));
        return id;
      },

      duplicateProfile: () => {
        const { profiles, activeId } = get();
        if (profiles.length >= MAX_PROFILES) return null;

        const source = profiles.find((p) => p.id === activeId);
        const id = newProfileId();
        set((state) => ({
          profiles: [
            ...state.profiles,
            { id, name: `${source?.name ?? "简历"} 副本`, updatedAt: Date.now() },
          ],
          activeId: id,
          // 内容与来源档案此刻完全一致，直接原样切过去即可
          updatedAt: Date.now(),
        }));
        return id;
      },

      renameProfile: (name) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === state.activeId ? { ...p, name: name.trim() || p.name, updatedAt: Date.now() } : p,
          ),
        })),

      deleteProfile: () =>
        set((state) => {
          if (state.profiles.length <= 1) return {};
          const rest = state.profiles.filter((p) => p.id !== state.activeId);
          const next = rest[0];
          const snap = state.snapshots[next.id];
          // 被删档案的快照一并清掉，不在 localStorage 里留尸体
          const snapshots: Record<string, ProfileSnapshot> = { ...state.snapshots };
          delete snapshots[state.activeId];
          const blank = buildEmptyResume();
          return {
            profiles: rest,
            activeId: next.id,
            snapshots,
            sections: normalizeSections(snap?.sections ?? blank.sections),
            visibility: snap ? { ...snap.visibility } : blank.visibility,
            updatedAt: Date.now(),
          };
        }),

      switchProfile: (id) =>
        set((state) => {
          if (id === state.activeId) return {};
          const snap = state.snapshots[id];
          // 快照意外缺失时切到空白而不是卡死：没东西可保，但至少能进得去出得来
          const fallback = buildEmptyResume();
          return {
            activeId: id,
            sections: normalizeSections(snap?.sections ?? fallback.sections),
            visibility: snap ? { ...snap.visibility } : fallback.visibility,
            updatedAt: Date.now(),
          };
        }),

      importCloudProfiles: (rows) => {
        const state = get();
        let merged = 0;

        const profiles = [...state.profiles];
        const snapshots = { ...state.snapshots };

        for (const row of rows) {
          if (!row.name || !row.snapshot) continue;
          const existing = profiles.find((p) => p.name === row.name);
          if (existing) {
            // 同名：用云端内容覆盖本机快照（云端是最近登录设备推的，视为更新）
            snapshots[existing.id] = row.snapshot;
            merged++;
            continue;
          }
          if (profiles.length >= MAX_PROFILES) continue;
          const id = newProfileId();
          profiles.push({ id, name: row.name, updatedAt: Date.now() });
          snapshots[id] = row.snapshot;
          merged++;
        }

        if (merged === 0) return 0;

        // 若当前活跃档案被覆盖了内容，一并切过去
        const activeMeta = profiles.find((p) => p.id === state.activeId);
        const activeSnap = activeMeta ? snapshots[activeMeta.id] : undefined;

        set({
          profiles,
          snapshots,
          sections: activeSnap ? normalizeSections(activeSnap.sections) : state.sections,
          visibility: activeSnap ? { ...activeSnap.visibility } : state.visibility,
          updatedAt: Date.now(),
        });
        return merged;
      },

      /* ------------------------------ 字段 ------------------------------ */

      setField: (section, id, field, value) =>
        set((state) => ({
          sections: mapEntry(state.sections, section, id, (entry) => ({
            ...entry,
            values: { ...entry.values, [field]: value },
          })),
          updatedAt: Date.now(),
        })),

      /* ------------------------------ 条目 ------------------------------ */

      addEntry: (section) =>
        set((state) => ({
          sections: {
            ...state.sections,
            [section]: [...(state.sections[section] ?? []), makeBlankEntry(SECTION_MAP[section])],
          },
          updatedAt: Date.now(),
        })),

      removeEntry: (section, id) =>
        set((state) => {
          const min = SECTION_MAP[section].entry.minItems ?? 0;
          const list = (state.sections[section] ?? []).filter((e) => e.id !== id);
          if (list.length < min) return {};
          return { sections: { ...state.sections, [section]: list }, updatedAt: Date.now() };
        }),

      moveEntry: (section, id, dir) =>
        set((state) => {
          const list = state.sections[section] ?? [];
          const i = list.findIndex((e) => e.id === id);
          if (i < 0) return {};
          return {
            sections: { ...state.sections, [section]: swap(list, i, i + dir) },
            updatedAt: Date.now(),
          };
        }),

      /* --------------------------- 要点列表 --------------------------- */

      addBullet: (section, id, field, after) =>
        set((state) => ({
          sections: mapEntry(state.sections, section, id, (entry) => {
            const list = [...((entry.values[field] as string[] | undefined) ?? [])];
            list.splice(after + 1, 0, "");
            return { ...entry, values: { ...entry.values, [field]: list } };
          }),
          updatedAt: Date.now(),
        })),

      setBullet: (section, id, field, index, text) =>
        set((state) => ({
          sections: mapEntry(state.sections, section, id, (entry) => {
            const list = [...((entry.values[field] as string[] | undefined) ?? [])];
            if (index < 0 || index >= list.length) return entry;
            list[index] = text;
            return { ...entry, values: { ...entry.values, [field]: list } };
          }),
          updatedAt: Date.now(),
        })),

      removeBullet: (section, id, field, index) =>
        set((state) => ({
          sections: mapEntry(state.sections, section, id, (entry) => {
            const list = ((entry.values[field] as string[] | undefined) ?? []).filter(
              (_, i) => i !== index,
            );
            return { ...entry, values: { ...entry.values, [field]: list } };
          }),
          updatedAt: Date.now(),
        })),

      moveBullet: (section, id, field, index, dir) =>
        set((state) => ({
          sections: mapEntry(state.sections, section, id, (entry) => {
            const list = [...((entry.values[field] as string[] | undefined) ?? [])];
            return { ...entry, values: { ...entry.values, [field]: swap(list, index, index + dir) } };
          }),
          updatedAt: Date.now(),
        })),

      /* ---------------------------- 模块开关 ---------------------------- */

      toggleSection: (section) =>
        set((state) => ({
          visibility: {
            ...state.visibility,
            [section]: !(state.visibility[section] ?? SECTION_MAP[section].defaultVisible),
          },
          updatedAt: Date.now(),
        })),

      setAllVisible: (visible) =>
        set(() => {
          const next: Record<string, boolean> = {};
          for (const s of SECTIONS) next[s.key] = visible;
          return { visibility: next, updatedAt: Date.now() };
        }),

      /* ---------------------------- 整体操作 ---------------------------- */

      loadMine: () => set(() => buildMyResume()),
      loadFull: () => set(() => buildFullResume()),
      loadSample: () => set(() => buildSampleResume()),
      clearAll: () => set(() => buildEmptyResume()),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),

      // 结构升级钩子。将来若改了数据形状，在这里按 version 逐级转换。
      // v1 的缓存里存的是旧的完整版内容，直接丢弃、改用新的默认（一页版）。
      migrate: (persisted, version) => {
        if (version < 2) return {} as Partial<ResumeState>;
        return persisted as Partial<ResumeState>;
      },

      // 用 normalizeSections 补齐缺失模块：将来新增模块后，旧缓存不会导致白屏
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ResumeState>;
        if (!p.sections) return current;

        const sections = normalizeSections(p.sections);
        const visibility = { ...current.visibility, ...(p.visibility ?? {}) };

        // v2 → v3 升级：老用户没有档案结构，原有内容整体成为「简历 1」，不丢内容
        const profiles: ProfileMeta[] = p.profiles?.length
          ? p.profiles
          : [{ id: DEFAULT_PROFILE_ID, name: "简历 1", updatedAt: p.updatedAt ?? Date.now() }];
        const activeId =
          p.activeId && profiles.some((x) => x.id === p.activeId) ? p.activeId : profiles[0].id;

        const snapshots: Record<string, ProfileSnapshot> = { ...(p.snapshots ?? {}) };
        snapshots[activeId] = { sections, visibility };
        // 兜底：快照存在但元信息丢失的档案，补一条，别让数据变成孤儿
        for (const id of Object.keys(snapshots)) {
          if (!profiles.some((x) => x.id === id)) {
            profiles.push({ id, name: "未命名简历", updatedAt: Date.now() });
          }
        }

        return {
          ...current,
          sections,
          visibility,
          updatedAt: p.updatedAt ?? current.updatedAt,
          profiles,
          activeId,
          snapshots,
        };
      },

      // 活跃档案的快照在每次落盘时顺带刷新 —— 任何编辑都天然同步进 snapshots
      partialize: (state) => ({
        sections: state.sections,
        visibility: state.visibility,
        updatedAt: state.updatedAt,
        profiles: state.profiles,
        activeId: state.activeId,
        snapshots: state.snapshots,
      }),
    },
  ),
);

/* ---------------------------------------------------------------------------
 * 活跃档案的快照同步
 *
 * 必须在内存里做，不能只在落盘时（partialize）做：partialize 改的只是写进
 * localStorage 的内容，内存里的 snapshots 仍是旧的 —— 下一次落盘会把旧值
 * spread回去，把其他档案的快照弄丢（实测踩过：切一次档案就丢一份）。
 *
 * 规则：内容或活跃身份一变，就把最新内容记到当前活跃档案名下，
 * 其他档案的快照原样保留。setState 会再触发一次本订阅，
 * 靠最上面的相等性判断终止，不会成环。
 * ------------------------------------------------------------------------- */
useResumeStore.subscribe((state, prev) => {
  if (
    state.sections === prev.sections &&
    state.visibility === prev.visibility &&
    state.activeId === prev.activeId
  ) {
    return;
  }
  const current = state.snapshots[state.activeId];
  if (current && current.sections === state.sections && current.visibility === state.visibility) {
    return;
  }
  useResumeStore.setState({
    snapshots: {
      ...state.snapshots,
      [state.activeId]: { sections: state.sections, visibility: state.visibility },
    },
  });
});
