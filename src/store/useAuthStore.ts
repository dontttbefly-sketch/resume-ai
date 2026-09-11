/* ============================================================================
 * 账号状态
 *
 * 注册登录是**可选**的：不登录照样能用（本机多档案）。
 * 登录之后多一个好处 —— 简历档案自动云同步，换设备也能看到。
 * ========================================================================== */

import { create } from "zustand";

import { supabase } from "../lib/supabase";

export type AuthStatus = "checking" | "signed-out" | "signed-in";

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  /** 初始化 / 登录 / 登出过程中置 true，避免同步逻辑重入 */
  busy: boolean;

  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: "checking",
  userId: null,
  email: null,
  busy: false,

  init: async () => {
    // 会话变化：登录 → 拉 userId/email 并触发云拉取；登出 → 清掉
    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        status: session ? "signed-in" : "signed-out",
        userId: session?.user.id ?? null,
        email: session?.user.email ?? null,
      });
    });

    const { data, error } = await supabase.auth.getSession();
    if (error) console.warn("[auth] 读取会话失败:", error.message);
    set({
      status: data.session ? "signed-in" : "signed-out",
      userId: data.session?.user.id ?? null,
      email: data.session?.user.email ?? null,
    });
  },

  signIn: async (email, password) => {
    set({ busy: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    } finally {
      set({ busy: false });
    }
  },

  signUp: async (email, password) => {
    set({ busy: true });
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return error.message;
      // 项目默认关闭邮箱确认（自部署可在 Supabase 后台开启）；
      // 若开了确认，这里 session 为空，界面会停留在未登录态并提示查收邮件。
      if (data.session == null) {
        return "注册成功！请先到邮箱点确认链接，再回来登录。";
      }
      return null;
    } finally {
      set({ busy: false });
    }
  },

  signOut: async () => {
    set({ busy: true });
    await supabase.auth.signOut();
    set({ busy: false, status: "signed-out", userId: null, email: null });
    void get();
  },
}));
