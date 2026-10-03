/* ============================================================================
 * AI 判岗：读完一张 JD，按「求职画像 + 判岗规则」给出 投 / 不投
 *
 * 在终端里跑技能时，判岗由智能体本人完成；搬进网页后没有智能体在场，
 * 由这里调用工作台已有的模型通道（/api/llm）完成同一件事。
 * 规则全部来自 user_profile.json（网页右侧可编辑），代码里不写死任何方向。
 *
 * 机械门槛（城市、薪资下限）仍由脚本过滤；这里额外做一条「薪资上限」的
 * 机械判定（用户的长期规则），命中直接不投，省一次模型调用。
 * ========================================================================== */

import { chatFull, type ChatMessage } from "./llm";
import type { BossProfile, Surface } from "./bossApi";

export interface Verdict {
  deliver: boolean;
  reason: string;
  direction: string;
  confidence: number | null;
  /** rule = 机械规则判定，ai = 模型判定 */
  source: "rule" | "ai";
  reasoning?: string;
  ms: number;
}

/** 「25-35K·14薪」→ { min: 25, max: 35 }；日薪 / 面议 → null */
export function salaryRange(text: string): { min: number; max: number } | null {
  const s = text.replace(/\s/g, "");
  const range = s.match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)K/i);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const one = s.match(/(\d+(?:\.\d+)?)K/i);
  if (one) return { min: Number(one[1]), max: Number(one[1]) };
  return null;
}

/** 机械规则：薪资上限。命中返回理由，否则 null */
export function ruleVerdict(card: Surface, profile: BossProfile): Verdict | null {
  const cap = Number(profile.max_salary_k ?? 0);
  const r = salaryRange(card.salary ?? "");
  if (cap > 0 && r && r.max > cap) {
    return {
      deliver: false,
      reason: `薪资上限 ${r.max}K 超过 ${cap}K（长期规则：一般过不了）`,
      direction: "",
      confidence: 1,
      source: "rule",
      ms: 0,
    };
  }
  return null;
}

const SYSTEM = `你是求职者本人的「判岗官」：替他决定 BOSS 直聘上这一个岗位要不要投简历。
只判断这一张，结论必须能被他的画像和规则直接支撑。

【输出】只输出一个 JSON 对象，不要解释、不要 Markdown：
{"verdict":"投" 或 "不投","reason":"不超过 40 字，点出决定性依据（命中或违反了哪条）","direction":"方向标签，如 AI产品经理 / AI应用开发 / Agent开发 / AIGC应用 / AI解决方案","confidence":0 到 1 之间的小数}

【判断方法】
1. 先看 JD 的核心工作内容（不是标题，不是加分项）是否落在求职方向里
2. 逐条对照「判岗规则」，命中任何一条否决就判不投
3. 「优先」「加分」类要求不算门槛
4. 拿不准时判不投，并在 reason 里写明不确定点`;

function list(items: string[] | undefined, empty = "（无）"): string {
  const xs = (items ?? []).filter(Boolean);
  return xs.length ? xs.join("、") : empty;
}

export function buildJudgeMessages(card: Surface, jd: string, profile: BossProfile, resumeBrief: string): ChatMessage[] {
  const cities = list(profile.target_cities?.length ? profile.target_cities : [profile.target_city ?? ""], "不限");
  const salary = `${profile.min_salary_k ?? 0}K 起${profile.max_salary_k ? `，上限 ${profile.max_salary_k}K` : ""}`;
  const rules = (profile.judge_rules ?? []).filter(Boolean);
  const company = [card.company, card.industry, card.scale, card.stage].filter(Boolean).join(" · ");

  const user = `【求职画像】
方向：${profile.role_summary || "（未填写）"}
希望投：${list(profile.prefer)}
不投：${list(profile.avoid)}
城市：${cities}；薪资：${salary}

【判岗规则】（逐条执行）
${rules.length ? rules.map((r, i) => `${i + 1}. ${r}`).join("\n") : "（无额外规则，只按方向判断）"}

【我的简历要点】（判断技能是否对口时参考）
${resumeBrief || "（略）"}

【岗位】
标题：${card.title}
薪资：${card.salary || "未标注"}　城市：${card.city || "未标注"}
公司：${company || "未标注"}
经验 / 学历：${[card.experience, card.degree].filter(Boolean).join(" / ") || "未标注"}

JD 正文：
${jd.slice(0, 4200)}`;

  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ];
}

export async function judgeJob(card: Surface, jd: string, profile: BossProfile, resumeBrief: string): Promise<Verdict> {
  const started = performance.now();
  const { content, reasoning } = await chatFull(buildJudgeMessages(card, jd, profile, resumeBrief), {
    temperature: 0.2,
    maxTokens: 8000,
  });
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("模型没有按格式给出结论");
  let parsed: { verdict?: string; reason?: string; direction?: string; confidence?: number };
  try {
    parsed = JSON.parse(m[0]);
  } catch {
    throw new Error("模型返回的结论不是合法 JSON");
  }
  const v = String(parsed.verdict ?? "").trim();
  if (v !== "投" && v !== "不投") throw new Error(`模型结论不明确：${v || "空"}`);
  return {
    deliver: v === "投",
    reason: String(parsed.reason ?? "").slice(0, 120),
    direction: String(parsed.direction ?? "").slice(0, 24),
    confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : null,
    source: "ai",
    reasoning,
    ms: Math.round(performance.now() - started),
  };
}
