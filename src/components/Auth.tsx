/* ============================================================================
 * 账号：登录 / 注册对话框
 *
 * 注册登录是可选功能 —— 未登录时所有功能照常（本机多档案）。
 * 登录后简历档案自动云同步，换设备登录同一账号即可恢复。
 * ========================================================================== */

import { useState } from "react";

import { useAuthStore } from "../store/useAuthStore";
import { IconCloud } from "./icons";
import { Button } from "./kit/Button";
import { Dialog } from "./kit/Dialog";
import { Segmented } from "./kit/Segmented";

export function AuthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    <Dialog open={open} onClose={onClose} width={400}>
      <span className="surface curve mb-5 flex h-11 w-11 items-center justify-center text-fg-2" style={{ ["--r" as string]: "14px" }}>
        <IconCloud className="h-5 w-5" />
      </span>
      <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-fg">云同步</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-fg-3">
        可选功能。不登录也能用；登录后简历档案自动云同步，换设备也能恢复。
      </p>

      <Segmented
        className="mt-5 w-full [&>button]:flex-1"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { value: "signin", label: "登录" },
          { value: "signup", label: "注册" },
        ]}
      />

      <form
        className="mt-4 space-y-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱"
          autoComplete="email"
          className="field"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码（至少 6 位）"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className="field"
        />
        {error && <p className="anim-fade pt-1 text-[12.5px] text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="ghost" size="md" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={busy}>
            {busy ? "处理中…" : mode === "signin" ? "登录" : "注册"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
