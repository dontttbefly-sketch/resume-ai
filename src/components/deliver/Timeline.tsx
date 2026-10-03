/* ============================================================================
 * 今日动态：网页里的每一次投 / 跳，加上终端里智能体投出的（按投递时间并入）
 * 智能体在终端里跑技能时，这里会实时冒出新记录 —— 两边看的是同一份数据
 * ========================================================================== */

import { useMemo } from "react";

import type { ActivityRec, DeliveredRec } from "../../lib/bossApi";
import { useBossStore } from "../../store/useBossStore";
import { IconClock } from "../icons";
import { EmptyState } from "../kit/misc";

interface Ev {
  key: string;
  at: number;
  kind: "deliver" | "reject" | "fail";
  title: string;
  company: string;
  salary: string;
  reason: string;
  by: "auto" | "manual" | "rule" | "agent";
}

const BY_TEXT: Record<Ev["by"], string> = { auto: "自动", manual: "手动", rule: "规则", agent: "终端" };
const NO_ACTIVITY: ActivityRec[] = [];
const NO_DELIVERED: DeliveredRec[] = [];

function sameDay(a: number, b: Date) {
  const d = new Date(a);
  return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate();
}

function hhmm(t: number) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function Timeline() {
  const activity = useBossStore((s) => s.snap?.activity ?? NO_ACTIVITY);
  const delivered = useBossStore((s) => s.snap?.delivered ?? NO_DELIVERED);

  const { events, isToday } = useMemo(() => {
    const evs: Ev[] = [];
    const seen = new Set<string>();
    for (const a of activity) {
      const at = Date.parse(a.ts);
      if (!Number.isFinite(at)) continue;
      const kind = a.action === "reject" ? "reject" : a.ok ? "deliver" : "fail";
      if (kind === "deliver") seen.add(a.jobId);
      evs.push({
        key: `${a.ts}-${a.jobId}`,
        at,
        kind,
        title: a.title ?? "",
        company: a.company ?? "",
        salary: a.salary ?? "",
        reason: kind === "fail" ? (a.flags?.timeout ? "超时，未确认送达" : a.error ?? "没投出去") : (a.reason ?? ""),
        by: a.by ?? "manual",
      });
    }
    for (const d of delivered) {
      if (!d.deliveredAt || seen.has(d.jobId)) continue;
      const at = Date.parse(d.deliveredAt);
      if (!Number.isFinite(at)) continue;
      evs.push({ key: `d-${d.jobId}`, at, kind: "deliver", title: d.title, company: d.company, salary: d.salary, reason: "", by: "agent" });
    }
    evs.sort((x, y) => y.at - x.at);
    const now = new Date();
    const todays = evs.filter((e) => sameDay(e.at, now));
    return todays.length ? { events: todays.slice(0, 120), isToday: true } : { events: evs.slice(0, 30), isToday: false };
  }, [activity, delivered]);

  const counts = useMemo(
    () => ({
      deliver: events.filter((e) => e.kind === "deliver").length,
      reject: events.filter((e) => e.kind === "reject").length,
    }),
    [events],
  );

  return (
    <section className="glass flex max-h-[620px] min-h-[320px] flex-col overflow-hidden" style={{ ["--r" as string]: "var(--r-panel)" }}>
      <div className="flex shrink-0 items-baseline gap-2.5 px-5 pb-3 pt-5">
        <p className="text-[14px] font-semibold tracking-[-0.01em] text-fg">{isToday ? "今日动态" : "最近动态"}</p>
        {events.length > 0 && (
          <span className="tnum text-[12px] text-fg-4">
            投 {counts.deliver} · 跳 {counts.reject}
          </span>
        )}
      </div>
      {events.length === 0 ? (
        <EmptyState className="flex-1 py-10" icon={<IconClock className="h-6 w-6" />} title="还没有动态">
          投递和跳过都会记在这里；智能体在终端里投出的也会实时出现。
        </EmptyState>
      ) : (
        <ol className="thin-scroll fade-y min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {events.map((e, i) => (
            <li key={e.key} className="relative flex gap-3 pb-3.5">
              {/* 时间轴竖线 */}
              {i < events.length - 1 && <span className="absolute left-[3.5px] top-3 h-full w-px bg-hairline-2" />}
              <span
                className={`relative mt-[5px] h-2 w-2 shrink-0 rounded-full ${
                  e.kind === "deliver" ? "bg-fg" : e.kind === "fail" ? "bg-danger" : "bg-[var(--canvas)] shadow-[inset_0_0_0_1.5px_var(--fg-4)]"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2">
                  <span className={`truncate text-[13px] ${e.kind === "deliver" ? "font-medium text-fg" : "text-fg-2"}`}>
                    {e.title || "（无标题）"}
                  </span>
                  <span className="tnum ml-auto shrink-0 text-[11px] text-fg-4">{hhmm(e.at)}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-fg-3">
                  <span className="truncate">
                    {[e.company, e.salary].filter(Boolean).join(" · ")}
                  </span>
                  <span className="chip chip-sm ml-auto shrink-0">{e.kind === "reject" ? "跳过" : e.kind === "fail" ? "失败" : "投递"} · {BY_TEXT[e.by]}</span>
                </p>
                {e.reason && <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-fg-4">{e.reason}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
