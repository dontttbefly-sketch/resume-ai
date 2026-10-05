/* ============================================================================
 * 用户管理（线上版站长专属）
 *
 * 熟人注册后出现在这里。收到转账 → 找到他（按称呼 / 邮箱 / 备注搜）→「加额度」。
 * 额度单位是 token，输入按「万」算；每次加减都会记一笔，展开「记录」能看到。
 * 也能停用账号、重置密码（生成临时密码，你转告他）、改新用户的赠送额度。
 * ========================================================================== */

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import { adminApi, fmtAgo, fmtTokens, useAccount, type AdminUser, type Grant } from "../../lib/account";
import { useUiStore } from "../../store/useUiStore";
import { IconCopy, IconPlus, IconRefresh, IconSearch, IconUser } from "../icons";
import { Button, IconButton } from "../kit/Button";
import { confirmDialog, Dialog } from "../kit/Dialog";
import { FieldLabel } from "../kit/Field";
import { EmptyState, Spinner } from "../kit/misc";
import { Segmented } from "../kit/Segmented";
import { toast } from "../kit/Toast";

const QUICK = [10, 30, 50, 100];

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function copy(text: string) {
  void navigator.clipboard?.writeText(text).then(
    () => toast("已复制", "success"),
    () => toast("复制失败，手动选中复制吧", "error"),
  );
}

/* ------------------------------ 加 / 扣额度 ------------------------------ */

