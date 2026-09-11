/* ============================================================================
 * 简历取数、分组与自检
 *
 * 这一层是「描述符」和「界面」之间的胶水：所有组件通过这里的函数按 role
 * 取字段，而不是按字段名硬编码。
 * ========================================================================== */

import type { EntryData, FieldDescriptor, FieldRole, FieldValue, SectionDescriptor } from "../data/schema";
import { SECTIONS } from "../data/sections";
import { formatMonth } from "./units";

/* ------------------------------- id ------------------------------- */

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/* ------------------------------ 取值 ------------------------------ */

/** 把任意字段值归一成字符串（数组用空格连接） */
export function asString(v: FieldValue | undefined): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.filter(Boolean).join(" ");
  return v;
}

/** 把任意字段值归一成字符串数组 */
export function asList(v: FieldValue | undefined): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return v.trim() ? [v] : [];
}

export function readStr(entry: EntryData, key: string): string {
  return asString(entry.values[key]);
}

export function readList(entry: EntryData, key: string): string[] {
  return asList(entry.values[key]);
}

/** 该字段是否有内容（数组只要有一条非空即算有） */
export function isFilled(entry: EntryData, key: string): boolean {
  const v = entry.values[key];
  if (Array.isArray(v)) return v.some((s) => s.trim() !== "");
  return (v ?? "").trim() !== "";
}

/** 一条条目是否完全为空 */
export function isEntryEmpty(desc: SectionDescriptor, entry: EntryData): boolean {
  return !desc.entry.fields.some((f) => isFilled(entry, f.key));
}

/* ------------------------------ 分组 ------------------------------ */

/** 取某个排版角色下的所有字段，保持配置顺序 */
export function fieldsByRole(desc: SectionDescriptor, role: FieldRole): FieldDescriptor[] {
  return desc.entry.fields.filter((f) => f.role === role);
}

/**
 * 把若干字段的值用「 · 」连起来，并去掉空值。
 * 用于联系方式行、职位/城市行、技术栈行。
 */
export function joinValues(entry: EntryData, fields: readonly FieldDescriptor[], sep = " · "): string {
  return fields
    .map((f) => asString(entry.values[f.key]).trim())
    .filter(Boolean)
    .join(sep);
}

/** 技术栈之类的文本按逗号切成标签 */
export function splitTags(raw: string): string[] {
  return raw
    .split(/[,，、;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 把一条条目的起止时间格式化成「2020.09 – 2024.06」 */
export function formatDateRange(entry: EntryData, fields: readonly FieldDescriptor[]): string {
  const parts = fields.map((f) => formatMonth(asString(entry.values[f.key]))).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} – ${parts[parts.length - 1]}`;
}

/* ---------------------------- 完成度自检 ---------------------------- */

export interface MissingItem {
  section: string;
  label: string;
}

export interface CompletionReport {
  filled: number;
  total: number;
  percent: number;
  missing: MissingItem[];
}

/**
 * 只检查「当前可见」的模块；隐藏的模块不参与评分，因为它不会出现在简历上。
 */
export function checkCompletion(
  sections: Record<string, EntryData[]>,
  visibility: Record<string, boolean>,
): CompletionReport {
  let filled = 0;
  let total = 0;
  const missing: MissingItem[] = [];

  for (const desc of SECTIONS) {
    const visible = visibility[desc.key] ?? desc.defaultVisible;
    if (!visible) continue;

    const entries = sections[desc.key] ?? [];

    // 1) 必填字段：所有条目里至少有一条填了就算过
    for (const f of desc.entry.fields) {
      if (!f.required) continue;
      total += 1;
      if (entries.some((e) => isFilled(e, f.key))) {
        filled += 1;
      } else {
        missing.push({ section: desc.label, label: f.label });
      }
    }

    // 2) 内容型模块：整体不能是空的
    if (desc.layout === "entries") {
      total += 1;
      if (entries.some((e) => !isEntryEmpty(desc, e))) {
        filled += 1;
      } else {
        missing.push({ section: desc.label, label: `至少填写${desc.entry.itemNoun}` });
      }
    }

    if (desc.layout === "skill-list") {
      total += 1;
      if (entries.some((e) => desc.entry.fields.some((f) => isFilled(e, f.key)))) {
        filled += 1;
      } else {
        missing.push({ section: desc.label, label: `至少填写${desc.entry.itemNoun}` });
      }
    }
  }

  const percent = total === 0 ? 100 : Math.round((filled / total) * 100);
  return { filled, total, percent, missing };
}
