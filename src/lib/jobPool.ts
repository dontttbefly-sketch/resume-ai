/* ============================================================================
 * 岗位池：把实习僧抓下来的岗位列表接进匹配引擎
 *
 * 分工：
 *   - 抓取与解码在 scripts/shixiseng/（Node + Python），产出 jobs.json
 *   - 这里只负责「读进来 → 打分 → 排序 → 给界面用」，不碰网络
 *
 * 两档精度，别混为一谈：
 *   - 粗筛（列表页信息）：只有 岗位名 + 公司行业 + 岗位优势 三个来源。
 *     实习僧的「岗位优势」常常写的是福利（地铁周边、早午餐），信息量偏低，
 *     所以粗筛分主要反映「岗位方向」对不对口，用来排掉明显不相关的。
 *   - 精筛（详情页 JD）：真抓了 JD 正文，分才有判断力。
 *     详情页抓取见 scripts/shixiseng/fetch-detail.mjs。
 * ========================================================================== */

import { analyzeJd, summarizeScore, type JdAnalysis } from "./jdMatch";
import type { FlatResume } from "./resumeText";

export interface JobRecord {
  internId: string;
  title: string;
  company: string;
  salaryText: string;
  salaryPerDay: number | null;
  city: string;
  daysPerWeek: number | null;
  months: number | null;
  /** 岗位优势（站点原文字段，常是福利标签） */
  advantage: string;
  /** 公司信息，如「电子/通信/硬件/2000人以上」 */
  companyMeta: string;
  url: string;
  page?: number;
  /** 详情页 JD 正文。有则精筛，无则粗筛 */
  jd?: string;
}

export interface JobPool {
  keyword: string;
  city: string;
  scrapedAt: string;
  total: number;
  jobs: JobRecord[];
}

export interface ScoredJob {
  job: JobRecord;
  analysis: JdAnalysis;
  /** 打分用的文本，界面上可展开看「到底拿什么在比」 */
  jdText: string;
  /** true = 用了详情页 JD，false = 只有列表页信息 */
  precise: boolean;
  /** 一句话结论 */
  verdict: string;
  /** 缺失的高权重关键词，最多 3 个 */
  topMissing: string[];
}

/* ------------------------------ 读取与容错 ------------------------------ */

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number.parseInt(v, 10);
  return null;
}

/**
 * 解析抓取产物。两种形状都吃：
 *   - 完整对象 { keyword, city, scrapedAt, total, jobs: [...] }
 *   - 裸数组 [ {...}, {...} ]
 * 任何一条缺 internId 就丢掉——没有 id 就没法去重也没法回去投递。
 */
export function parseJobPool(text: string): JobPool {
  const data: unknown = JSON.parse(text);

  const root = Array.isArray(data) ? { jobs: data } : (data as Record<string, unknown>);
  const rawJobs = Array.isArray(root.jobs) ? root.jobs : [];

  const jobs: JobRecord[] = [];
  const seen = new Set<string>();

  for (const item of rawJobs) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;

    const internId = asString(r.internId).trim();
    if (!internId || seen.has(internId)) continue;
    seen.add(internId);

    jobs.push({
      internId,
      title: asString(r.title).trim(),
      company: asString(r.company).trim(),
      salaryText: asString(r.salaryText).trim(),
      salaryPerDay: asNumber(r.salaryPerDay),
      city: asString(r.city).trim(),
      daysPerWeek: asNumber(r.daysPerWeek),
      months: asNumber(r.months),
      advantage: asString(r.advantage).trim(),
      companyMeta: asString(r.companyMeta).trim(),
      url: asString(r.url).trim(),
      page: asNumber(r.page) ?? undefined,
      jd: asString(r.jd).trim() || undefined,
    });
  }

  return {
    keyword: asString(root.keyword).trim() || "（未标注）",
    city: asString(root.city).trim() || "（未标注）",
    scrapedAt: asString(root.scrapedAt).trim(),
    total: asNumber(root.uniqueTotal) ?? asNumber(root.total) ?? jobs.length,
    jobs,
  };
}

/* ------------------------------- 打分 ------------------------------- */

/**
 * 拼出用来比对岗位的文本。
 *
 * 有 JD 就整段用上；没有就用列表页的三个字段拼。
 * 顺序有讲究：岗位名放最前，`detectTitle` 取首行当职位名。
 */
