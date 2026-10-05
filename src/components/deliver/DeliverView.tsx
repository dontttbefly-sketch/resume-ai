/* ============================================================================
 * 投递视图：看进度、改设置、点开始；执行在用户自己 Mac 上的本机执行器里
 *
 *   ┌ 进度：今日 37/50 · 正在做什么 · 关键词计划走到哪 · 开始/暂停 · 逐张确认 ┐
 *   │ 当前这张（AI 结论，逐张确认时在这里决定）     │ 设置                     │
 *   │ 今天的漏斗 + 跳过原因                        │ 关键词计划 / 判岗画像     │
 *   │ 实时动态                                    │                          │
 *   └ 已投递档案 ──────────────────────────────────────────────────────────┘
 *
 * 没连上执行器时，顶部显示启动和配对引导，下面的看板变暗、不可点。
 * ========================================================================== */

import { useEffect } from "react";

import { reportUrl } from "../../lib/bossApi";
import { useBossStore } from "../../store/useBossStore";
import { IconExternal, IconInfo, IconRefresh, IconWarn, IconX } from "../icons";
import { Button, IconButton } from "../kit/Button";
import { Spinner, StatusDot } from "../kit/misc";
import { Archive } from "./Archive";
import { SetupCard } from "./Connect";
import { CurrentCard } from "./CurrentCard";
import { Funnel } from "./Funnel";
import { ProfilePanel } from "./ProfilePanel";
import { RunHero } from "./RunHero";
import { Timeline } from "./Timeline";

function Header({ connected }: { connected: boolean }) {
  const runner = useBossStore((s) => s.runner);
  const external = useBossStore((s) => s.snap?.external);
  const busy = useBossStore((s) => s.snap?.busy);
  const autoRunning = useBossStore((s) => s.auto.running);
  const phase = useBossStore((s) => s.phase);
  const checkEnv = useBossStore((s) => s.checkEnv);
  const unpair = useBossStore((s) => s.unpair);
  const env = useBossStore((s) => s.env);

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div>
        <p className="text-[30px] font-semibold leading-none tracking-[-0.035em] text-fg">投递</p>
        <p className="mt-2.5 text-[13px] text-fg-3">BOSS 直聘 · 这里看进度、改设置，你 Mac 上的执行器自动去投</p>
      </div>
      {connected && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="surface flex h-9 items-center gap-2 px-3.5 text-[12.5px] text-fg-2" style={{ ["--r" as string]: "999px" }}>
            {external?.active ? (
              <>
                <StatusDot tone="on" live />
                智能体正在终端里投递 · 实时同步中
              </>
            ) : autoRunning ? (
              <>
                <StatusDot tone="on" live />
                执行器运行中
              </>
            ) : (
              <>
                <StatusDot tone="on" />
                执行器待命 · v{runner?.version}
                {runner?.demo && " · 演示模式"}
              </>
            )}
          </span>
          <Button
            size="md"
            pill
            disabled={Boolean(busy) || autoRunning || external?.active}
            onClick={() => void checkEnv()}
            icon={phase === "checking" ? <Spinner /> : <IconRefresh className="h-4 w-4" />}
          >
            检测环境
          </Button>
          <Button size="md" pill onClick={() => window.open(reportUrl(), "_blank", "noopener")} icon={<IconExternal className="h-4 w-4" />}>
            汇报页
          </Button>
          <Button size="md" pill variant="ghost" onClick={unpair} title="断开后需要重新输入配对码">
            断开
          </Button>
        </div>
      )}
      {connected && env && (
        <div className="anim-rise flex w-full flex-wrap gap-2">
          {env.map((it) => (
            <span key={it.name} className={`chip ${it.ok ? "" : "chip-outline !text-danger"}`} title={it.detail}>
              {it.ok ? "✓" : "✕"} {it.name}
              <span className="max-w-[260px] truncate font-normal text-fg-4">{it.detail}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function NoticeBar() {
  const notice = useBossStore((s) => s.notice);
  const dismiss = useBossStore((s) => s.dismissNotice);
  const external = useBossStore((s) => s.snap?.external);
  if (!notice && !external?.active) return null;

  const text = notice?.text ?? `${external!.reason}。网页这边先只看不动，等它停下大约一分钟后就能开始。`;
  const tone = notice?.tone ?? "warn";
  return (
    <div className="surface anim-rise flex items-start gap-3 px-4 py-3" style={{ ["--r" as string]: "16px" }}>
      {tone === "error" ? <IconWarn className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> : <IconInfo className="mt-0.5 h-4 w-4 shrink-0 text-fg-3" />}
      <p className="flex-1 text-[13px] leading-relaxed text-fg-2">{text}</p>
      {notice && (
        <IconButton label="知道了" size="xs" pill noTip onClick={dismiss}>
          <IconX className="h-3.5 w-3.5" />
        </IconButton>
      )}
    </div>
  );
}

export function DeliverView() {
  const conn = useBossStore((s) => s.conn);
  const snap = useBossStore((s) => s.snap);
  const startPolling = useBossStore((s) => s.startPolling);
  const locked = Boolean(snap?.external?.active);
  const connected = conn === "online" && Boolean(snap);

  useEffect(() => startPolling(), [startPolling]);

  return (
    <div className="thin-scroll absolute inset-0 overflow-y-auto px-6 pb-12 pt-[100px]">
      <div className="mx-auto max-w-[1360px] space-y-5">
        <Header connected={connected} />
        {conn === "checking" ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-5 w-5 text-fg-3" />
          </div>
        ) : (
          <>
            {!connected && <SetupCard />}
            {/* 没连上时看板照样显示（变暗、不可点），一眼知道连上后能看到什么 */}
            <div
              inert={!connected}
              className={`space-y-5 transition-opacity duration-500 ${connected ? "" : "pointer-events-none select-none opacity-40"}`}
            >
              {connected && <NoticeBar />}
              <RunHero locked={locked} />
              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="min-w-0 space-y-4">
                  <CurrentCard />
                  <Funnel />
                  <Timeline />
                </div>
                <ProfilePanel />
              </div>
              <Archive />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
