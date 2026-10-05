/* ============================================================================
 * 进度区：今天投了多少 · 正在做什么 · 关键词计划走到哪 · 开始 / 暂停
 * ========================================================================== */

import type { Phase } from "../../lib/bossApi";
import { DAILY_CAP, useBossStore } from "../../store/useBossStore";
import { IconCheck, IconMinus, IconPause, IconPlay, IconPlus } from "../icons";
import { Button, IconButton } from "../kit/Button";
import { NumberTicker, ShimmerText, Switch } from "../kit/misc";
import { useSpotlight } from "../kit/useSpotlight";

const PHASE_TEXT: Partial<Record<Phase, string>> = {
  walking: "找下一张卡",
  scrolling: "滚动加载更多岗位",
  opening: "打开 JD",
  judging: "AI 正在判断",
  delivering: "投递中，等「送达」回读",
  rejecting: "记录跳过",
  exhausting: "把推荐页翻到底",
  checking: "检测环境",
};

function sourceName(s: string) {
  return s ? s : "推荐页";
}

/** 关键词计划：走过的打勾，当前的实心，没到的描边 */
function PlanTrack() {
  const plan = useBossStore((s) => s.plan);
  if (!plan) return null;
  const curIdx = plan.sources.indexOf(plan.current);
  const items = curIdx >= 0 ? plan.sources : [plan.current, ...plan.sources];
  const at = curIdx >= 0 ? curIdx : 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((src, i) => (
        <span key={`${src}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <span className="h-px w-3 bg-hairline-2" />}
          <span
            className={`chip ${i === at ? "chip-solid" : i < at ? "" : "chip-outline"}`}
            title={i < at ? "已翻完" : i === at ? "当前" : "接下来"}
          >
            {i < at && <IconCheck className="h-3 w-3" />}
            {sourceName(src)}
          </span>
        </span>
      ))}
    </div>
  );
}

export function RunHero({ locked }: { locked: boolean }) {
  const snap = useBossStore((s) => s.snap);
  const auto = useBossStore((s) => s.auto);
  const phase = useBossStore((s) => s.phase);
  const card = useBossStore((s) => s.card);
  const busy = useBossStore((s) => s.snap?.busy);
  const start = useBossStore((s) => s.start);
  const pause = useBossStore((s) => s.pause);
  const setConfirm = useBossStore((s) => s.setConfirm);
  const setDailyTarget = useBossStore((s) => s.setDailyTarget);
  const spot = useSpotlight<HTMLElement>();

  const today = snap?.today.delivered ?? 0;
  const target = Math.min(auto.dailyTarget, DAILY_CAP);
  const pct = Math.min(1, today / Math.max(1, target));
  const working = phase !== "idle" && phase !== "awaiting";
  const s = card?.surface;

  let now: React.ReactNode;
  if (auto.running && auto.awaiting) now = <span className="text-fg">等你决定：投还是跳（逐张确认）</span>;
  else if (auto.running && working)
    now = (
      <ShimmerText>
        {PHASE_TEXT[phase]}
        {s && phase !== "walking" && phase !== "scrolling" ? ` · ${s.title}` : ""}
      </ShimmerText>
    );
  else if (auto.running) now = <span className="text-fg-3">稍等片刻（像人一样，每张之间留一点间隔）</span>;
  else if (auto.stopping) now = <ShimmerText>把当前这一步做完就停…</ShimmerText>;
  else now = <span className="text-fg-3">{auto.stopReason ? `已停下：${auto.stopReason}` : "待命中：点「开始」，执行器就会在终端里自动投"}</span>;

  return (
    <section ref={spot} className="glass spot p-7" style={{ ["--r" as string]: "var(--r-panel)" }}>
      <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
        {/* 今日进度 */}
        <div className="min-w-[280px] flex-1">
          <p className="text-[12px] font-medium tracking-[0.04em] text-fg-3">今日进度</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="display-num text-[56px] text-fg">
              <NumberTicker value={today} />
            </span>
            <span className="tnum pb-2 text-[16px] text-fg-4">/ {target} 份</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-fill-3">
            <div
              className="h-full rounded-full bg-fg"
              style={{ width: `${pct * 100}%`, transition: "width 900ms var(--ease-out-quint)" }}
            />
          </div>
          <p className="tnum mt-3 text-[12px] text-fg-4">
            累计投递 {snap?.counts.delivered ?? 0} 份 · 判过不投 {snap?.walk.rejectedCount ?? 0} 张 · BOSS 每天上限 150，按惯例 {DAILY_CAP} 收工
          </p>
        </div>

        {/* 控制 */}
        <div className="flex w-full flex-col gap-3 sm:w-[280px]">
          <Button
            variant={auto.running ? "secondary" : "primary"}
            size="lg"
            pill
            className="w-full !h-12 !text-[15px]"
            disabled={(locked && !auto.running) || (!auto.running && Boolean(busy))}
            onClick={() => void (auto.running ? pause() : start())}
            icon={auto.running ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
          >
            {auto.running ? "暂停" : "开始"}
          </Button>
          <div className="surface flex items-center gap-2 px-3 py-2" style={{ ["--r" as string]: "14px" }}>
            <span className="flex-1 text-[12.5px] text-fg-2">每天目标</span>
            <IconButton label="少 5 份" size="xs" pill onClick={() => void setDailyTarget(target - 5)}>
              <IconMinus className="h-3.5 w-3.5" />
            </IconButton>
            <span className="tnum w-9 text-center text-[15px] font-semibold text-fg">{target}</span>
            <IconButton label="多 5 份" size="xs" pill onClick={() => void setDailyTarget(target + 5)}>
              <IconPlus className="h-3.5 w-3.5" />
            </IconButton>
          </div>
          <label className="surface flex cursor-pointer items-center gap-2 px-3 py-2" style={{ ["--r" as string]: "14px" }}>
            <span className="flex-1">
              <span className="block text-[12.5px] text-fg-2">逐张确认</span>
              <span className="block text-[11px] text-fg-4">{auto.confirm ? "每张判完等你点投或跳" : "关：AI 判完直接投或跳"}</span>
            </span>
            <Switch label="逐张确认" checked={auto.confirm} onChange={(v) => void setConfirm(v)} />
          </label>
        </div>
      </div>

      {/* 正在 / 计划 */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 pt-5 hair-t">
        <p className="flex min-w-0 flex-1 items-center gap-2.5 text-[13.5px]">
          <span className="relative flex h-2 w-2 shrink-0">
            {auto.running && <span className="ping absolute inset-0 rounded-full bg-fg" />}
            <span className={`relative h-2 w-2 rounded-full ${auto.running ? "bg-fg" : "bg-fg-4"}`} />
          </span>
          <span className="min-w-0 truncate">{now}</span>
        </p>
        <PlanTrack />
      </div>
    </section>
  );
}
