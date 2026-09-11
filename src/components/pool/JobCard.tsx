/* ============================================================================
 * 岗位卡片
 *
 * 一行信息密度优先：左边分数、中间岗位信息的四行、右边操作。
 * 展开后才是关键词明细 —— 一屏能看到十几条岗位，扫得快才是重点。
 * ========================================================================== */

import type { ScoredJob } from "../../lib/jobPool";
import type { JdKeyword } from "../../lib/jdMatch";
import { IconChevron, IconExternal, IconTarget } from "../icons";
import { Btn } from "../ui";

function toneOf(score: number) {
  if (score >= 80) return { bar: "bg-emerald-500", text: "text-emerald-600", chip: "bg-emerald-50 border-emerald-200" };
  if (score >= 60) return { bar: "bg-brand", text: "text-brand", chip: "bg-brand-soft border-blue-200" };
  if (score >= 40) return { bar: "bg-amber-500", text: "text-amber-600", chip: "bg-amber-50 border-amber-200" };
  return { bar: "bg-rose-400", text: "text-rose-500", chip: "bg-rose-50 border-rose-200" };
}

/** 左边细分数条：比圆环省地方，一排扫下来能横向比较 */
function ScoreBar({ score }: { score: number }) {
  const tone = toneOf(score);
  return (
    <div className="flex w-[46px] shrink-0 flex-col items-center gap-1">
      <span className={`tnum text-[17px] font-semibold leading-none ${tone.text}`}>{score}</span>
      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
    </div>
  );
}

function Chip({ keyword, hit }: { keyword: JdKeyword; hit: boolean }) {
  const tone = hit
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : keyword.weight === 3
      ? "border-rose-200 bg-rose-50 text-rose-600"
      : "border-slate-200 bg-white text-slate-500";

  const tip = hit ? `简历里写过：${keyword.evidence}` : `简历里没找到「${keyword.term}」的相关表述`;

  return (
    <span
      title={tip}
      className={`inline-flex cursor-default items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-5 ${tone}`}
    >
      {keyword.term}
      {keyword.weight === 3 && <span className="text-[9px] opacity-60">核心</span>}
    </span>
  );
}

/** 把薪资/工时/周期拼成一行，缺的就不显示 */
function metaLine(row: ScoredJob): string {
  const { job } = row;
  return [
    job.salaryText || (job.salaryPerDay != null ? `${job.salaryPerDay}/天` : "薪资面议"),
    job.daysPerWeek != null ? `${job.daysPerWeek}天/周` : "",
    job.months != null ? `${job.months}个月` : "",
    job.city,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function JobCard({
  row,
  expanded,
  onToggle,
  onUseAsJd,
}: {
  row: ScoredJob;
  expanded: boolean;
  onToggle: () => void;
  onUseAsJd: () => void;
}) {
  const { job, analysis, precise, topMissing } = row;
  const tone = toneOf(analysis.score);

  return (
    <article className="rounded-xl border border-slate-200 bg-white transition hover:border-slate-300">
      {/* ------------------------------ 摘要行 ------------------------------ */}
      <div className="flex items-start gap-3 px-3.5 py-3">
        <ScoreBar score={analysis.score} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-[13px] font-medium text-slate-800" title={job.title}>
              {job.title || "（无岗位名）"}
            </h3>
            {precise ? (
              <span className="shrink-0 rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-[10px] leading-4 text-emerald-600">
                已抓 JD
              </span>
            ) : (
              <span
                className="shrink-0 cursor-default rounded border border-slate-200 bg-slate-50 px-1 py-px text-[10px] leading-4 text-slate-400"
                title="只用列表页的岗位名与优势标签打分，信息量有限；抓了详情页 JD 会变成「已抓 JD」"
              >
                粗筛
              </span>
            )}
            <span
              className="tnum shrink-0 cursor-default text-[10.5px] text-slate-400"
              title="岗位文本里识别到、且你的简历里有对应表述的关键词数"
            >
              命中 {analysis.hits.length}/{analysis.keywords.length}
            </span>
          </div>

          <p className="mt-0.5 truncate text-[12px] text-slate-600">
            {job.company || "（无公司名）"}
            {job.companyMeta && <span className="text-slate-400">｜{job.companyMeta}</span>}
          </p>

          <p className="tnum mt-0.5 truncate text-[11.5px] text-slate-500">{metaLine(row)}</p>

          {topMissing.length > 0 && (
            <p className="mt-1 truncate text-[11.5px] text-slate-400" title={analysis.missing.map((k) => k.term).join("、")}>
              待补：<span className="text-rose-500">{topMissing.join("、")}</span>
              {analysis.missing.length > topMissing.length && (
                <span className="text-slate-400"> 等 {analysis.missing.length} 项</span>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Btn
            variant="ghost"
            className="!px-1.5"
            title="在浏览器里打开这个岗位（投递需要你自己登录后点）"
            onClick={() => window.open(job.url, "_blank", "noopener")}
            disabled={!job.url}
          >
            <IconExternal className="h-3.5 w-3.5" />
          </Btn>

          <Btn
            variant="outline"
            title="把这条岗位送进「岗位匹配」，看完整分析并生成打招呼话术"
            onClick={onUseAsJd}
          >
            <IconTarget className="h-3.5 w-3.5" />
            看详情
          </Btn>

          <Btn
            variant="ghost"
            className="!px-1.5"
            title={expanded ? "收起关键词" : "展开关键词命中情况"}
            onClick={onToggle}
          >
            <IconChevron className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Btn>
        </div>
      </div>

      {/* ------------------------------ 展开明细 ------------------------------ */}
      {expanded && (
        <div className="space-y-2.5 border-t border-slate-100 px-3.5 py-3">
          {job.advantage && (
            <p className="text-[11.5px] leading-relaxed text-slate-500">
              <span className="text-slate-400">岗位优势：</span>
              {job.advantage}
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11.5px] text-slate-400">
                已覆盖 {analysis.hits.length}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.hits.length === 0 ? (
                  <span className="text-[11.5px] text-slate-400">一个都没覆盖到</span>
                ) : (
                  analysis.hits.map((k) => <Chip key={k.term} keyword={k} hit />)
                )}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11.5px] text-slate-400">待补充 {analysis.missing.length}</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.missing.length === 0 ? (
                  <span className="text-[11.5px] text-emerald-600">识别到的关键词全都覆盖了</span>
                ) : (
                  analysis.missing.map((k) => <Chip key={k.term} keyword={k} hit={false} />)
                )}
              </div>
            </div>
          </div>

          {!precise && (
            <p className="text-[11px] leading-relaxed text-slate-400">
              这条是粗筛：列表页只有岗位名、公司行业、优势标签，没抓到 JD 正文，
              所以分数主要反映「岗位方向对不对口」，不代表能力项覆盖情况。
              想更准就跑 <code className="rounded bg-slate-100 px-1">scripts/shixiseng/fetch-detail.mjs</code> 抓详情页。
            </p>
          )}

          <div className="flex items-center gap-2 pt-0.5">
            <span className={`rounded border px-1.5 py-0.5 text-[11px] ${tone.chip} ${tone.text}`}>
              {row.verdict}
            </span>
            <span className="tnum text-[11px] text-slate-400">
              {analysis.keywords.length} 个关键词 · 命中 {analysis.hits.length} · 缺 {analysis.missing.length}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}
