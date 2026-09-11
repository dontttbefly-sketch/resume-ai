/* ============================================================================
 * 岗位池面板
 *
 * 左边：数据来源 + 筛选 + 池子体检（分数分布、普遍缺什么）
 * 右边：按匹配度排好序的岗位列表
 *
 * 数据不是这里抓的 —— 抓取在 scripts/shixiseng/ 里跑，跑完把 jobs.json
 * 复制到 public/shixiseng-jobs.json，这个页面打开就自动读。
 * 这样浏览器里不需要任何跨域权限，也不用连站点。
 * ========================================================================== */

import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { flattenResume } from "../../lib/resumeText";
import { useJdStore } from "../../store/useJdStore";
import { AUTO_POOL_URL, usePoolStore, useRankedJobs } from "../../store/usePoolStore";
import { useUiStore } from "../../store/useUiStore";
import { useResumeStore } from "../../store/useResumeStore";
import { IconFilter, IconRefresh, IconSuitcase, IconUpload, IconWarn } from "../icons";
import { Btn } from "../ui";
import { JobCard } from "./JobCard";

const SCORE_STEPS = [0, 40, 60, 80] as const;

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[11.5px] font-medium text-slate-500">{children}</p>;
}

export function PoolPanel() {
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
  const setView = useUiStore((s) => s.setView);

  const sections = useResumeStore((s) => s.sections);
  const visibility = useResumeStore((s) => s.visibility);

  const { filtered, stats } = useRankedJobs();
  const fileRef = useRef<HTMLInputElement>(null);

  // 打开面板就试着读一次快照；没抓到过就是 404，会走进错误态并给出提示
  useEffect(() => {
    if (status === "idle" && !pool) void loadFromUrl(AUTO_POOL_URL);
  }, [status, pool, loadFromUrl]);

  // 简历文本为空时匹配度恒为 0，直接提醒，别让用户对着 0 分干瞪眼
  const resumeChars = useMemo(
    () => flattenResume(sections, visibility).plain.replace(/\s/g, "").length,
    [sections, visibility],
  );

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    loadFromText(await file.text(), file.name);
  };

  const useAsJd = (jdText: string) => {
    setJdText(jdText);
    // setJdText 是同步写 store，紧接着 analyze 读到的一定是新值
    analyzeJd();
    setView("jd");
  };

  return (
    <div className="flex min-h-0 flex-1">
      {/* ------------------------------ 左：来源与筛选 ------------------------------ */}
      <aside className="thin-scroll flex w-[300px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-slate-50">
        <div className="space-y-3 p-4">
          <header className="flex items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <IconSuitcase className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="text-[13.5px] font-medium text-slate-800">岗位池</h2>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-400">
                实习僧抓下来的岗位，按你的简历算匹配度排序。
              </p>
            </div>
          </header>

          {/* 来源 */}
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            {pool ? (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[11.5px] text-slate-400">数据来源</p>
                  <button
                    type="button"
                    title="重新读取 public/shixiseng-jobs.json"
                    className="inline-flex items-center gap-1 text-[11.5px] text-brand hover:underline"
                    onClick={() => void loadFromUrl(AUTO_POOL_URL)}
                  >
                    <IconRefresh className="h-3 w-3" />
                    重读
                  </button>
                </div>
                <p className="tnum mt-1 text-[12px] text-slate-700">
                  {pool.keyword} · {pool.city} · 共 {pool.jobs.length} 个
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400" title={sourceName}>
                  {sourceName}
                  {pool.scrapedAt && ` · ${pool.scrapedAt.slice(0, 10)}`}
                </p>
                {stats.precise === 0 && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-amber-600">
                    都是粗筛分：还没抓详情页 JD，分数只反映岗位方向。
                  </p>
                )}
              </>
            ) : status === "loading" ? (
              <p className="text-[12px] text-slate-500">读取中…</p>
            ) : error ? (
              <div className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-amber-700">
                <IconWarn className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : (
              <p className="text-[12px] text-slate-500">还没有数据</p>
            )}

            <div className="mt-2 flex items-center gap-1.5">
              <Btn variant="outline" onClick={() => fileRef.current?.click()}>
                <IconUpload className="h-3.5 w-3.5" />
                选择文件
              </Btn>
              {pool && (
                <Btn variant="ghost" onClick={() => resetFilter()}>
                  重置筛选
                </Btn>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void onPickFile(e.target.files?.[0]);
                e.target.value = ""; // 允许连续选同一个文件
              }}
            />
          </div>

          {resumeChars === 0 && (
            <div className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-700">
              <IconWarn className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>当前简历是空的，所有岗位都会是 0 分。先回「简历编辑」填内容。</span>
            </div>
          )}

          {/* 筛选 */}
          {pool && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex items-center gap-1.5">
                <IconFilter className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[12px] font-medium text-slate-700">筛选</span>
              </div>

              <div>
                <FieldLabel>匹配度下限</FieldLabel>
                <div className="flex items-center gap-1">
                  {SCORE_STEPS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFilter({ minScore: v })}
                      className={`tnum flex-1 rounded-md border px-1 py-1 text-[11.5px] transition ${
                        filter.minScore === v
                          ? "border-brand bg-brand-soft text-brand"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {v === 0 ? "不限" : `≥${v}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>标题必含</FieldLabel>
                <input
                  value={filter.include}
                  onChange={(e) => setFilter({ include: e.target.value })}
                  placeholder="如 AI 产品"
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                />
              </div>

              <div>
                <FieldLabel>标题排除</FieldLabel>
                <input
                  value={filter.exclude}
                  onChange={(e) => setFilter({ exclude: e.target.value })}
                  placeholder="如 销售 客服 地推"
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                />
                <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
                  多个词用空格或逗号隔开。
                </p>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-slate-600">
                <input
                  type="checkbox"
                  checked={filter.preciseOnly}
                  onChange={(e) => setFilter({ preciseOnly: e.target.checked })}
                  className="h-3.5 w-3.5 accent-blue-600"
                />
                只看已抓 JD 的岗位
              </label>
            </div>
          )}

          {/* 池子体检 */}
          {pool && stats.total > 0 && (
            <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white px-3 py-3">
              <span className="text-[12px] font-medium text-slate-700">
                筛选后 {stats.total} 个
              </span>

              <div className="space-y-1.5">
                {stats.buckets.map((b) => {
                  const max = Math.max(...stats.buckets.map((x) => x.count), 1);
                  return (
                    <div key={b.label} className="flex items-center gap-2">
                      <span className="tnum w-12 shrink-0 text-[11px] text-slate-400">{b.label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand/70"
                          style={{ width: `${(b.count / max) * 100}%` }}
                        />
                      </div>
                      <span className="tnum w-6 shrink-0 text-right text-[11px] text-slate-500">
                        {b.count}
                      </span>
                    </div>
                  );
                })}
              </div>

              {stats.commonMissing.length > 0 && (
                <div className="border-t border-slate-100 pt-2">
                  <p className="text-[11.5px] text-slate-400">普遍缺的核心项</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {stats.commonMissing.map((m) => (
                      <span
                        key={m.term}
                        className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500"
                      >
                        {m.term}
                        <span className="tnum ml-1 text-slate-400">{m.count}</span>
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
                    数值 = 有多少个岗位要求它。多个岗位都缺同一个词，说明该考虑补进简历。
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ------------------------------ 右：岗位列表 ------------------------------ */}
      <section className="thin-scroll min-h-0 flex-1 overflow-auto bg-slate-100">
        <div className="mx-auto max-w-[900px] px-6 py-6">
          {!pool ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-300">
                <IconSuitcase className="h-6 w-6" />
              </span>
              <p className="text-[13px] text-slate-500">还没有岗位数据</p>
              <div className="max-w-[460px] space-y-1 text-[12px] leading-relaxed text-slate-400">
                <p>在终端里跑一次抓取，产物会自动出现在这里：</p>
                <code className="mt-1 inline-block rounded bg-white px-2 py-1 text-[11.5px] text-slate-600">
                  ./scripts/shixiseng/run.sh
                </code>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
              <p className="text-[13px] text-slate-500">筛完一个都不剩</p>
              <p className="text-[12px] text-slate-400">放宽一下左边的条件，或者点「重置筛选」。</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="px-1 pb-1 text-[12px] text-slate-500">
                按匹配度从高到低，共 {filtered.length} 个岗位
              </p>

              {filtered.map((row) => (
                <JobCard
                  key={row.job.internId}
                  row={row}
                  expanded={expandedId === row.job.internId}
                  onToggle={() => toggleExpanded(row.job.internId)}
                  onUseAsJd={() => useAsJd(row.jdText)}
                />
              ))}

              <p className="px-1 pt-3 text-[11.5px] leading-relaxed text-slate-400">
                匹配度是本地按关键词加权算的，只反映字面覆盖。分数低不代表没机会，投递前还是自己看一眼 JD。
                投递动作留给你人工完成 —— 点卡片右边的外链图标会打开岗位页，登录后自己点「投个简历」。
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
