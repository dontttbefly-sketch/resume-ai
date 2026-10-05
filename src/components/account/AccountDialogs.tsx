/* ============================================================================
 * 账号对话框（线上版）
 *   AiQuotaDialog   AI 额度 + 自带模型密钥（填了就不扣额度）
 *   PasswordDialog  改密码
 * ========================================================================== */

import { useState, type ReactNode } from "react";

import { changePassword, clearOwnLlm, fmtTokens, saveOwnLlm, useAccount } from "../../lib/account";
import { IconKey, IconSpark } from "../icons";
import { Button } from "../kit/Button";
import { Dialog } from "../kit/Dialog";
import { FieldLabel } from "../kit/Field";
import { Segmented } from "../kit/Segmented";
import { toast } from "../kit/Toast";

/* 常见的兼容 OpenAI 接口的模型服务；模型名可以改 */
const PRESETS = {
  minimax: { label: "MiniMax", baseUrl: "https://api.minimaxi.com/v1", model: "MiniMax-M3" },
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  custom: { label: "其他", baseUrl: "", model: "" },
} as const;
type Preset = keyof typeof PRESETS;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function DialogHead({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <>
      <span className="surface curve mb-5 flex h-11 w-11 items-center justify-center text-fg-2" style={{ ["--r" as string]: "14px" }}>
        {icon}
      </span>
      <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-fg">{title}</h2>
      {children && <p className="mt-1.5 text-[13px] leading-relaxed text-fg-3">{children}</p>}
    </>
  );
}

function OwnLlmForm({ onSaved }: { onSaved: () => void }) {
  const [preset, setPreset] = useState<Preset>("minimax");
  const [baseUrl, setBaseUrl] = useState<string>(PRESETS.minimax.baseUrl);
  const [model, setModel] = useState<string>(PRESETS.minimax.model);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (p: Preset) => {
    setPreset(p);
    setBaseUrl(PRESETS[p].baseUrl);
    setModel(PRESETS[p].model);
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (!baseUrl.trim() || !model.trim() || !apiKey.trim()) {
      setError("接口地址、模型名、密钥都要填。");
      return;
    }
    setBusy(true);
    try {
      await saveOwnLlm({ baseUrl: baseUrl.trim(), model: model.trim(), apiKey: apiKey.trim() });
      toast("已切换到你自己的模型", "success");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Segmented<Preset>
        size="sm"
        className="w-full [&>button]:flex-1"
        value={preset}
        onChange={pick}
        options={(Object.keys(PRESETS) as Preset[]).map((p) => ({ value: p, label: PRESETS[p].label }))}
      />
      <label className="block space-y-1.5">
        <FieldLabel hint="兼容 OpenAI 的 /chat/completions">接口地址</FieldLabel>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…/v1" spellCheck={false} className="field" />
      </label>
      <label className="block space-y-1.5">
        <FieldLabel>模型名</FieldLabel>
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="模型名" spellCheck={false} className="field" />
      </label>
      <label className="block space-y-1.5">
        <FieldLabel hint="加密保存，只用来替你调模型">API 密钥</FieldLabel>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-…"
          autoComplete="off"
          spellCheck={false}
          className="field"
        />
      </label>
      {error && <p className="anim-fade text-[12.5px] text-danger">{error}</p>}
      <div className="flex justify-end pt-1">
        <Button type="submit" variant="primary" size="md" pill disabled={busy}>
          {busy ? "正在试调…" : "试调一次并保存"}
        </Button>
      </div>
    </form>
  );
}

export function AiQuotaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useAccount((s) => s.me);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!me) return null;

  const owner = me.role === "owner";
  const own = me.ownLlm;

  return (
    <Dialog
      open={open}
      onClose={() => {
        setEditing(false);
        onClose();
      }}
      width={440}
    >
      <DialogHead icon={<IconSpark className="h-5 w-5" />} title="AI 额度">
        改简历、写话术、挖经历、判岗位，每次调用按模型实际消耗的 token 扣额度。用完了找站长加。
      </DialogHead>

      <div className="surface mt-5 px-5 py-4" style={{ ["--r" as string]: "var(--r-card)" }}>
        {own ? (
          <>
            <p className="text-[12px] text-fg-3">正在用你自己的模型，不扣额度</p>
            <p className="mt-2 text-[15px] font-semibold text-fg">{own.model}</p>
            <p className="mt-0.5 truncate text-[12px] text-fg-3">
              {hostOf(own.baseUrl)} · 密钥尾号 {own.keyTail}
            </p>
            <p className="mt-3 text-[12px] text-fg-4">站长那边的额度还剩 {fmtTokens(me.quota)} token，改回去就接着用。</p>
          </>
        ) : owner ? (
          <>
            <p className="text-[12px] text-fg-3">站长账号</p>
            <p className="display-num mt-2 text-[40px] text-fg">不限</p>
            <p className="mt-3 text-[12px] text-fg-4">累计用了 {fmtTokens(me.used)} token · {me.calls} 次</p>
          </>
        ) : (
          <>
            <p className="text-[12px] text-fg-3">还剩</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className={`display-num text-[44px] ${me.quota > 0 ? "text-fg" : "text-danger"}`}>{fmtTokens(me.quota)}</span>
              <span className="text-[13px] text-fg-3">token</span>
            </p>
            <p className="mt-3 text-[12px] text-fg-4">
              已用 {fmtTokens(me.used)} token · {me.calls} 次
            </p>
          </>
        )}
      </div>

      <div className="mt-6">
        <p className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
          <IconKey className="h-4 w-4 text-fg-3" />
          用自己的模型密钥
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">
          有自己的 MiniMax、DeepSeek 等密钥的话填在这里，之后所有 AI 功能（包括本机执行器判岗）都走你的密钥，不扣额度。
        </p>
        {own && !editing ? (
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              size="md"
              pill
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await clearOwnLlm();
                  toast("已改回用站长的模型", "success");
                } catch (e) {
                  toast(e instanceof Error ? e.message : String(e), "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              改回用站长的
            </Button>
            <Button variant="secondary" size="md" pill onClick={() => setEditing(true)}>
              换一个密钥
            </Button>
          </div>
        ) : (
          <OwnLlmForm onSaved={() => setEditing(false)} />
        )}
      </div>
    </Dialog>
  );
}

export function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [old, setOld] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOld("");
    setNext("");
    setAgain("");
    setError(null);
    onClose();
  };

  const submit = async () => {
    setError(null);
    if (next.length < 6) return setError("新密码至少 6 位。");
    if (next !== again) return setError("两次输入的新密码不一样。");
    setBusy(true);
    try {
      await changePassword(old, next);
      toast("密码改好了，其他设备需要重新登录", "success");
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} width={400}>
      <DialogHead icon={<IconKey className="h-5 w-5" />} title="修改密码">
        改完之后，其他设备上的登录会失效，需要用新密码重新登录。
      </DialogHead>
      <form
        className="mt-5 space-y-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input type="password" value={old} onChange={(e) => setOld(e.target.value)} placeholder="原密码" autoComplete="current-password" className="field" />
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="新密码（至少 6 位）" autoComplete="new-password" className="field" />
        <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} placeholder="再输一次新密码" autoComplete="new-password" className="field" />
        {error && <p className="anim-fade pt-1 text-[12.5px] text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="ghost" size="md" onClick={close}>
            取消
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={busy || !old || !next}>
            {busy ? "处理中…" : "确定"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
