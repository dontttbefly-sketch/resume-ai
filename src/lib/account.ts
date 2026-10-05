/* ============================================================================
 * 线上账号：额度、自带模型密钥、用户管理（站长）
 *
 * 只有部署在 Vercel 的线上版有账号（middleware.ts + api/me.ts + api/admin.ts）；
 * 本地 pnpm dev 和 GitHub Pages 演示版取不到 /api/me，me 一直是 null，
 * 相关界面自动隐藏，其他功能照常。
 * ========================================================================== */

import { create } from "zustand";

export interface OwnLlmInfo {
  baseUrl: string;
  model: string;
  keyTail: string;
}

export interface Me {
  id: string;
  email: string;
  nick: string;
  role: "owner" | "user";
  /** 剩余 token；并发时可能略微透支成负数 */
  quota: number;
  used: number;
  byokUsed: number;
  calls: number;
  created: number;
  /** 个人密钥：本机执行器、安装命令用 */
  key: string;
  ownLlm: OwnLlmInfo | null;
}

export interface AdminUser {
  id: string;
  email: string;
  nick: string;
  role: "owner" | "user";
  quota: number;
  used: number;
  byokUsed: number;
  calls: number;
  created: number;
  last: number;
  disabled: boolean;
  note: string;
  ownLlm: boolean;
}

export interface Grant {
  t: number;
  delta: number;
  note: string;
  by: string;
}

export const useAccount = create<{ me: Me | null }>(() => ({ me: null }));

/** 和登录页、投递页共用：个人密钥存在这里（键名沿用邀请码时代） */
const KEY_STORAGE = "resume-ai/invite-code";

const API = `${import.meta.env.BASE_URL}api`;

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { error?: { message?: string } | string } | null;
  if (!res.ok) {
    const e = data?.error;
    throw new Error((typeof e === "string" ? e : e?.message) || `请求失败（HTTP ${res.status}）`);
  }
  return data as T;
}

function setMe(me: Me): void {
  useAccount.setState({ me });
  // 换了设备、清过缓存：从账号里把个人密钥补回本机
  try {
    if (me.key && localStorage.getItem(KEY_STORAGE) !== me.key) localStorage.setItem(KEY_STORAGE, me.key);
  } catch {
    /* 隐私模式存不进去也不影响网页里用 AI */
  }
}

export async function loadMe(): Promise<void> {
  if (!import.meta.env.PROD) return;
  try {
    const res = await fetch(`${API}/me`, { credentials: "same-origin", cache: "no-store" });
    if (res.ok && res.headers.get("content-type")?.includes("json")) setMe((await res.json()) as Me);
  } catch {
    /* 演示版 / 离线：没有账号 */
  }
}

/** /api/llm 每次扣完把余额带回来，界面跟着变 */
export function setQuota(quota: number): void {
  const me = useAccount.getState().me;
  if (me && Number.isFinite(quota)) useAccount.setState({ me: { ...me, quota } });
}

export function logout(): void {
  try {
    localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* 空 */
  }
  window.location.href = "/__auth/logout";
}

/* ------------------------------ 我的设置 ------------------------------ */

export async function saveOwnLlm(cfg: { baseUrl: string; model: string; apiKey: string }): Promise<void> {
  setMe(await api<Me>("/me", { action: "set-llm", ...cfg }));
}

export async function clearOwnLlm(): Promise<void> {
  setMe(await api<Me>("/me", { action: "clear-llm" }));
}

export async function changePassword(old: string, next: string): Promise<void> {
  await api("/me", { action: "password", old, next });
}

/* ------------------------------ 站长：用户管理 ------------------------------ */

export const adminApi = {
  list: () => api<{ users: AdminUser[]; config: { signupTokens: number } }>("/admin"),
  grants: (id: string) => api<{ grants: Grant[] }>(`/admin?grants=${encodeURIComponent(id)}`),
  grant: (id: string, delta: number, note: string) => api<{ user: AdminUser }>("/admin", { action: "grant", id, delta, note }),
  disable: (id: string, disabled: boolean) => api<{ user: AdminUser }>("/admin", { action: "disable", id, disabled }),
  resetPassword: (id: string) => api<{ user: AdminUser; password: string }>("/admin", { action: "reset-password", id }),
  note: (id: string, note: string) => api<{ user: AdminUser }>("/admin", { action: "note", id, note }),
  config: (signupTokens: number) => api<{ config: { signupTokens: number } }>("/admin", { action: "config", signupTokens }),
};

/* ------------------------------ 显示 ------------------------------ */

/** 300000 → "30 万"，23456 → "2.3 万"，8000 → "8,000" */
export function fmtTokens(n: number): string {
  const v = Math.max(0, n);
  if (v < 10_000) return v.toLocaleString("zh-CN");
  const w = v / 10_000;
  return `${w >= 100 ? Math.round(w).toLocaleString("zh-CN") : Number(w.toFixed(1))} 万`;
}

/** "刚刚" / "5 分钟前" / "3 天前" / 具体日期 */
export function fmtAgo(t: number): string {
  if (!t) return "从没用过";
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "刚刚";
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} 天前`;
  return new Date(t).toLocaleDateString("zh-CN");
}
