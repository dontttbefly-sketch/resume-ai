/* ============================================================================
 * 岗位池：实习僧抓下来的岗位，按你的简历算匹配度排序
 * 抓取在 scripts/shixiseng/ 里跑，产物放 public/shixiseng-jobs.json，打开即读
 * ========================================================================== */

import { useEffect, useMemo, useRef } from "react";

import { flattenResume } from "../../lib/resumeText";
import { useJdStore } from "../../store/useJdStore";
import { AUTO_POOL_URL, usePoolStore, useRankedJobs } from "../../store/usePoolStore";
import { useResumeStore } from "../../store/useResumeStore";
import { useUiStore } from "../../store/useUiStore";
import { IconRefresh, IconSuitcase, IconUpload, IconWarn } from "../icons";
import { Button } from "../kit/Button";
import { FieldLabel } from "../kit/Field";
import { EmptyState, Switch } from "../kit/misc";
import { Segmented } from "../kit/Segmented";
import { JobCard } from "./JobCard";

export function PoolPane() {
  const pool = usePoolStore((s) => s.pool);
  const sourceName = usePoolStore((s) => s.sourceName);
  const status = usePoolStore((s) => s.status);
  const error = usePoolStore((s) => s.error);
  const filter = usePoolStore((s) => s.filter);
  const expandedId = usePoolStore((s) => s.expandedId);
  const loadFromUrl = usePoolStore((s) => s.loadFromUrl);
  const loadFromText = usePoolStore((s) => s.loadFromText);
  const setFilter = usePoolStore((s) => s.setFilter);
  const resetFilter = usePoolStore((s) => s.resetFilter);
  const toggleExpanded = usePoolStore((s) => s.toggleExpanded);

  const setJdText = useJdStore((s) => s.setJdText);
  const analyzeJd = useJdStore((s) => s.analyze);
  const setMatchTab = useUiStore((s) => s.setMatchTab);
  const sections = useResumeStore((s) => s.sections);
  const visibility = useResumeStore((s) => s.visibility);

  const { filtered, stats } = useRankedJobs();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "idle" && !pool) void loadFromUrl(AUTO_POOL_URL);
  }, [status, pool, loadFromUrl]);

  const resumeChars = useMemo(() => flattenResume(sections, visibility).plain.replace(/\s/g, "").length, [sections, visibility]);

  const useAsJd = (jdText: string) => {
    setJdText(jdText);
    analyzeJd();
    setMatchTab("analyze");
  };

  const maxBucket = Math.max(1, ...stats.buckets.map((b) => b.count));

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="glass space-y-5 p-5 lg:sticky lg:top-[92px]" style={{ ["--r" as string]: "var(--r-panel)" }}>
        <div>
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-fg">数据来源</p>
          {pool ? (
            <>
              <p className="tnum mt-2 text-[13px] text-fg-2">
                {pool.keyword} · {pool.city} · 共 {pool.jobs.length} 个
              </p>
              <p className="mt-0.5 truncate text-[11.5px] text-fg-4" title={sourceName}>
                {sourceName}
                {pool.scrapedAt && ` · ${pool.scrapedAt.slice(0, 10)}`}
              </p>
              {stats.precise === 0 && <p className="mt-2 text-[12px] leading-relaxed text-fg-3">都是粗筛分：还没抓详情页 JD，分数只反映方向。</p>}
            </>
          ) : status === "error" && error ? (
            <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-fg-3">
              <IconWarn className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
              {error}
            </p>
          ) : (
            <p className="mt-2 text-[12.5px] text-fg-3">{status === "loading" ? "读取中…" : "还没有数据"}</p>
          )}
          <div className="mt-3 flex gap-1.5">
            <Button size="sm" pill onClick={() => fileRef.current?.click()} icon={<IconUpload className="h-3.5 w-3.5" />}>
              选择文件
            </Button>
            <Button size="sm" pill variant="ghost" onClick={() => void loadFromUrl(AUTO_POOL_URL)} icon={<IconRefresh className="h-3.5 w-3.5" />}>
              重读
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) loadFromText(await f.text(), f.name);
              e.target.value = "";
            }}
          />
        </div>

        {resumeChars === 0 && (
          <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-fg-3">
            <IconWarn className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
            当前简历是空的，所有岗位都会是 0 分。
          </p>
        )}

        {pool && (
          <div className="space-y-4 pt-4 hair-t">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-fg">筛选</p>
              <button type="button" onClick={resetFilter} className="text-[12px] text-fg-4 hover:text-fg-2">
                重置
              </button>
            </div>
            <div>
              <FieldLabel>匹配度下限</FieldLabel>
              <Segmented
                size="sm"
                className="w-full [&>button]:flex-1"
                value={String(filter.minScore)}
                onChange={(v) => setFilter({ minScore: Number(v) })}
                options={[0, 40, 60, 80].map((v) => ({ value: String(v), label: v === 0 ? "不限" : `≥${v}` }))}
              />
            </div>
            <label className="block">
              <FieldLabel>标题必含</FieldLabel>
              <input value={filter.include} onChange={(e) => setFilter({ include: e.target.value })} placeholder="如 AI 产品" className="field !py-2" />
            </label>
            <label className="block">
              <FieldLabel hint="空格或逗号隔开">标题排除</FieldLabel>
              <input value={filter.exclude} onChange={(e) => setFilter({ exclude: e.target.value })} placeholder="如 销售 客服" className="field !py-2" />
            </label>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-fg-2">只看已抓 JD 的</span>
              <Switch label="只看已抓 JD 的" checked={filter.preciseOnly} onChange={(v) => setFilter({ preciseOnly: v })} />
            </div>
          </div>
        )}

        {pool && stats.total > 0 && (
          <div className="space-y-3 pt-4 hair-t">
            <p className="text-[13px] font-semibold text-fg">
              分布 <span className="tnum font-normal text-fg-4">{stats.total}</span>
            </p>
            <div className="space-y-1.5">
              {stats.buckets.map((b) => (
                <div key={b.label} className="flex items-center gap-2.5">
                  <span className="tnum w-12 shrink-0 text-[11.5px] text-fg-4">{b.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill-2">
                    <div className="h-full rounded-full bg-fg" style={{ width: `${(b.count / maxBucket) * 100}%`, transition: "width 600ms var(--ease-out-quint)" }} />
                  </div>
                  <span className="tnum w-6 shrink-0 text-right text-[11.5px] text-fg-3">{b.count}</span>
                </div>
              ))}
            </div>
            {stats.commonMissing.length > 0 && (
              <div className="pt-2">
                <p className="text-[11.5px] text-fg-4">普遍缺的核心项（数字 = 多少岗位要求它）</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {stats.commonMissing.map((m) => (
                    <span key={m.term} className="chip chip-sm chip-outline">
                      {m.term}
                      <span className="tnum text-fg-4">{m.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      <div className="min-w-0">
        {!pool ? (
          <EmptyState className="min-h-[520px]" icon={<IconSuitcase className="h-6 w-6" />} title="还没有岗位数据">
            在终端里跑一次抓取，产物会自动出现在这里：
            <code className="kbd mt-2 !h-auto px-2 py-1">./scripts/shixiseng/run.sh</code>
          </EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState className="min-h-[400px]" title="筛完一个都不剩">
            放宽一下左边的条件，或者点「重置」。
          </EmptyState>
        ) : (
          <div className="space-y-2.5">
            <p className="px-1 pb-1 text-[12.5px] text-fg-3">按匹配度从高到低 · {filtered.length} 个岗位</p>
            {filtered.map((row) => (
              <JobCard
                key={row.job.internId}
                row={row}
                expanded={expandedId === row.job.internId}
                onToggle={() => toggleExpanded(row.job.internId)}
                onUseAsJd={() => useAsJd(row.jdText)}
              />
            ))}
            <p className="px-1 pt-3 text-[12px] leading-relaxed text-fg-4">
              匹配度是本地按关键词算的，只反映字面覆盖。投递留给你人工完成 —— 外链图标会打开岗位页，登录后自己点投递。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
