/* ============================================================================
 * 中间：简历预览（可点选）
 *
 * 交互模型（见讨论定稿）：
 *   - 悬停可点段落：左侧浮现 2px 色条 + 极轻底色（不遮字）
 *   - 点击小段（bullet）→ 选中该段，AI 面板滑出
 *   - 点击公司标题（h3）→ 选中整个条目
 *   - 点击模块标题（h2）→ 选中整块
 *   - AI 思考中：选区高斯模糊 + 轻微下沉
 *   - 应用成功：改动处黄色高亮渐隐
 * ========================================================================== */

import { useEffect, useRef } from "react";
import { useOverflow } from "../../hooks/useOverflow";
import { IconWarn } from "../icons";
import { ResumeDocument } from "./ResumeDocument";
import { useSelectionStore, type Selection } from "../../store/useSelectionStore";
import { SECTION_MAP } from "../../data/sections";

const SELECTED_CLASS = "block-selected";
const THINKING_CLASS = "block-thinking";

export function PreviewPanel() {
  const { measureRef, overflowPx, isOverflow, pages } = useOverflow();
  const aiOpen = useSelectionStore((s) => s.aiOpen);
  const select = useSelectionStore((s) => s.select);
  const clear = useSelectionStore((s) => s.clear);
  const selection = useSelectionStore((s) => s.selection);
  const thinking = useSelectionStore((s) => s.thinking);
  const lastElRef = useRef<HTMLElement | null>(null);

  /** 根据当前 selection / thinking 同步 DOM 类 */
  useEffect(() => {
    const prev = lastElRef.current;
    if (prev) {
      prev.classList.remove(SELECTED_CLASS, THINKING_CLASS);
      lastElRef.current = null;
    }
    if (!selection) return;
    const el = document.querySelector<HTMLElement>(
      `[data-section-key="${selection.sectionKey}"]`,
    );
    if (!el) return;
    let target: HTMLElement | null = null;
    if (selection.level === "section") {
      target = el.querySelector<HTMLElement>("[data-select-section]");
    } else if (selection.level === "entry" && selection.entryId) {
      target = el.querySelector<HTMLElement>(`[data-entry-id="${selection.entryId}"] [data-select-entry]`);
    } else if (selection.level === "bullet" && selection.entryId != null) {
      target = el.querySelector<HTMLElement>(
        `[data-entry-id="${selection.entryId}"] [data-bullet-index="${selection.bulletIndex}"]`,
      );
    }
    if (target) {
      target.classList.add(SELECTED_CLASS);
      if (thinking) target.classList.add(THINKING_CLASS);
      lastElRef.current = target;
    }
  }, [selection, thinking]);

  /** 点击委托：从事件目标向上找最近的可点标记 */
  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const paper = target.closest(".resume-paper");
    if (!paper) return;

    const bulletLi = target.closest<HTMLElement>("[data-bullet-index]");
    const entryH3 = target.closest<HTMLElement>("[data-select-entry]");
    const sectionH2 = target.closest<HTMLElement>("[data-select-section]");

    if (bulletLi) {
      const article = bulletLi.closest<HTMLElement>("[data-entry-id]");
      const sectionEl = bulletLi.closest<HTMLElement>("[data-section-key]");
      if (article && sectionEl) {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(bulletLi.dataset.bulletIndex);
        const sel: Selection = {
          level: "bullet",
          sectionKey: sectionEl.dataset.sectionKey!,
          sectionLabel: (SECTION_MAP as Record<string, { label: string }>)[sectionEl.dataset.sectionKey || ""]?.label ?? "",
          entryId: article.dataset.entryId!,
          entryLabel: article.querySelector("[data-select-entry]")?.getAttribute("data-entry-label") ?? "",
          bulletIndex: idx,
          bulletText: bulletLi.textContent?.replace(/^•/, "").trim() ?? "",
        };
        select(sel);
        return;
      }
    }
    if (entryH3 && !target.closest(".sub-meta")) {
      const article = entryH3.closest<HTMLElement>("[data-entry-id]");
      const sectionEl = entryH3.closest<HTMLElement>("[data-section-key]");
      if (article && sectionEl) {
        e.preventDefault();
        e.stopPropagation();
        select({
          level: "entry",
          sectionKey: sectionEl.dataset.sectionKey!,
          sectionLabel: (SECTION_MAP as Record<string, { label: string }>)[sectionEl.dataset.sectionKey || ""]?.label ?? "",
          entryId: article.dataset.entryId!,
          entryLabel: entryH3.getAttribute("data-entry-label") ?? "",
        });
        return;
      }
    }
    if (sectionH2) {
      e.preventDefault();
      e.stopPropagation();
      select({
        level: "section",
        sectionKey: sectionH2.dataset.selectSection!,
        sectionLabel: (SECTION_MAP as Record<string, { label: string }>)[sectionH2.dataset.selectSection || ""]?.label ?? "",
      });
      return;
    }
    /* 点在空白处：取消选择（但不关面板——倾诉模式） */
    if (target === paper || target.classList.contains("paper-content")) {
      clear();
    }
  };

  return (
    <section
      className="app-preview relative flex min-h-0 flex-1 flex-col bg-slate-200/60"
      onClick={handleClick}
    >
      {isOverflow && (
        <div className="no-print flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-700">
          <IconWarn className="h-3.5 w-3.5 shrink-0" />
          <span>
            内容已超出单页约 {overflowPx} px，导出约 {pages} 页。建议精简表述，或用左侧的眼睛图标隐藏不太重要的模块。
          </span>
        </div>
      )}

      <div
        className={
          "app-preview-scroll thin-scroll min-h-0 flex-1 overflow-auto px-6 py-6 transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] " +
          (aiOpen ? "lg:pr-[420px]" : "")
        }
      >
        <div className="resume-paper relative mx-auto">
          {/* 单页内容安全区底边 */}
          <div className="no-print pointer-events-none absolute inset-x-[14mm] top-[283mm] border-t border-dashed border-rose-300/70" />

          <div ref={measureRef} className="paper-content">
            <ResumeDocument />
          </div>
        </div>
      </div>
    </section>
  );
}