export function jobToJdText(job: JobRecord): string {
  if (job.jd) return `${job.title}\n${job.company}｜${job.companyMeta}\n${job.jd}`;

  const bits = [
    job.title,
    [job.company, job.companyMeta].filter(Boolean).join("｜"),
    job.city ? `工作城市：${job.city}` : "",
    job.advantage ? `岗位优势：${job.advantage}` : "",
  ];
  return bits.filter(Boolean).join("\n");
}

export function scoreJob(job: JobRecord, resume: FlatResume): ScoredJob {
  const jdText = jobToJdText(job);
  const analysis = analyzeJd(jdText, resume);

  const verdict = summarizeScore(analysis.score, analysis.keywords.length);
  return {
    job,
    analysis,
    jdText,
    precise: Boolean(job.jd),
    // 粗筛分只反映岗位方向，补个后缀防止读成「稳了」
    verdict: job.jd ? verdict : `${verdict}（粗筛）`,
    topMissing: analysis.missing.slice(0, 3).map((k) => k.term),
  };
}

/**
 * 批量打分并排序。
 *
 * 主排序是匹配度；但粗筛文本很短，经常「命中的几个词简历全有」而出现一片 100 分。
 * 所以同分时接着比：精筛优先 → 命中词更多（信息更厚）→ 日薪更高 → 保持抓取顺序。
 */
export function rankJobs(jobs: JobRecord[], resume: FlatResume): ScoredJob[] {
  return jobs
    .map((job, index) => ({ scored: scoreJob(job, resume), index }))
    .sort((a, b) => {
      const d = b.scored.analysis.score - a.scored.analysis.score;
      if (d !== 0) return d;
      if (a.scored.precise !== b.scored.precise) return a.scored.precise ? -1 : 1;
      const breadth = b.scored.analysis.hits.length - a.scored.analysis.hits.length;
      if (breadth !== 0) return breadth;
      const pay = (b.scored.job.salaryPerDay ?? 0) - (a.scored.job.salaryPerDay ?? 0);
      if (pay !== 0) return pay;
      return a.index - b.index;
    })
    .map((x) => x.scored);
}

/* ------------------------------ 筛选 ------------------------------ */

export interface PoolFilter {
  /** 匹配度下限，0–100 */
  minScore: number;
  /** 标题必须包含的任一词（逗号分隔），空则不过滤 */
  include: string;
  /** 标题含任一就排除（逗号分隔），空则不过滤 */
  exclude: string;
  /** 只看精筛过的 */
  preciseOnly: boolean;
}

export const DEFAULT_FILTER: PoolFilter = {
  minScore: 0,
  include: "",
  exclude: "",
  preciseOnly: false,
};

function splitTerms(raw: string): string[] {
  return raw
    .split(/[,，\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function applyFilter(rows: ScoredJob[], filter: PoolFilter): ScoredJob[] {
  const include = splitTerms(filter.include);
  const exclude = splitTerms(filter.exclude);

  return rows.filter(({ job, analysis, precise }) => {
    if (analysis.score < filter.minScore) return false;
    if (filter.preciseOnly && !precise) return false;

    const title = job.title.toLowerCase();
    if (include.length && !include.some((t) => title.includes(t))) return false;
    if (exclude.length && exclude.some((t) => title.includes(t))) return false;

    return true;
  });
}

/* ------------------------------ 统计 ------------------------------ */

export interface PoolStats {
  total: number;
  precise: number;
  /** 分数分布，用于界面上画一眼分布 */
  buckets: { label: string; count: number }[];
  /** 出现次数最高的缺失关键词（只统计权重 3 的），告诉用户「普遍缺什么」 */
  commonMissing: { term: string; count: number }[];
}

export function statsOf(rows: ScoredJob[]): PoolStats {
  const buckets = [
    { label: "≥80", count: 0 },
    { label: "60–79", count: 0 },
    { label: "40–59", count: 0 },
    { label: "<40", count: 0 },
  ];

  const missingCount = new Map<string, number>();
  let precise = 0;

  for (const row of rows) {
    const s = row.analysis.score;
    if (s >= 80) buckets[0].count++;
    else if (s >= 60) buckets[1].count++;
    else if (s >= 40) buckets[2].count++;
    else buckets[3].count++;

    if (row.precise) precise++;

    for (const k of row.analysis.coreMissing) {
      missingCount.set(k.term, (missingCount.get(k.term) ?? 0) + 1);
    }
  }

  const commonMissing = [...missingCount.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, 8);

  return { total: rows.length, precise, buckets, commonMissing };
}
