/* ============================================================================
 * 连接本机执行器：没启动 → 怎么启动；启动了 → 输入配对码
 * 嵌在投递页顶部，下面的看板照常显示（变暗，连上后可用）
 * ========================================================================== */

import { useState } from "react";

import { installCommand, inviteCode } from "../../lib/bossApi";
import { useOwnerData } from "../../lib/ownerData";
import { useBossStore } from "../../store/useBossStore";
import { IconCheck, IconCopy } from "../icons";
import { Button } from "../kit/Button";
import { toast } from "../kit/Toast";
import { useSpotlight } from "../kit/useSpotlight";

function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="well mt-2.5 flex items-center gap-2 py-1.5 pl-3.5 pr-1.5" style={{ borderRadius: 14 }}>
      <code className="thin-scroll min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-1 font-mono text-[12px] text-fg-2">{text}</code>
      <Button
        size="sm"
        pill
        variant={copied ? "primary" : "secondary"}
        icon={copied ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
        onClick={async () => {
          await navigator.clipboard.writeText(text).catch(() => {});
          setCopied(true);
          toast("已复制，去「终端」里粘贴回车", "success");
          window.setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? "已复制" : "复制"}
      </Button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <span className="tnum mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-solid text-[12px] font-semibold text-on-solid">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="pt-0.5 text-[13.5px] font-semibold text-fg">{title}</p>
        {children && <div className="mt-1 text-[12.5px] leading-relaxed text-fg-3">{children}</div>}
      </div>
    </li>
  );
}

export function SetupCard() {
  const conn = useBossStore((s) => s.conn);
  const runner = useBossStore((s) => s.runner);
  const pair = useBossStore((s) => s.pair);
  const ownerCmd = useOwnerData((s) => s.runnerCommand);
  const spot = useSpotlight<HTMLElement>();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const dev = import.meta.env.DEV;
  const digits = code.replace(/\D/g, "").slice(0, 8);
  const detected = conn === "unpaired";

  const submit = async () => {
    if (digits.length !== 8) return;
    setBusy(true);
    setError("");
    const ok = await pair(digits);
    setBusy(false);
    if (!ok) setError(detected ? "配对码不对：看一下终端里显示的 8 位数字" : "还没检测到执行器：先在终端里启动它");
  };

  return (
    <section ref={spot} className="glass spot anim-rise p-7" style={{ ["--r" as string]: "var(--r-panel)" }}>
      <div className="flex flex-wrap gap-x-10 gap-y-7">
        <div className="min-w-[300px] flex-1">
          <h2 className="text-[20px] font-semibold tracking-[-0.025em] text-fg">
            {detected ? "执行器已启动，输入配对码就能开始" : "先在你的 Mac 上启动执行器"}
          </h2>
          <p className="mt-1.5 max-w-[560px] text-[13px] leading-relaxed text-fg-3">
            投递在你自己的 Mac 上自动执行（用你登录了 BOSS 的浏览器）；这个页面用来看进度、改设置、点开始。关掉网页，执行器照样跑。
          </p>
          <ol className="mt-5 space-y-4">
            {!ownerCmd && (
              <Step n={1} title="装好 Ego Lite，在 Ego 浏览器里登录 BOSS 直聘">
                执行器通过 Ego 操作浏览器，登录一次后会一直记住。
              </Step>
            )}
            <Step n={ownerCmd ? 1 : 2} title={ownerCmd ? "在「终端」里运行（用你自己的投递数据）" : "打开「终端」，粘贴这一行并回车"}>
              {dev && !ownerCmd ? (
                <>
                  本地开发：项目目录里运行 <code className="kbd">pnpm runner</code>（你的投递数据）或 <code className="kbd">pnpm runner:demo</code>（演示，不碰浏览器）。
                </>
              ) : (
                <>
                  {!ownerCmd && <>已带上你的个人密钥，会装到 <code className="kbd">~/BossRunner</code>，以后双击里面的 start.command 启动。</>}
                  <CopyLine text={ownerCmd || installCommand(inviteCode())} />
                </>
              )}
            </Step>
            <Step n={ownerCmd ? 2 : 3} title="把终端里显示的 8 位配对码填到右边">
              第一次连接时 Chrome 会问能否访问「此设备上的其他应用和服务」，点允许。
            </Step>
          </ol>
        </div>

        <form
          className="w-full self-center sm:w-[300px]"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="flex items-center gap-2 text-[12.5px] text-fg-2">
            <span className="relative flex h-2 w-2">
              {!detected && <span className="breathe absolute inset-0 rounded-full bg-fg-4" />}
              <span className={`relative h-2 w-2 rounded-full ${detected ? "bg-fg" : "bg-fg-4"}`} />
            </span>
            {detected ? `执行器已启动 · v${runner?.version}${runner?.demo ? " · 演示模式" : ""}` : "正在等执行器启动…"}
          </p>
          <input
            value={digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="配对码 0000 0000"
            className="field tnum mt-3 h-12 text-center !font-mono !text-[20px] !tracking-[0.16em]"
          />
          <p className="mt-2 min-h-[18px] text-[12px] text-danger">{error}</p>
          <Button type="submit" variant="primary" size="lg" pill className="mt-1 w-full" disabled={digits.length !== 8 || busy}>
            {busy ? "连接中…" : "连接"}
          </Button>
        </form>
      </div>
    </section>
  );
}
