/* ============================================================================
 * 账号：登录 / 注册对话框 + 工具栏按钮
 *
 * 注册登录是可选功能 —— 未登录时所有功能照常（本机多档案）。
 * 登录后简历档案自动云同步，换设备登录同一账号即可恢复。
 * ========================================================================== */

import { useState } from "react";

import { useAuthStore } from "../store/useAuthStore";
import { IconSuitcase } from "./icons";
import { Btn } from "./ui";

export function AccountButton() {
  const status = useAuthStore((s) => s.status);
  const email = useAuthStore((s) => s.email);
  const signOut = useAuthStore((s) => s.signOut);
  const busy = useAuthStore((s) => s.busy);
  const [open, setOpen] = useState(false);

  if (status === "checking") return null;

  if (status === "signed-in") {
    return (
      <div className="flex items-center gap-1.5" title="已登录，简历档案会自动云同步">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="hidden max-w-[160px] truncate text-[11.5px] text-slate-500 md:inline">
          {email}
        </span>
        <Btn variant="ghost" disabled={busy} onClick={() => void signOut()}>
          退出
        </Btn>
      </div>
    );
  }

  return (
    <>
      <Btn
        variant="outline"
        title="可选：登录后简历档案自动云同步，换设备也能看到"
        onClick={() => setOpen(true)}
      >
        <IconSuitcase className="h-3.5 w-3.5" />
        登录
      </Btn>
      {open && <AuthDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AuthDialog({ onClose }: { onClose: () => void }) {
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const busy = useAuthStore((s) => s.busy);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("邮箱和密码都要填。");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 位。");
      return;
    }
    const err = mode === "signin" ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    if (err) setError(err);
    else onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div className="w-[400px] rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-medium text-slate-800">
          {mode === "signin" ? "登录账号" : "注册账号"}
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
          可选功能。不登录也能用；登录后简历档案自动云同步，最多 3 份。
        </p>

        <div className="mt-4 space-y-2.5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            autoComplete="email"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder="密码（至少 6 位）"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
          />
        </div>

        {error && <p className="mt-2 text-[12px] text-rose-600">{error}</p>}

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className="text-[12px] text-brand hover:underline"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
          >
            {mode === "signin" ? "没有账号？注册一个" : "已有账号？去登录"}
          </button>
          <div className="flex items-center gap-2">
            <Btn variant="ghost" onClick={onClose}>
              取消
            </Btn>
            <Btn variant="primary" disabled={busy} onClick={() => void submit()}>
              {busy ? "处理中…" : mode === "signin" ? "登录" : "注册"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
