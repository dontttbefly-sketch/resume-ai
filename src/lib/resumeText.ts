/* ============================================================================
 * 把简历数据拍平成纯文本
 *
 * 两个用途：
 *   1. 本地关键词比对（不需要模型，快且可解释）
 *   2. 喂给模型时保持模块结构，让话术能引用到具体经历
 *
 * 只取「当前可见」的模块 —— 隐藏的模块不会出现在简历上，也不该参与匹配。
 * ========================================================================== */

import { SECTIONS } from "../data/sections";
import type { EntryData } from "../data/schema";
import { asString, readList } from "./resume";

export interface ResumeBlock {
  label: string;
  lines: string[];
}

export interface FlatResume {
  /** 所有可见模块的文本拼成一段，供关键词比对 */
  plain: string;
  /** 按模块分组的文本，喂模型时保持结构 */
  blocks: ResumeBlock[];
}

export function flattenResume(
  sections: Record<string, EntryData[]>,
  visibility: Record<string, boolean>,
): FlatResume {
  const blocks: ResumeBlock[] = [];

  for (const desc of SECTIONS) {
    const visible = visibility[desc.key] ?? desc.defaultVisible;
    if (!visible) continue;

    const lines: string[] = [];

    for (const entry of sections[desc.key] ?? []) {
      const head: string[] = [];
      const bullets: string[] = [];

      for (const field of desc.entry.fields) {
        if (field.control === "bullets") {
          bullets.push(...readList(entry, field.key).filter(Boolean));
          continue;
        }
        // 图片是 URL 或 dataURL，混进文本会污染关键词比对，也会把超长字符串喂给模型
        if (field.control === "image") continue;

        const value = asString(entry.values[field.key]).trim();
        if (value) head.push(value);
      }

      if (head.length) lines.push(head.join(" | "));
      for (const bullet of bullets) lines.push(`· ${bullet}`);
    }

    if (lines.length) blocks.push({ label: desc.label, lines });
  }

  return {
    plain: blocks.map((b) => `${b.label}：${b.lines.join("；")}`).join("\n"),
    blocks,
  };
}

/** 给模型看的结构化文本（比 plain 多保留换行层级） */
export function renderForModel(flat: FlatResume): string {
  return flat.blocks
    .map((b) => `【${b.label}】\n${b.lines.map((l) => (l.startsWith("· ") ? l : l)).join("\n")}`)
    .join("\n\n");
}
