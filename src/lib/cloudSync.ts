/* ============================================================================
 * 云同步：登录后把本机的简历档案同步到 Supabase
 *
 * 规则（简单压倒一切）：
 *   - 登录成功 → 拉云端档案合并进本机（同名覆盖内容，新名建新档案，最多 3 份）
 *   - 本机内容变化 → 防抖 2 秒后把全部档案 upsert 上去；云端多出来的行
 *     （本机已删的）一并删掉，保证两边一致
 *   - 未登录 → 什么都不发生
 * ========================================================================== */

import { supabase } from "./supabase";
import { useAuthStore } from "../store/useAuthStore";
import { useResumeStore, type ProfileSnapshot } from "../store/useResumeStore";

interface CloudRow {
  name: string;
  content: ProfileSnapshot;
  updated_at: string;
}

/** 登录后把云端档案并进本机。返回合并了几条。 */
export async function pullOnLogin(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("resumes")
    .select("name, content, updated_at")
    .eq("user_id", userId);
  if (error) {
    console.warn("[sync] 拉取失败:", error.message);
    return 0;
  }
  const rows = (data ?? []) as CloudRow[];
  if (!rows.length) return 0;

  return useResumeStore.getState().importCloudProfiles(
    rows.map((r) => ({ name: r.name, snapshot: r.content })),
  );
}

let pushTimer: number | undefined;
let lastPushedNames: string[] = [];

/** 内容变化 → 防抖推送全部档案（含删除云端多余行） */
function schedulePush(userId: string): void {
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void pushAll(userId), 2000);
}

async function pushAll(userId: string): Promise<void> {
  const { profiles, snapshots } = useResumeStore.getState();

  const rows = profiles.map((p) => ({
    user_id: userId,
    name: p.name,
    content: snapshots[p.id] ?? { sections: {}, visibility: {} },
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("resumes").upsert(rows, { onConflict: "user_id,name" });
  if (error) {
    console.warn("[sync] 推送失败:", error.message);
    return;
  }

  // 本机删掉的档案，云端也删
  const names = new Set(profiles.map((p) => p.name));
  const removed = lastPushedNames.filter((n) => !names.has(n));
  if (removed.length) {
    await supabase.from("resumes").delete().eq("user_id", userId).in("name", removed);
  }
  lastPushedNames = profiles.map((p) => p.name);
}

/** 应用启动时调用一次：把账号状态和同步接起来 */
export function initCloudSync(): void {
  // 登录成功 → 先拉云端
  useAuthStore.subscribe((state, prev) => {
    if (state.userId && state.userId !== prev.userId) {
      void pullOnLogin(state.userId).then((n) => {
        if (n) console.log(`[sync] 从云端并入了 ${n} 份档案`);
        lastPushedNames = useResumeStore.getState().profiles.map((p) => p.name);
      });
    }
  });

  // 本机内容变化（防抖推送）。四个引用任一变化都视为有改动。
  useResumeStore.subscribe((state, prev) => {
    const auth = useAuthStore.getState();
    if (!auth.userId) return;
    const changed =
      state.sections !== prev.sections ||
      state.visibility !== prev.visibility ||
      state.profiles !== prev.profiles ||
      state.snapshots !== prev.snapshots;
    if (changed) schedulePush(auth.userId);
  });
}
