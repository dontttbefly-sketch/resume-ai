/* ============================================================================
 * 投递视图：BOSS 直聘逐张投递（boss-zhipin-assistant-egolite 的网页外壳）
 *
 *   ┌ 指标：今日 / 累计 / 判否 / 当前位置 ───────────────────────────────┐
 *   │ 当前这一张（卡片 → JD → AI 结论 → 投 / 跳）  │ 投递方式（手动 / 自动） │
 *   │ 今日动态（含终端里智能体投的）              │ 判岗画像（规则可编辑）  │
 *   └ 已投递档案（搜索 / 按行业、方向分组）────────────────────────────────┘
 *
 * 浏览器操作全部由技能脚本完成（经 server/bossBridge.ts），网页不直接碰 BOSS。
 * ========================================================================== */

import { useEffect } from "react";

import { HAS_BRIDGE, REPORT_URL } from "../../lib/bossApi";
import { useBossStore } from "../../store/useBossStore";
import { IconExternal, IconInfo, IconPlane, IconRefresh, IconWarn, IconX } from "../icons";
import { Button, IconButton } from "../kit/Button";
import { EmptyState, Spinner, StatusDot } from "../kit/misc";
import { Archive } from "./Archive";
import { ControlPanel } from "./ControlPanel";
import { LiveDeck } from "./LiveDeck";
import { ProfilePanel } from "./ProfilePanel";
import { StatTiles } from "./StatTiles";
import { Timeline } from "./Timeline";

function Header() {
  const conn = useBossStore((s) => s.conn);
  const external = useBossStore((s) => s.snap?.external);
  const busy = useBossStore((s) => s.snap?.busy);
  const phase = useBossStore((s) => s.phase);
  const checkEnv = useBossStore((s) => s.checkEnv);
  const env = useBossStore((s) => s.env);

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div>
        <p className="text-[30px] font-semibold leading-none tracking-[-0.035em] text-fg">投递</p>
        <p className="mt-2.5 text-[13px] text-fg-3">BOSS 直聘 · 一张一张读、判、投，判断和投递在同一个页面状态里完成</p>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className="surface flex h-9 items-center gap-2 px-3.5 text-[12.5px] text-fg-2" style={{ ["--r" as string]: "999px" }}>
          {external?.active ? (
            <>
              <StatusDot tone="on" live />
              智能体正在终端里投递 · 实时同步中
            </>
          ) : busy ? (
            <>
              <StatusDot tone="on" live />
              浏览器执行中
            </>
          ) : conn === "online" ? (
            <>
              <StatusDot tone="on" />
              本机服务已连接
            </>
          ) : (
            <>
              <StatusDot tone="off" />
              连接中
            </>
          )}
        </span>
        <Button
          size="md"
          pill
          disabled={phase !== "idle" || external?.active}
          onClick={() => void checkEnv()}
          icon={phase === "checking" ? <Spinner /> : <IconRefresh className="h-4 w-4" />}
        >
          检测环境
        </Button>
        <Button size="md" pill onClick={() => window.open(REPORT_URL, "_blank", "noopener")} icon={<IconExternal className="h-4 w-4" />}>
          汇报页
        </Button>
      </div>
      {env && (
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

  const text = notice?.text ?? `${external!.reason}。网页这边先只看不动，等它停下大约一分钟后就能接手。`;
  const tone = notice?.tone ?? "warn";
  return (
    <div className="surface anim-rise flex items-start gap-3 px-4 py-3" style={{ ["--r" as string]: "16px" }}>
      {tone === "error" ? (
        <IconWarn className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      ) : (
        <IconInfo className="mt-0.5 h-4 w-4 shrink-0 text-fg-3" />
      )}
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
  const reason = useBossStore((s) => s.offlineReason);
  const snap = useBossStore((s) => s.snap);
  const startPolling = useBossStore((s) => s.startPolling);
  const locked = Boolean(snap?.external?.active);

  useEffect(() => (HAS_BRIDGE ? startPolling() : undefined), [startPolling]);

  if (!HAS_BRIDGE || (conn === "offline" && !snap)) {
    return (
      <div className="absolute inset-0 flex items-center justify-center px-6 pt-20">
        <EmptyState
          icon={<IconPlane className="h-6 w-6" />}
          title="投递服务需要在本机运行"
          action={
            HAS_BRIDGE ? (
              <Button variant="primary" size="md" pill onClick={() => void useBossStore.getState().refresh()} icon={<IconRefresh className="h-4 w-4" />}>
                重新连接
              </Button>
            ) : undefined
          }
        >
          <p>{HAS_BRIDGE ? reason : "它要驱动你电脑上已登录 BOSS 的 Ego 浏览器，线上版本没法做到。"}</p>
          <p className="mt-3 text-fg-4">
            本机启动工作台（<code className="kbd">pnpm dev</code>），确认 Ego Lite 已打开并登录 BOSS 直聘，技能目录在项目根下的{" "}
            <code className="kbd">boss-zhipin-assistant-egolite/</code>。
          </p>
        </EmptyState>
      </div>
    );
  }

  if (!snap) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pt-20">
        <Spinner className="h-5 w-5 text-fg-3" />
      </div>
    );
  }

  return (
    <div className="thin-scroll absolute inset-0 overflow-y-auto px-6 pb-12 pt-[100px]">
      <div className="mx-auto max-w-[1360px] space-y-5">
        <Header />
        <NoticeBar />
        <StatTiles />
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 space-y-4">
            <LiveDeck locked={locked} />
            <Timeline />
          </div>
          <div className="space-y-4">
            <ControlPanel locked={locked} />
            <ProfilePanel />
          </div>
        </div>
        <Archive />
      </div>
    </div>
  );
}
