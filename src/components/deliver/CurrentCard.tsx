/* ============================================================================
 * 当前这张：卡片表面 + AI 结论；JD 默认收起
 * 逐张确认时，判完在这里等你点投或跳
 * ========================================================================== */

import { useState } from "react";

import { useBossStore } from "../../store/useBossStore";
import { IconCheck, IconChevron, IconPlane, IconSkip, IconSpark, IconWarn, IconX } from "../icons";
import { Button } from "../kit/Button";

export function CurrentCard() {
  const card = useBossStore((s) => s.card);
  const jd = useBossStore((s) => s.jd);
  const verdict = useBossStore((s) => s.verdict);
  const judgeError = useBossStore((s) => s.judgeError);
  const auto = useBossStore((s) => s.auto);
  const busy = useBossStore((s) => s.snap?.busy);
  const deliver = useBossStore((s) => s.deliver);
  const skip = useBossStore((s) => s.skip);
  const [showJd, setShowJd] = useState(false);
  const s = card?.surface;

  // 逐张确认在等你；或者没在跑、手上有一张还没处理的卡
  const deciding = (auto.running && auto.awaiting) || (!auto.running && !busy && card && !card.outcome && verdict);

  return (
    <section className="glass p-6" style={{ ["--r" as string]: "var(--r-panel)" }}>
      <div className="flex items-baseline gap-2">
        <p className="text-[14px] font-semibold tracking-[-0.01em] text-fg">当前这张</p>
        {card && (
          <span className="tnum text-[11.5px] text-fg-4">
            列表第 {card.position + 1} 张{card.autoSkipped > 0 ? ` · 前面略过 ${card.autoSkipped} 张` : ""}
          </span>
        )}
        {card?.outcome && (
          <span className={`chip chip-sm ml-auto ${card.outcome === "delivered" ? "chip-solid" : "chip-outline"}`}>
            {card.outcome === "delivered" ? "已投递" : card.outcome === "rejected" ? "已跳过" : card.outcome === "failed" ? "没投出去" : "已略过"}
          </span>
        )}
      </div>

      {!s ? (
        <p className="mt-6 pb-2 text-[13px] leading-relaxed text-fg-4">点「开始」后，这里显示执行器正在处理的卡片和 AI 的判断。</p>
      ) : (
        <div key={s.jobId} className="anim-rise">
          <div className="mt-4 flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-[20px] font-semibold leading-snug tracking-[-0.02em] text-fg">{s.title}</h3>
              <p className="mt-1 truncate text-[13px] text-fg-2">
                {s.company || "（公司名未取到）"}
                {s.industry && <span className="text-fg-4"> · {s.industry}</span>}
              </p>
            </div>
            <p className="tnum shrink-0 text-[19px] font-semibold tracking-[-0.02em] text-fg">{s.salary || "面议"}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[s.city, s.experience, s.degree, s.scale].filter(Boolean).map((x) => (
              <span key={x} className="chip chip-outline chip-sm">
                {x}
              </span>
            ))}
          </div>

          {/* AI 结论 */}
          <div className="mt-5 min-h-[40px]">
            {judgeError ? (
              <p className="flex items-start gap-2 text-[13px] text-fg-2">
                <IconWarn className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                {judgeError}
              </p>
            ) : verdict ? (
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold ${
                    verdict.deliver ? "solid" : "text-fg shadow-[inset_0_0_0_1.5px_var(--fg)]"
                  }`}
                >
                  {verdict.deliver ? <IconCheck className="h-3.5 w-3.5" /> : <IconX className="h-3.5 w-3.5" />}
                  {verdict.deliver ? "建议投递" : "建议跳过"}
                </span>
                <div className="min-w-0 pt-1">
                  <p className="text-[13px] leading-relaxed text-fg">{verdict.reason}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2.5 text-[11px] text-fg-4">
                    <span className="inline-flex items-center gap-1">
                      {verdict.source === "rule" ? "规则判定" : <><IconSpark className="h-3 w-3" />AI 判定</>}
                    </span>
                    {verdict.category && <span>{verdict.category}</span>}
                    {verdict.direction && <span>方向 · {verdict.direction}</span>}
                    {verdict.confidence != null && <span className="tnum">把握 {Math.round(verdict.confidence * 100)}%</span>}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {deciding && !card?.outcome && (
            <div className="anim-rise mt-4 flex items-center gap-2 rounded-[16px] bg-fill px-3 py-2.5">
              <span className="flex-1 text-[12.5px] text-fg-2">{auto.running ? "逐张确认：你来决定这张" : "这张还没处理"}</span>
              <Button size="md" pill variant="ghost" onClick={() => void skip()} icon={<IconSkip className="h-4 w-4" />}>
                跳过
              </Button>
              <Button size="md" pill variant={verdict && !verdict.deliver ? "secondary" : "primary"} onClick={() => void deliver()} icon={<IconPlane className="h-4 w-4" />}>
                投递
              </Button>
            </div>
          )}

          {jd && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowJd((v) => !v)}
                className="press flex items-center gap-1 rounded-full py-1 pr-2 text-[12px] text-fg-3 hover:text-fg"
              >
                <IconChevron className={`h-3.5 w-3.5 transition-transform duration-300 ${showJd ? "rotate-180" : ""}`} />
                {showJd ? "收起 JD" : "展开 JD"}
              </button>
              <div className="disclose" data-open={showJd}>
                <div>
                  <div className="well thin-scroll mt-2 max-h-[320px] overflow-y-auto whitespace-pre-wrap px-4 py-3 text-[12.5px] leading-[1.8] text-fg-2" style={{ borderRadius: 14 }}>
                    {jd}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
