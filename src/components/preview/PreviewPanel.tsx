/* ============================================================================
 * 中间：简历预览（可多选）
 *
 * 交互（第三轮定稿）：
 *   - 点击段落/公司名/模块标题 → toggle 选区（再点同一个取消）
 *   - 选中 entry 级 → 高亮整个条目卡片（不只标题）
 *   - 点空白 → 清空全部选区 + 关面板
 *   - thinking → 所有选区模糊
 * ========================================================================== */

import { useEffect, useRef } from "react";
import { useOverflow } from "../../hooks/useOverflow";
import { IconWarn } from "../icons";
import { ResumeDocument } from "./ResumeDocument";
import { useSelectionStore, selectionKey } from "../../store/useSelectionStore";
import { SECTION_MAP } from "../../data/sections";

const SELECTED_CLASS = "block-selected";
const THINKING_CLASS = "block-thinking";

export function PreviewPanel() {
  const { measureRef, overflowPx, isOverflow, pages } = useOverflow();
  const toggle = useSelectionStore((s) => s.toggle);
  const close = useSelectionStore((s) => s.close);
  const selections = useSelectionStore((s) => s.selections);
  const thinking = useSelectionStore((s) => s.thinking);
  const panelOpen = useSelectionStore((s) => s.panelOpen);
  const elsRef = useRef<HTMLElement[]>([]);
  const lastRippleRef = useRef(0);

  /** 已选中的块内飘过 → 轻涟漪（它们已浮起，不再二次触发浮起） */
  const handleMouseMove = (e: React.MouseEvent) => {
    if (useSelectionStore.getState().thinking) return;
    const target = e.target as HTMLElement;
    if (!target.closest(".block-selected")) return;
    const paper = target.closest(".resume-paper");
    if (!paper) return;
    const now = Date.now();
    if (now - lastRippleRef.current < 90) return;
    lastRippleRef.current = now;
    const pr = paper.getBoundingClientRect();
    const dot = document.createElement("span");
    dot.className = "select-ripple";
    dot.style.left = `${e.clientX - pr.left}px`;
    dot.style.top = `${e.clientY - pr.top}px`;
    paper.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove());
  };

  /** 选区 → DOM 高亮同步（支持多个） */
  useEffect(() => {
    elsRef.current.forEach((el) => el.classList.remove(SELECTED_CLASS, THINKING_CLASS, "block-selected-card"));
    elsRef.current = [];

    for (const sel of selections) {
      const sectionEl = document.querySelector<HTMLElement>(`[data-section-key="${sel.sectionKey}"]`);
      if (!sectionEl) continue;
      let target: HTMLElement | null = null;
      if (sel.level === "section") {
        /* section 级：高亮整个模块（标题 + 全部条目） */
        target = sectionEl;
      } else if (sel.level === "entry" && sel.entryId) {
        /* entry 级：高亮整个条目卡片（标题 + 灰字 + 全部要点） */
        target = sectionEl.querySelector<HTMLElement>(`[data-entry-id="${sel.entryId}"]`);
      } else if (sel.level === "bullet" && sel.entryId != null) {
        target = sectionEl.querySelector<HTMLElement>(
          `[data-entry-id="${sel.entryId}"] [data-bullet-index="${sel.bulletIndex}"]`,
        );
      }
      if (target) {
        target.classList.add(SELECTED_CLASS);
        target.dataset.level = sel.level;
        if (thinking) target.classList.add(THINKING_CLASS);
        elsRef.current.push(target);
        /* bullet 级 → 父卡片也加标记（视觉强化） */
        if (sel.level === "bullet") {
          const card = target.closest<HTMLElement>("[data-entry-id]");
          if (card && !card.classList.contains("block-selected-card")) {
            card.classList.add("block-selected-card");
            elsRef.current.push(card);
          }
        }
      }
    }
  }, [selections, thinking]);

  /** 点击委托：toggle 选区 */
  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const paper = target.closest(".resume-paper");
    if (!paper) return;

    const bulletLi = target.closest<HTMLElement>("[data-bullet-index]");
    const entryH3 = target.closest<HTMLElement>("[data-select-entry]");
    const sectionH2 = target.closest<HTMLElement>("[data-select-section]");

    /* 清掉所有 bullet 联动的父卡片 class（再由 toggle 决定是否重新加） */
    document
      .querySelectorAll<HTMLElement>(".block-selected-card")
      .forEach((el) => el.classList.remove("block-selected-card"));
    if (bulletLi) {
      const article = bulletLi.closest<HTMLElement>("[data-entry-id]");
      const sectionEl = bulletLi.closest<HTMLElement>("[data-section-key]");
      if (article && sectionEl) {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(bulletLi.dataset.bulletIndex);
        const entryLabel =
          article.querySelector("[data-select-entry]")?.getAttribute("data-entry-label") ?? "";
        const sk = sectionEl.dataset.sectionKey!;
        const eid = article.dataset.entryId!;
        const key = selectionKey({ level: "bullet", sectionKey: sk, entryId: eid, bulletIndex: idx, sectionLabel: "" });
        /* 判断这次是取消分支（store 中已有该 key）→ 冻结 hover 200ms 避免同位置 hover 抢视觉 */
        const cur = useSelectionStore.getState();
        if (cur.selections.some((x) => x.key === key)) {
          /* 取消：冻结到鼠标离开为止 */
          article.classList.add("hover-frozen");
          const unfreeze = () => {
            article.classList.remove("hover-frozen");
            article.removeEventListener("mouseleave", unfreeze);
          };
          article.addEventListener("mouseleave", unfreeze);
        }
        toggle({
          level: "bullet",
          sectionKey: sk,
          sectionLabel: (SECTION_MAP as Record<string, { label: string }>)[sk]?.label ?? "",
          entryId: eid,
          entryLabel,
          bulletIndex: idx,
          bulletText: bulletLi.textContent?.replace(/^•/, "").trim() ?? "",
          key,
        });
        return;
      }
    }
    if (entryH3 && !target.closest(".sub-meta")) {
      const article = entryH3.closest<HTMLElement>("[data-entry-id]");
      const sectionEl = entryH3.closest<HTMLElement>("[data-section-key]");
      if (article && sectionEl) {
        e.preventDefault();
        e.stopPropagation();
        const sk = sectionEl.dataset.sectionKey!;
        const eid = article.dataset.entryId!;
        const key = selectionKey({ level: "entry", sectionKey: sk, entryId: eid, sectionLabel: "" });
        const cur = useSelectionStore.getState();
        if (cur.selections.some((x) => x.key === key)) {
          /* 取消：冻结到鼠标离开为止 */
          article.classList.add("hover-frozen");
          sectionEl.classList.add("hover-frozen");
          const unfreeze = () => {
            article.classList.remove("hover-frozen");
            sectionEl.classList.remove("hover-frozen");
            article.removeEventListener("mouseleave", unfreeze);
            sectionEl.removeEventListener("mouseleave", unfreeze);
          };
          article.addEventListener("mouseleave", unfreeze);
          sectionEl.addEventListener("mouseleave", unfreeze);
        }
        toggle({
          level: "entry",
          sectionKey: sk,
          sectionLabel: (SECTION_MAP as Record<string, { label: string }>)[sk]?.label ?? "",
          entryId: eid,
          entryLabel: entryH3.getAttribute("data-entry-label") ?? "",
          key,
        });
        return;
      }
    }
    if (sectionH2) {
      e.preventDefault();
      e.stopPropagation();
      const sk = sectionH2.dataset.selectSection!;
      const key = selectionKey({ level: "section", sectionKey: sk, sectionLabel: "" });
      const sectionEl = sectionH2.closest<HTMLElement>("[data-section-key]");
      const cur = useSelectionStore.getState();
      if (sectionEl && cur.selections.some((x) => x.key === key)) {
        sectionEl.classList.add("hover-frozen");
        const unfreeze = () => {
          sectionEl.classList.remove("hover-frozen");
          sectionEl.removeEventListener("mouseleave", unfreeze);
        };
        sectionEl.addEventListener("mouseleave", unfreeze);
      }
      toggle({
        level: "section",
        sectionKey: sk,
        sectionLabel: (SECTION_MAP as Record<string, { label: string }>)[sk]?.label ?? "",
        key,
      });
      return;
    }
    /* 点在条目内的空白（非段落）→ 选中整个条目 */
    const hitArticle = target.closest<HTMLElement>("[data-entry-id]");
    if (hitArticle) {
      const sectionEl = hitArticle.closest<HTMLElement>("[data-section-key]");
      if (sectionEl) {
        e.preventDefault();
        e.stopPropagation();
        const sk = sectionEl.dataset.sectionKey!;
        const eid = hitArticle.dataset.entryId!;
        const entryLabel =
          hitArticle.querySelector("[data-select-entry]")?.getAttribute("data-entry-label") ?? "";
        toggle({
          level: "entry",
          sectionKey: sk,
          sectionLabel: (SECTION_MAP as Record<string, { label: string }>)[sk]?.label ?? "",
          entryId: eid,
          entryLabel,
          key: selectionKey({ level: "entry", sectionKey: sk, entryId: eid, sectionLabel: "" }),
        });
        return;
      }
    }

    /* 点在模块内（条目之外的空白）→ 选中整个模块 */
    const hitSection = target.closest<HTMLElement>("[data-section-key]");
    if (hitSection) {
      e.preventDefault();
      e.stopPropagation();
      const sk = hitSection.dataset.sectionKey!;
      toggle({
        level: "section",
        sectionKey: sk,
        sectionLabel: (SECTION_MAP as Record<string, { label: string }>)[sk]?.label ?? "",
        key: selectionKey({ level: "section", sectionKey: sk, sectionLabel: "" }),
      });
      return;
    }

    /* 点在纸张空白：清空选区 + 关闭面板 */
    if (target === paper || target.classList.contains("paper-content")) {
      close();
    }
  };

  return (
    <section
      className="app-preview relative flex min-h-0 flex-1 flex-col bg-slate-200/60"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
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
          "app-preview-scroll thin-scroll min-h-0 flex-1 overflow-auto px-10 py-10 transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] " +
          (panelOpen ? "lg:pr-[420px]" : "")
        }
      >
        <div
          className="resume-paper relative mx-auto"
          style={{
            transform: `scale(${panelOpen ? 0.88 : 1})`,
            transformOrigin: "top center",
            transition: "transform 300ms cubic-bezier(0.32,0.72,0,1)",
          }}
        >
          <div className="no-print pointer-events-none absolute inset-x-[14mm] top-[283mm] border-t border-dashed border-rose-300/70" />
          <div ref={measureRef} className="paper-content">
            <ResumeDocument />
          </div>
        </div>
      </div>
    </section>
  );
}
