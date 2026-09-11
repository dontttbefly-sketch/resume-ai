/* ============================================================================
 * 提示词模板与返回解析
 *
 * 输出格式刻意不用 JSON：推理模型的答案可能被 max_tokens 截断，
 * JSON 一旦少一个括号整份就废了；用 ### 分隔的纯文本，截断也能保住前面的条目。
 * JSON 解析仍然保留，作为兼容路径。
 * ========================================================================== */

import type { JdAnalysis } from "./jdMatch";
import type { ChatMessage } from "./llm";
import { renderForModel, type FlatResume } from "./resumeText";

export interface Phrase {
  /** 切入角度，例如「能力对标」 */
  angle: string;
  /** 话术正文 */
  text: string;
}

const SYSTEM = `你在帮一位中文求职者写招聘平台上的打招呼话术，话术会直接复制到 Boss 直聘、实习僧这类平台发给招聘方。

必须遵守：
- 每条 60 到 110 字，绝对不要超过 120 字
- 第一句就交代「我是谁 + 我能做什么」，不要用问候语开头
- 只能引用对方简历里真实存在的内容，绝对不许编造经历、公司、数字或技能
- 如果给了【经历库】，那是求职者自己补充的真实经历细节，比简历正文更丰富。写话术时可优先引用它来充实内容（它同样真实，不算编造），但数字和经历必须来自简历或经历库，仍不许凭空捏造
- 动词强度不得超过简历原文：简历写「接入」就不能写成「主导」「独立设计」，简历没写「独立完成」就不能这么讲。宁可平实，也不要拔高
- 简历里标明是实习、兼职的经历，不要用正式全职的口气去讲
- 呼应岗位描述里的关键词，但读起来要自然，不要堆词
- 不用「贵公司」「非常荣幸」「期待您的回复」这类模板腔
- 不用 emoji，不要连续感叹号
- 语气像一个有经验的职场人在正常说话
- 直接给结果，不要写任何解释、前言、总结或思考过程`;

const ANGLES = ["能力对标", "成果说话", "业务理解"] as const;

export function buildPhraseMessages(
  flat: FlatResume,
  jdText: string,
  analysis: JdAnalysis,
  experienceLibrary?: string,
): ChatMessage[] {
  const covered = analysis.hits.map((k) => k.term).join("、") || "（无）";
  const missing = analysis.missing.map((k) => k.term).join("、") || "（无）";
  const core = analysis.coreMissing.map((k) => k.term).join("、") || "（无）";

  const req = analysis.requirement;
  const reqLines = [
    req.roleTitle ? `岗位标题：${req.roleTitle}` : "",
    req.years != null ? `经验要求：${req.yearsRaw || `${req.years} 年`}` : "",
    req.degree ? `学历要求：${req.degree}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const roleHints: Record<(typeof ANGLES)[number], string> = {
    能力对标: "用简历里最贴合岗位要求的经历做正面回应",
    成果说话: "挑一个具体、可量化的成果展开",
    业务理解: "先说一句你对这个岗位要解决什么问题的判断，再接上自己的相关经验",
  };

  const formatSpec = ANGLES.map((a) => `### ${a}\n（${roleHints[a]}，只写话术正文）`).join(
    "\n\n",
  );

  const user = `【我的简历】
${renderForModel(flat)}
${experienceLibrary ? `\n【经历库（求职者补充的真实细节，可优先引用）】\n${experienceLibrary}` : ""}

【目标岗位描述】
${jdText.trim().slice(0, 3000)}

【本地比对结果】
匹配度：${analysis.score}%
已经覆盖：${covered}
尚未覆盖：${missing}
其中缺失的核心能力：${core}
${reqLines ? `\n${reqLines}` : ""}

请写 3 条话术，严格按下面的格式输出。每条以 ### 开头标注角度，正文写在下一行。
除了这三段内容，不要输出任何别的东西（不要前言、不要编号、不要代码块、不要总结）：

${formatSpec}`;

  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ];
}

/* ------------------------------ 返回解析 ------------------------------ */

/** 去掉模型可能包上的 markdown 代码块围栏 */
function stripFence(raw: string): string {
  return raw
    .replace(/^\s*```(?:json|markdown|md)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

/** 主路径：按 ### 角度 切分 */
function parseByHeading(text: string): Phrase[] {
  const chunks = text
    .split(/^[ \t]*#{2,4}[ \t]*/m)
    .map((c) => c.trim())
    .filter(Boolean);

  // 第一段没有换行、又不像角度名，基本是模型多说的前言，丢掉
  if (chunks.length > 1 && !chunks[0].includes("\n") && chunks[0].length > 14) {
    chunks.shift();
  }

  const list: Phrase[] = [];
  for (const chunk of chunks) {
    const breakAt = chunk.indexOf("\n");
    const rawAngle = breakAt >= 0 ? chunk.slice(0, breakAt) : chunk;
    const body = breakAt >= 0 ? chunk.slice(breakAt + 1) : "";
    const angle = rawAngle.replace(/[:：]\s*$/, "").trim();
    const text2 = body.trim();
    if (text2.length >= 15) list.push({ angle: angle || "话术", text: text2 });
  }
  return list.slice(0, 3);
}

/** 兼容路径：完整 JSON 数组 */
function parseByJson(text: string): Phrase[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];

  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): Phrase | null => {
        if (typeof item !== "object" || item === null) return null;
        const o = item as Record<string, unknown>;
        const angle = typeof o.angle === "string" ? o.angle.trim() : "";
        const body = typeof o.text === "string" ? o.text.trim() : "";
        return body ? { angle: angle || "话术", text: body } : null;
      })
      .filter((p): p is Phrase => p !== null)
      .slice(0, 3);
  } catch {
    return [];
  }
}

/** 抢救路径：JSON 被截断时，把已经写完整的对象逐个捞出来 */
function salvageJsonObjects(text: string): Phrase[] {
  const re = /"angle"\s*:\s*"([^"]{0,24})"[\s\S]{0,12}?"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  const list: Phrase[] = [];
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const angle = match[1].trim();
    const body = match[2]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();
    if (body.length >= 15) list.push({ angle: angle || "话术", text: body });
  }
  return list.slice(0, 3);
}

/** 最后兜底：按「1.」「角度：」这类行标切 */
function parseByLineMarker(text: string): Phrase[] {
  const blocks = text
    .split(/\n(?=\s*(?:\d+[.、)]|角度\s*[:：]|【))/)
    .map((b) => b.trim())
    .filter(Boolean);

  const list: Phrase[] = [];
  for (const block of blocks) {
    const body = block
      .replace(/^\s*(?:\d+[.、)]|角度\s*[:：]\s*[^：:\n]*[:：]?)\s*/, "")
      .replace(/^【[^】]*】\s*/, "")
      .trim();
    if (body.length >= 20) list.push({ angle: "话术", text: body });
  }
  return list.slice(0, 3);
}

export function parsePhrases(raw: string): Phrase[] {
  const cleaned = stripFence(raw);

  // 依次尝试，谁先解析出内容就用谁
  const parsers = [parseByHeading, parseByJson, salvageJsonObjects, parseByLineMarker];

  for (const parse of parsers) {
    const list = parse(cleaned);
    if (list.length > 0) return list;
  }

  // 实在解析不出来，把整段当成一条，别让用户白跑一次
  return cleaned.length >= 20 ? [{ angle: "完整回复", text: cleaned }] : [];
}