function GrantDialog({ user, onClose, onDone }: { user: AdminUser | null; onClose: () => void; onDone: (u: AdminUser) => void }) {
  const [sign, setSign] = useState<"add" | "sub">("add");
  const [wan, setWan] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setSign("add");
    setWan("");
    setNote("");
  }, [user]);

  const amount = Math.round((Number(wan) || 0) * 10_000);
  const delta = sign === "add" ? amount : -amount;

  const submit = async () => {
    if (!user || amount <= 0) return;
    setBusy(true);
    try {
      const { user: next } = await adminApi.grant(user.id, delta, note.trim());
      onDone(next);
      toast(`${sign === "add" ? "已给" : "已扣"}「${user.nick || user.email}」${fmtTokens(amount)} token`, "success");
      onClose();
    } catch (e) {
      toast(errText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={user != null} onClose={onClose} width={420}>
      {user && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-fg">
            {sign === "add" ? "加额度" : "扣额度"} · {user.nick || user.email}
          </h2>
          <p className="mt-1.5 text-[13px] text-fg-3">现在还剩 {fmtTokens(user.quota)} token</p>

          <Segmented<"add" | "sub">
            className="mt-5 w-full [&>button]:flex-1"
            value={sign}
            onChange={setSign}
            options={[
              { value: "add", label: "加" },
              { value: "sub", label: "扣" },
            ]}
          />

          <div className="mt-4 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setWan(String(q))}
                className={`chip press ${Number(wan) === q ? "chip-solid" : ""}`}
              >
                {q} 万
              </button>
            ))}
          </div>

          <label className="mt-4 block space-y-1.5">
            <FieldLabel hint="1 万 = 10,000 token">数量</FieldLabel>
            <div className="relative">
              <input
                autoFocus
                inputMode="decimal"
                value={wan}
                onChange={(e) => setWan(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="比如 50"
                className="field pr-20"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-fg-4">万 token</span>
            </div>
          </label>
          <label className="mt-3 block space-y-1.5">
            <FieldLabel>备注</FieldLabel>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="比如：微信转账 20 元" className="field" />
          </label>

          <p className="mt-4 text-[12.5px] text-fg-3">
            {amount > 0 ? (
              <>
                {sign === "add" ? "加完" : "扣完"}剩 <span className="tnum font-semibold text-fg">{fmtTokens(user.quota + delta)}</span> token
              </>
            ) : (
              " "
            )}
          </p>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" size="md" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" variant={sign === "add" ? "primary" : "danger"} size="md" disabled={busy || amount <= 0}>
              {busy ? "处理中…" : sign === "add" ? "确定加" : "确定扣"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/* ------------------------------ 临时密码 ------------------------------ */

function TempPasswordDialog({ info, onClose }: { info: { who: string; email: string; password: string } | null; onClose: () => void }) {
  return (
    <Dialog open={info != null} onClose={onClose} width={400}>
      {info && (
        <>
          <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-fg">密码已重置</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-3">
            把下面的临时密码发给「{info.who}」，他用邮箱 <span className="font-medium text-fg">{info.email}</span> 登录后，可以在头像菜单里改成自己的密码。
          </p>
          <div className="surface mt-5 flex items-center gap-3 px-4 py-3" style={{ ["--r" as string]: "var(--r-card)" }}>
            <span className="tnum flex-1 select-all font-mono text-[20px] tracking-[0.12em] text-fg">{info.password}</span>
            <IconButton label="复制" size="md" pill onClick={() => copy(info.password)}>
              <IconCopy className="h-4 w-4" />
            </IconButton>
          </div>
          <div className="flex justify-end pt-5">
            <Button variant="primary" size="md" onClick={onClose}>
              好了
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

/* ------------------------------ 一个用户 ------------------------------ */

function GrantList({ id }: { id: string }) {
  const [list, setList] = useState<Grant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.grants(id).then(
      (r) => setList(r.grants),
      (e) => setError(errText(e)),
    );
  }, [id]);

  if (error) return <p className="py-2 text-[12px] text-danger">{error}</p>;
  if (!list)
    return (
      <p className="flex items-center gap-2 py-2 text-[12px] text-fg-4">
        <Spinner /> 加载记录…
      </p>
    );
  if (!list.length) return <p className="py-2 text-[12px] text-fg-4">还没有额度变动</p>;
  return (
    <ul className="divide-y divide-hairline">
      {list.map((g, i) => (
        <li key={i} className="flex items-baseline gap-3 py-1.5 text-[12px]">
          <span className="tnum w-[92px] shrink-0 text-fg-4">
            {new Date(g.t).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className={`tnum w-[76px] shrink-0 font-medium ${g.delta > 0 ? "text-fg" : "text-danger"}`}>
            {g.delta > 0 ? "+" : "−"}
            {fmtTokens(Math.abs(g.delta))}
          </span>
          <span className="min-w-0 flex-1 truncate text-fg-3">{g.note || "—"}</span>
          <span className="shrink-0 text-fg-4">{g.by}</span>
        </li>
      ))}
    </ul>
  );
}

function UserCard({
  user,
  onChange,
  onGrant,
  onReset,
}: {
  user: AdminUser;
  onChange: (u: AdminUser) => void;
  onGrant: (u: AdminUser) => void;
  onReset: (u: AdminUser) => void;
}) {
  const [note, setNote] = useState(user.note);
  const [showLog, setShowLog] = useState(false);
  const [logKey, setLogKey] = useState(0);
  const owner = user.role === "owner";
  const empty = !owner && !user.ownLlm && user.quota <= 0;

  useEffect(() => setNote(user.note), [user.note]);
  // 额度变了（刚加过），展开着的记录重新拉一次
  useEffect(() => setLogKey((k) => k + 1), [user.quota]);

  const saveNote = async () => {
    if (note.trim() === user.note) return;
    try {
      onChange((await adminApi.note(user.id, note.trim())).user);
    } catch (e) {
      toast(errText(e), "error");
    }
  };

  const toggleDisabled = async () => {
    const disabling = !user.disabled;
    if (
      disabling &&
      !(await confirmDialog({
        title: `停用「${user.nick || user.email}」？`,
        body: "停用后他立刻登不进来，也调不了 AI（包括本机执行器）。额度保留，之后可以恢复。",
        confirmText: "停用",
        danger: true,
      }))
    )
      return;
    try {
      onChange((await adminApi.disable(user.id, disabling)).user);
      toast(disabling ? "已停用" : "已恢复", "success");
    } catch (e) {
      toast(errText(e), "error");
    }
  };

  return (
    <div
      className={`surface lift anim-rise px-4 pb-3 pt-3.5 ${user.disabled ? "opacity-60" : ""}`}
      style={{ ["--r" as string]: "var(--r-card)" }}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${owner ? "solid" : "bg-fill-2 text-fg-2"}`}
        >
          {(user.nick || user.email).slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
            <span className="truncate text-[14.5px] font-semibold tracking-[-0.01em] text-fg">{user.nick || user.email}</span>
            <span className="truncate text-[12px] text-fg-4">{user.email}</span>
            {owner && <span className="chip chip-sm chip-solid">站长</span>}
            {user.disabled && <span className="chip chip-sm chip-outline !text-danger">已停用</span>}
            {user.ownLlm && <span className="chip chip-sm chip-outline">自带密钥</span>}
          </p>
          <p className="mt-0.5 text-[11.5px] text-fg-4">
            {new Date(user.created).toLocaleDateString("zh-CN")} 注册 · 最近用 AI：{fmtAgo(user.last)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {owner ? (
            <p className="display-num text-[26px] text-fg">不限</p>
          ) : (
            <p className="flex items-baseline justify-end gap-1">
              <span className={`display-num text-[28px] ${empty ? "text-danger" : "text-fg"}`}>{fmtTokens(user.quota)}</span>
              <span className="text-[11px] text-fg-4">剩</span>
            </p>
          )}
          <p className="tnum mt-1 text-[11px] text-fg-4">
            已用 {fmtTokens(user.used)} · {user.calls} 次
          </p>
        </div>
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => void saveNote()}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder="备注（比如：同事小王，转了 20 元）"
        spellCheck={false}
        className="ghost mt-2 text-[12.5px] text-fg-2"
      />

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {!owner && (
          <Button variant="primary" size="sm" pill icon={<IconPlus className="h-3.5 w-3.5" />} onClick={() => onGrant(user)}>
            加额度
          </Button>
        )}
        <Button variant="ghost" size="sm" pill onClick={() => setShowLog((v) => !v)}>
          {showLog ? "收起记录" : "记录"}
        </Button>
        {!owner && (
          <>
            <Button variant="ghost" size="sm" pill onClick={() => onReset(user)}>
              重置密码
            </Button>
            <Button variant="ghost" size="sm" pill className={user.disabled ? "" : "hover:!text-danger"} onClick={() => void toggleDisabled()}>
              {user.disabled ? "恢复" : "停用"}
            </Button>
          </>
        )}
        {user.byokUsed > 0 && <span className="ml-auto text-[11px] text-fg-4">自带密钥用了 {fmtTokens(user.byokUsed)}</span>}
      </div>

      <div className="disclose" data-open={showLog}>
        <div>
          {showLog && (
            <div className="mt-2 border-t border-hairline pt-1.5">
              <GrantList key={logKey} id={user.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ 站点设置 ------------------------------ */

function SignupSetting({ value, onSaved }: { value: number; onSaved: (n: number) => void }) {
  const [wan, setWan] = useState(String(value / 10_000));
  const [busy, setBusy] = useState(false);
  useEffect(() => setWan(String(value / 10_000)), [value]);
  const n = Math.round((Number(wan) || 0) * 10_000);
  const dirty = n !== value;

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!dirty) return;
        setBusy(true);
        try {
          onSaved((await adminApi.config(n)).config.signupTokens);
          toast("新用户赠送额度已更新", "success");
        } catch (err) {
          toast(errText(err), "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="relative">
        <input
          inputMode="decimal"
          value={wan}
          onChange={(e) => setWan(e.target.value.replace(/[^\d.]/g, ""))}
          className="field tnum w-[132px] !py-1.5 pr-[58px] text-right"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-fg-4">万 token</span>
      </div>
      {dirty && (
        <Button type="submit" variant="primary" size="sm" pill disabled={busy} className="anim-fade">
          保存
        </Button>
      )}
    </form>
  );
}

/* ------------------------------ 页面 ------------------------------ */

export function AdminView() {
  const me = useAccount((s) => s.me);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [signup, setSignup] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim().toLowerCase());
  const [granting, setGranting] = useState<AdminUser | null>(null);
  const [temp, setTemp] = useState<{ who: string; email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.list();
      setUsers(r.users);
      setSignup(r.config.signupTokens);
      setError(null);
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 上次站长停在这一页、这次换了普通账号登录：回到简历
  useEffect(() => {
    if (me && me.role !== "owner") useUiStore.getState().setView("studio");
  }, [me]);

  const update = (u: AdminUser) => setUsers((list) => list?.map((x) => (x.id === u.id ? u : x)) ?? null);

  const reset = async (u: AdminUser) => {
    const ok = await confirmDialog({
      title: `重置「${u.nick || u.email}」的密码？`,
      body: "会生成一个临时密码，他在其他设备上的登录随之失效。",
      confirmText: "重置",
    });
    if (!ok) return;
    try {
      const r = await adminApi.resetPassword(u.id);
      update(r.user);
      setTemp({ who: u.nick || u.email, email: u.email, password: r.password });
    } catch (e) {
      toast(errText(e), "error");
    }
  };

  const shown = useMemo(
    () =>
      (users ?? []).filter(
        (u) => !query || [u.nick, u.email, u.note].some((x) => x.toLowerCase().includes(query)),
      ),
    [users, query],
  );

  const stats = useMemo(() => {
    const list = users ?? [];
    const week = Date.now() - 7 * 86_400_000;
    return {
      count: list.length,
      active: list.filter((u) => u.last > week).length,
      used: list.reduce((s, u) => s + u.used, 0),
      left: list.filter((u) => u.role !== "owner").reduce((s, u) => s + Math.max(0, u.quota), 0),
    };
  }, [users]);

  return (
    <div className="thin-scroll absolute inset-0 overflow-y-auto px-6 pb-12 pt-[100px]">
      <div className="mx-auto max-w-[1360px] space-y-6">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <p className="text-[30px] font-semibold leading-none tracking-[-0.035em] text-fg">用户</p>
            <p className="mt-2.5 text-[13px] text-fg-3">注册的人都在这里。收到转账后，找到对应的人给他加 AI 额度</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-4" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜称呼 / 邮箱 / 备注…"
                className="field w-60 !rounded-full !py-2 pl-9"
              />
            </div>
            <IconButton label="刷新" size="md" pill onClick={() => void load()} disabled={loading}>
              <IconRefresh className={`h-4 w-4 ${loading ? "spin" : ""}`} />
            </IconButton>
          </div>
        </div>

        {users && (
          <div className="surface anim-rise flex flex-wrap items-center gap-x-10 gap-y-4 px-5 py-4" style={{ ["--r" as string]: "var(--r-card)" }}>
            {[
              { label: "用户", value: String(stats.count), sub: `近 7 天用过 AI 的 ${stats.active} 人` },
              { label: "大家还剩", value: fmtTokens(stats.left), sub: "token（不含站长）" },
              { label: "累计消耗", value: fmtTokens(stats.used), sub: "token（走站长的模型）" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[11.5px] text-fg-4">{s.label}</p>
                <p className="display-num mt-1.5 text-[30px] text-fg">{s.value}</p>
                <p className="mt-1 text-[11px] text-fg-4">{s.sub}</p>
              </div>
            ))}
            <div className="ml-auto">
              <p className="mb-1.5 text-[11.5px] text-fg-4">新用户注册送</p>
              <SignupSetting value={signup} onSaved={setSignup} />
            </div>
          </div>
        )}

        {error ? (
          <EmptyState className="min-h-[420px]" icon={<IconUser className="h-6 w-6" />} title="打不开用户列表">
            {error}
          </EmptyState>
        ) : !users ? (
          <p className="flex min-h-[320px] items-center justify-center gap-2 text-[13px] text-fg-4">
            <Spinner /> 加载中…
          </p>
        ) : shown.length === 0 ? (
          <p className="py-20 text-center text-[13px] text-fg-4">{users.length ? "没搜到" : "还没有人注册"}</p>
        ) : (
          <div className="grid items-start gap-2.5 xl:grid-cols-2">
            {shown.map((u) => (
              <UserCard key={u.id} user={u} onChange={update} onGrant={setGranting} onReset={(x) => void reset(x)} />
            ))}
          </div>
        )}
      </div>

      <GrantDialog user={granting} onClose={() => setGranting(null)} onDone={update} />
      <TempPasswordDialog info={temp} onClose={() => setTemp(null)} />
    </div>
  );
}
