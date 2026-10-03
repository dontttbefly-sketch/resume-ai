/* ============================================================================
 * 投递方式：手动确认 / 自动投递
 *   手动：每张卡 AI 先判，你点投或跳 —— 默认，适合刚调完规则时盯一会儿
 *   自动：同样的流程连续跑，到目标数 / 今日上限 / 任何异常就停
 * ========================================================================== */

import { DAILY_CAP, useBossStore } from "../../store/useBossStore";
import { IconBolt, IconMinus, IconPause, IconPlay, IconPlus } from "../icons";
import { Button, IconButton } from "../kit/Button";
import { Ring } from "../kit/misc";
import { Segmented } from "../kit/Segmented";

export function ControlPanel({ locked }: { locked: boolean }) {
  const mode = useBossStore((s) => s.mode);
  const setMode = useBossStore((s) => s.setMode);
  const target = useBossStore((s) => s.target);
  const setTarget = useBossStore((s) => s.setTarget);
  const auto = useBossStore((s) => s.auto);
  const startAuto = useBossStore((s) => s.startAuto);
  const stopAuto = useBossStore((s) => s.stopAuto);
  const today = useBossStore((s) => s.snap?.today?.delivered ?? 0);
  const phase = useBossStore((s) => s.phase);

  const left = Math.max(0, DAILY_CAP - today);

  return (
    <section className="glass p-5" style={{ ["--r" as string]: "var(--r-panel)" }}>
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold tracking-[-0.01em] text-fg">投递方式</p>
        <Segmented
          size="sm"
          value={mode}
          onChange={(m) => {
            if (auto.running) stopAuto();
            setMode(m);
          }}
          options={[
            { value: "manual", label: "手动确认" },
            { value: "auto", label: "自动", icon: <IconBolt className="h-3.5 w-3.5" /> },
          ]}
        />
      </div>

      {mode === "manual" ? (
        <p key="m" className="anim-fade mt-4 text-[12.5px] leading-relaxed text-fg-3">
          每张卡 AI 先读 JD 给出建议，<span className="text-fg-2">投或跳由你来点</span>。刚改过判岗规则时用这个模式盯几张，确认 AI 判得和你想的一样。
        </p>
      ) : (
        <div key="a" className="anim-fade mt-4">
          <div className="flex items-center gap-4">
            <Ring value={auto.running || auto.done ? auto.done / target : 0} size={72} stroke={4}>
              <span className="tnum text-[17px] font-semibold leading-none text-fg">{auto.done}</span>
              <span className="tnum mt-0.5 text-[10px] text-fg-4">/ {target}</span>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-fg-3">本轮目标</p>
              <div className="mt-1 flex items-center gap-1">
                <IconButton label="减少" size="xs" pill disabled={auto.running} onClick={() => setTarget(target - 5)}>
                  <IconMinus className="h-3.5 w-3.5" />
                </IconButton>
                <input
                  value={target}
                  disabled={auto.running}
                  onChange={(e) => setTarget(Number(e.target.value.replace(/\D/g, "")))}
                  className="tnum w-12 bg-transparent text-center text-[20px] font-semibold tracking-[-0.02em] text-fg outline-none disabled:opacity-60"
                />
                <IconButton label="增加" size="xs" pill disabled={auto.running} onClick={() => setTarget(target + 5)}>
                  <IconPlus className="h-3.5 w-3.5" />
                </IconButton>
                <span className="ml-1 text-[11.5px] text-fg-4">份 · 今日还能投 {left}</span>
              </div>
            </div>
          </div>

          <Button
            variant={auto.running ? "secondary" : "primary"}
            size="lg"
            pill
            className="mt-4 w-full"
            disabled={locked && !auto.running}
            onClick={() => (auto.running ? stopAuto() : startAuto())}
            icon={auto.running ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
          >
            {auto.running ? "暂停" : auto.done > 0 ? "继续自动投递" : "开始自动投递"}
          </Button>

          <p className="mt-3 min-h-[18px] text-[11.5px] leading-relaxed text-fg-4">
            {auto.running
              ? "运行中：遇到未知弹窗、超时、日上限或页面异常会立即停手。"
              : auto.stopping && phase !== "idle"
                ? "正在把当前这一步做完，然后停下…"
                : auto.stopReason || "到目标数、今日上限，或出现任何异常都会自动停下。"}
          </p>
        </div>
      )}
    </section>
  );
}
