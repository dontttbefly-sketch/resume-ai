/* ============================================================================
 * 今天的漏斗：看过 → 读了 JD → AI 判投 → 投出，以及跳过的原因分布
 * 数字只算执行器经手的部分（终端里智能体自己投的不在这里）
 * ========================================================================== */

import { useBossStore } from "../../store/useBossStore";

const NO_REASONS: { label: string; count: number }[] = [];

function Bar({ label, value, max, note, strong }: { label: string; value: number; max: number; note?: string; strong?: boolean }) {
  const w = max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline gap-2 text-[12.5px]">
        <span className={strong ? "font-semibold text-fg" : "text-fg-2"}>{label}</span>
        {note && <span className="text-[11px] text-fg-4">{note}</span>}
        <span className={`tnum ml-auto ${strong ? "font-semibold text-fg" : "text-fg-2"}`}>{value}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-fill-2">
        <div
          className={`h-full rounded-full ${strong ? "bg-fg" : "bg-fg-3"}`}
          style={{ width: `${w}%`, transition: "width 800ms var(--ease-out-quint)" }}
        />
      </div>
    </div>
  );
}

export function Funnel() {
  const f = useBossStore((s) => s.snap?.funnel);
  const reasons = useBossStore((s) => s.snap?.skipReasons ?? NO_REASONS);
  const seen = f?.seen ?? 0;
  const maxReason = Math.max(1, ...reasons.map((r) => r.count));

  return (
    <section className="glass p-6" style={{ ["--r" as string]: "var(--r-panel)" }}>
      <div className="flex items-baseline gap-2">
        <p className="text-[14px] font-semibold tracking-[-0.01em] text-fg">今天的漏斗</p>
        <span className="text-[11.5px] text-fg-4">执行器经手的部分</span>
      </div>

      <div className="mt-5 grid gap-8 md:grid-cols-2">
        <div className="space-y-3.5">
          <Bar label="看过" value={seen} max={seen} note={f?.filtered ? `另有 ${f.filtered} 张被脚本按城市 / 薪资下限 / 已投直接略过` : undefined} />
          <Bar label="读了 JD" value={f?.opened ?? 0} max={seen} />
          <Bar label="AI 判投" value={f?.aiYes ?? 0} max={seen} />
          <Bar label="投出" value={f?.delivered ?? 0} max={seen} strong note="含今天所有投递" />
        </div>

        <div>
          <p className="text-[12.5px] text-fg-2">
            跳过的原因 <span className="tnum text-fg-4">{f?.skipped ?? 0}</span>
          </p>
          {reasons.length === 0 ? (
            <p className="mt-3 text-[12.5px] leading-relaxed text-fg-4">今天还没有跳过的岗位。开始之后，AI 判不投的理由会按类别汇总在这里。</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {reasons.map((r) => (
                <li key={r.label} className="flex items-center gap-3 text-[12.5px]">
                  <span className="w-[86px] shrink-0 truncate text-fg-2">{r.label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill-2">
                    <span
                      className="block h-full rounded-full bg-fg-3"
                      style={{ width: `${(r.count / maxReason) * 100}%`, transition: "width 800ms var(--ease-out-quint)" }}
                    />
                  </span>
                  <span className="tnum w-6 text-right text-fg-2">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
