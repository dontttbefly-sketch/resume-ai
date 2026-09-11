/* ============================================================================
 * JD 匹配引擎（纯本地，不调模型）
 *
 * 思路：把 JD 里出现过的词典词挑出来，逐个到简历文本里找证据。
 * 加权命中率就是匹配度。可解释、可复现，不依赖任何外部服务。
 *
 * 为什么不调模型来打分：JD 关键词是显式的，简历文本也在本地，
 * 词集比对已经足够准；用模型反而引入不确定性且每次结果不一样。
 * ========================================================================== */

import { JD_LEXICON, LEX_GROUP_LABEL, type LexGroup } from "../data/jdLexicon";
import type { FlatResume } from "./resumeText";

export interface JdKeyword {
  /** 规范名，展示用 */
  term: string;
  group: LexGroup;
  groupLabel: string;
  weight: number;
  /** 简历里是否有对应证据 */
  hit: boolean;
  /** 简历里命中的原文片段，用于让用户确认「确实写过」 */
  evidence: string;
}

export interface JdRequirement {
  /** 要求的年限，识别不到为 null */
  years: number | null;
  /** 原始表述，例如「3 年以上」 */
  yearsRaw: string;
  /** 学历门槛，识别不到为 null */
  degree: string | null;
  /** JD 标题（首行非空内容，截断到 40 字） */
  roleTitle: string;
}

export interface JdAnalysis {
  /** JD 里出现过的所有词典词 */
  keywords: JdKeyword[];
  hits: JdKeyword[];
  missing: JdKeyword[];
  /** 缺失词里权重为 3 的，最该优先补的那种 */
  coreMissing: JdKeyword[];
  /** 加权命中率，0–100 */
  score: number;
  requirement: JdRequirement;
}

/* ---------------------------- 文本归一化 ---------------------------- */

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

/** 在简历文本里找这个词的命中位置，返回上下文片段 */
function findEvidence(rawText: string, aliases: readonly string[]): string {
  const lower = rawText.toLowerCase();
  for (const alias of aliases) {
    const idx = lower.indexOf(alias.toLowerCase());
    if (idx < 0) continue;
    const start = Math.max(0, idx - 14);
    const end = Math.min(rawText.length, idx + alias.length + 14);
    const head = start > 0 ? "…" : "";
    const tail = end < rawText.length ? "…" : "";
    return `${head}${rawText.slice(start, end).replace(/\s+/g, " ").trim()}${tail}`;
  }
  return "";
}

/* ---------------------------- 条件识别 ---------------------------- */

const CN_NUM: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

function toNumber(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  return CN_NUM[raw] ?? null;
}

const YEAR_PATTERNS: readonly RegExp[] = [
  /(\d+|一|二|两|三|四|五|六|七|八|九|十)\s*年(?:及)?以上/,
  /(\d+|一|二|两|三|四|五|六|七|八|九|十)\s*[-~至到]\s*\d+\s*年/,
  /(\d+|一|二|两|三|四|五|六|七|八|九|十)\s*年(?:以上)?(?:工作)?经验/,
  /(?:工作)?经验\s*(?:要求)?\s*(\d+|一|二|两|三|四|五|六|七|八|九|十)\s*年/,
];

function detectYears(jdText: string): { years: number | null; raw: string } {
  for (const re of YEAR_PATTERNS) {
    const m = re.exec(jdText);
    if (!m) continue;
    const years = toNumber(m[1]);
    if (years == null) continue;
    return { years, raw: m[0].trim() };
  }
  return { years: null, raw: "" };
}

const DEGREE_ORDER = ["博士", "硕士", "研究生", "本科", "学士", "大专", "专科", "中专", "高中"];

function detectDegree(jdText: string): string | null {
  for (const d of DEGREE_ORDER) {
    if (jdText.includes(d)) return d;
  }
  return null;
}

function detectTitle(jdText: string): string {
  const firstLine = jdText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return "";
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
}

/* ------------------------------ 主流程 ------------------------------ */

export function analyzeJd(jdText: string, resume: FlatResume): JdAnalysis {
  const jd = normalize(jdText);

  const keywords: JdKeyword[] = [];

  for (const entry of JD_LEXICON) {
    const inJd = entry.aliases.some((a) => jd.includes(a.toLowerCase()));
    if (!inJd) continue;

    const evidence = findEvidence(resume.plain, entry.aliases);

    keywords.push({
      term: entry.term,
      group: entry.group,
      groupLabel: LEX_GROUP_LABEL[entry.group],
      weight: entry.weight,
      hit: evidence !== "",
      evidence,
    });
  }

  // 重的排前面，同权重按分组保持稳定顺序
  keywords.sort((a, b) => b.weight - a.weight);

  const hits = keywords.filter((k) => k.hit);
  const missing = keywords.filter((k) => !k.hit);

  const totalWeight = keywords.reduce((sum, k) => sum + k.weight, 0);
  const hitWeight = hits.reduce((sum, k) => sum + k.weight, 0);
  const score = totalWeight === 0 ? 0 : Math.round((hitWeight / totalWeight) * 100);

  const yearsInfo = detectYears(jdText);

  return {
    keywords,
    hits,
    missing,
    coreMissing: missing.filter((k) => k.weight === 3),
    score,
    requirement: {
      years: yearsInfo.years,
      yearsRaw: yearsInfo.raw,
      degree: detectDegree(jdText),
      roleTitle: detectTitle(jdText),
    },
  };
}

/** 给界面用的一句话结论 */
export function summarizeScore(score: number, total: number): string {
  if (total === 0) return "没识别到关键词，检查一下是否粘贴了完整的岗位描述";
  if (score >= 80) return "匹配度很高，可以直接投";
  if (score >= 60) return "基本匹配，补上缺失项会更有把握";
  if (score >= 40) return "差距明显，建议先补关键词再投";
  return "匹配度偏低，投之前想清楚怎么解释跨度";
}
