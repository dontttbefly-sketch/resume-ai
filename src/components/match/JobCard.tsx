/* 岗位卡：左分数、中信息、右操作；展开才是关键词明细 */

import type { ScoredJob } from "../../lib/jobPool";
import { IconChevron, IconExternal, IconTarget } from "../icons";
import { Button, IconButton } from "../kit/Button";
import { KeywordChip } from "./MatchResult";

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

  return (
    <article className={`surface lift ${expanded ? "surface-strong !transform-none" : ""}`} style={{ ["--r" as string]: "var(--r-card)" }}>
      <div className="flex items-start gap-4 px-4 py-3.5">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1.5 pt-0.5">
          <span className="display-num text-[26px] text-fg">{analysis.score}</span>
          <span className="h-[3px] w-full overflow-hidden rounded-full bg-fill-3">
            <span className="block h-full rounded-full bg-fg" style={{ width: `${Math.min(analysis.score, 100)}%` }} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-fg" title={job.title}>
              {job.title || "（无岗位名）"}
            </h3>
            <span className={`chip chip-sm shrink-0 ${precise ? "" : "chip-outline"}`} title={precise ? "用了详情页 JD 打分" : "只用列表页信息粗筛"}>
              {precise ? "已抓 JD" : "粗筛"}
            </span>
            <span className="tnum shrink-0 text-[11px] text-fg-4">
              命中 {analysis.hits.length}/{analysis.keywords.length}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-fg-2">
            {job.company || "（无公司名）"}
            {job.companyMeta && <span className="text-fg-4">｜{job.companyMeta}</span>}
          </p>
          <p className="tnum mt-0.5 truncate text-[12px] text-fg-3">{metaLine(row)}</p>
          {topMissing.length > 0 && (
            <p className="mt-1 truncate text-[12px] text-fg-4" title={analysis.missing.map((k) => k.term).join("、")}>
              待补：<span className="text-fg-2">{topMissing.join("、")}</span>
              {analysis.missing.length > topMissing.length && ` 等 ${analysis.missing.length} 项`}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="在浏览器打开岗位页" pill disabled={!job.url} onClick={() => window.open(job.url, "_blank", "noopener")}>
            <IconExternal className="h-4 w-4" />
          </IconButton>
          <Button size="sm" pill onClick={onUseAsJd} icon={<IconTarget className="h-3.5 w-3.5" />}>
            看详情
          </Button>
          <IconButton label={expanded ? "收起" : "展开关键词"} pill onClick={onToggle}>
            <IconChevron className={`h-4 w-4 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
          </IconButton>
        </div>
      </div>

      <div className="disclose" data-open={expanded}>
        <div>
          <div className="space-y-3 px-4 pb-4 pt-1">
            {job.advantage && (
              <p className="text-[12px] leading-relaxed text-fg-3">
                <span className="text-fg-4">岗位优势 · </span>
                {job.advantage}
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-[11.5px] text-fg-4">已覆盖 {analysis.hits.length}</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.hits.length === 0 ? (
                    <span className="text-[12px] text-fg-4">一个都没覆盖到</span>
                  ) : (
                    analysis.hits.map((k) => <KeywordChip key={k.term} keyword={k} hit />)
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11.5px] text-fg-4">待补充 {analysis.missing.length}</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.missing.length === 0 ? (
                    <span className="text-[12px] text-fg-3">识别到的关键词全覆盖了</span>
                  ) : (
                    analysis.missing.map((k) => <KeywordChip key={k.term} keyword={k} hit={false} />)
                  )}
                </div>
              </div>
            </div>
            <p className="text-[12px] text-fg-3">
              <span className="chip chip-sm mr-2">{row.verdict}</span>
              {!precise && "粗筛：只有岗位名和标签，分数主要反映方向是否对口。"}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
