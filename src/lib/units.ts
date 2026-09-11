/* ============================================================================
 * 尺寸换算与格式化
 * ========================================================================== */

/** CSS 标准：1 英寸 = 96px，1 英寸 = 25.4mm */
export const MM_TO_PX = 96 / 25.4; // ≈ 3.7795

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PAGE_PADDING_MM = 14;

export const A4_WIDTH_PX = A4_WIDTH_MM * MM_TO_PX; // ≈ 793.70
export const A4_HEIGHT_PX = A4_HEIGHT_MM * MM_TO_PX; // ≈ 1122.52

/** 单页可用的内容高度 = (297 - 14×2) mm ≈ 269mm ≈ 1016.6px */
export const CONTENT_HEIGHT_PX = (A4_HEIGHT_MM - PAGE_PADDING_MM * 2) * MM_TO_PX;

/** 浮点容差，避免在临界值反复抖动 */
export const OVERFLOW_EPSILON_PX = 1;

/** 纸张上「内容安全区」底边距纸张顶部的距离 = 14 + 269 = 283mm */
export const SAFE_AREA_BOTTOM_MM = PAGE_PADDING_MM + (A4_HEIGHT_MM - PAGE_PADDING_MM * 2);

/**
 * 「2020-09」→「2020.09」；「2020-9」→「2020.09」
 * 其他自由文本（如「至今」「2024 年 7 月」）原样返回。
 */
export function formatMonth(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  const m = /^(\d{4})-(\d{1,2})$/.exec(v);
  if (!m) return v;
  return `${m[1]}.${m[2].padStart(2, "0")}`;
}
