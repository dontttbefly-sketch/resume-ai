/* ============================================================================
 * 侧栏 ↔ 纸张联动
 *   悬停侧栏的条目 → 纸上对应段落浮出标记线
 *   展开侧栏的条目 → 纸张滚到那一段
 * 直接改 DOM class，不走 React 状态：联动是纯视觉的，不值得触发重渲染
 * ========================================================================== */

let canvasEl: HTMLElement | null = null;

export function registerCanvas(el: HTMLElement | null): void {
  canvasEl = el;
}

function paperQuery(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`.resume-paper ${selector}`));
}

export function entrySelector(id: string): string {
  return `[data-entry-id="${CSS.escape(id)}"]`;
}

export function sectionSelector(key: string): string {
  return `[data-section-key="${CSS.escape(key)}"]`;
}

export function linkOnPaper(selector: string, on: boolean): void {
  for (const el of paperQuery(selector)) el.classList.toggle("is-linked", on);
}

/** 不在可视区就平滑滚过去，并短暂亮一下 */
export function revealOnPaper(selector: string, flash = true): void {
  const el = paperQuery(selector)[0];
  if (!el || !canvasEl) return;
  const c = canvasEl.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const visible = r.top >= c.top + 96 && r.bottom <= c.bottom - 96;
  if (!visible) {
    canvasEl.scrollTo({ top: canvasEl.scrollTop + r.top - c.top - 150, behavior: "smooth" });
  }
  if (flash) {
    el.classList.add("is-linked");
    window.setTimeout(() => el.classList.remove("is-linked"), 1200);
  }
}

/** 应用 AI 改写后，那一段扫过一道墨色晕染 */
export function flashApplied(selector: string): void {
  for (const el of paperQuery(selector)) {
    el.classList.remove("block-applied");
    void el.offsetWidth; // 重启动画
    el.classList.add("block-applied");
    window.setTimeout(() => el.classList.remove("block-applied"), 1400);
  }
}
