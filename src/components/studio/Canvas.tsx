/* ============================================================================
 * 画布：A4 纸张悬浮在中间，可点选段落交给 AI
 *
 * 版式：画布铺满整个视口（顶栏、侧栏、AI 面板都浮在它上面），
 * 纸张在「两侧面板之间」的可用宽度里居中；面板开合时纸张随之平移 +
 * 缩放（弹簧曲线），而不是被挤压重排。
 *
 * 缩放用 transform: scale，外面套一个按缩放后尺寸占位的 .paper-stage，
 * 这样滚动范围正确、文字不重排。打印时 print.css 把缩放全部还原。
 *
 * 点选交互（沿用定稿逻辑）：
 *   - 点要点 / 公司名 / 模块标题 → toggle 选区（再点同一个取消）
 *   - 点条目内空白 → 选中整个条目；点模块内空白 → 选中整个模块
 *   - 点纸张空白 → 清空选区并关闭 AI 面板
 *   - AI 思考中 → 所有选区虚化
 * ========================================================================== */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { SECTION_MAP } from "../../data/sections";
import { useOverflow } from "../../hooks/useOverflow";
import { A4_WIDTH_PX } from "../../lib/units";
import { usePaperStore } from "../../store/usePaperStore";
import { selectionKey, useSelectionStore, type Selection } from "../../store/useSelectionStore";
import { useUiStore } from "../../store/useUiStore";
import { ResumeDocument } from "../preview/ResumeDocument";
import { canvasInsets, TOP } from "./layout";
import { registerCanvas } from "./paperLink";

const SELECTED_CLASS = "block-selected";
const THINKING_CLASS = "block-thinking";
const MIN_FIT = 0.42;

const labelOf = (key: string) => (SECTION_MAP as Record<string, { label: string }>)[key]?.label ?? "";

/** 取消选中后，鼠标离开前冻结悬停态（防同位置悬停抢视觉） */
function freezeUntilLeave(...els: HTMLElement[]) {
  for (const el of els) el.classList.add("hover-frozen");
  const unfreeze = () => {
    for (const el of els) {
      el.classList.remove("hover-frozen");
      el.removeEventListener("mouseleave", unfreeze);
    }
  };
  for (const el of els) el.addEventListener("mouseleave", unfreeze);
}

export function Canvas() {
  const inspectorOpen = useUiStore((s) => s.inspectorOpen);
  const zoom = useUiStore((s) => s.zoom);
  const accent = useUiStore((s) => s.paperAccent);
  const panelOpen = useSelectionStore((s) => s.panelOpen);
  const selections = useSelectionStore((s) => s.selections);
  const thinking = useSelectionStore((s) => s.thinking);
  const toggle = useSelectionStore((s) => s.toggle);
  const close = useSelectionStore((s) => s.close);
  const clearSelections = useSelectionStore((s) => s.clearSelections);
  const setPaper = usePaperStore((s) => s.set);

  const { measureRef, heightPx } = useOverflow();
  const scrollRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLElement>(null);
  const elsRef = useRef<HTMLElement[]>([]);
  const lastRippleRef = useRef(0);
  const [viewW, setViewW] = useState(() => window.innerWidth);
  const [paperH, setPaperH] = useState(1123);

  /* 可用宽度 → 自适应缩放 */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    registerCanvas(el);
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => {
      ro.disconnect();
      registerCanvas(null);
    };
  }, []);

  /* 纸张的布局高度（多页时会超过 297mm） */
  useLayoutEffect(() => {
    const el = paperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPaperH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { left, right } = canvasInsets(inspectorOpen, panelOpen);
  const fit = Math.max(MIN_FIT, Math.min(1, (viewW - left - right) / A4_WIDTH_PX));
  const scale = zoom === "fit" ? fit : zoom;

  useEffect(() => {
    setPaper({ contentPx: heightPx, scale });
  }, [heightPx, scale, setPaper]);

  /* 选区 → DOM 高亮同步（支持多个） */
  useEffect(() => {
    elsRef.current.forEach((el) => el.classList.remove(SELECTED_CLASS, THINKING_CLASS));
    elsRef.current = [];

    for (const sel of selections) {
      const sectionEl = document.querySelector<HTMLElement>(`.resume-paper [data-section-key="${sel.sectionKey}"]`);
      if (!sectionEl) continue;
      let target: HTMLElement | null = null;
      if (sel.level === "section") {
        target = sectionEl;
      } else if (sel.level === "entry" && sel.entryId) {
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
      }
    }
  }, [selections, thinking]);

  /** 已选中的块内飘过 → 轻涟漪 */
  const handleMouseMove = (e: React.MouseEvent) => {
    if (thinking) return;
    const target = e.target as HTMLElement;
    if (!target.closest(`.${SELECTED_CLASS}`)) return;
    const paper = paperRef.current;
    if (!paper) return;
    const now = performance.now();
    if (now - lastRippleRef.current < 90) return;
    lastRippleRef.current = now;
    const pr = paper.getBoundingClientRect();
    const dot = document.createElement("span");
    dot.className = "select-ripple no-print";
    dot.style.left = `${(e.clientX - pr.left) / scale}px`;
    dot.style.top = `${(e.clientY - pr.top) / scale}px`;
    paper.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove());
  };

  const pick = (e: React.MouseEvent, sel: Omit<Selection, "key">, freeze: HTMLElement[] = []) => {
    e.preventDefault();
    e.stopPropagation();
    const key = selectionKey(sel);
    if (freeze.length && useSelectionStore.getState().selections.some((x) => x.key === key)) {
      freezeUntilLeave(...freeze);
    }
    toggle({ ...sel, key });
  };

  /** 点击委托：toggle 选区 */
  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const paper = target.closest(".resume-paper");
    if (!paper) {
      // 点在画布空白（纸张之外）：只清选区，面板留着
      if (useSelectionStore.getState().selections.length) clearSelections();
      return;
    }
    // 拖选文字时不当成点击
    if (window.getSelection()?.toString()) return;

    const bulletLi = target.closest<HTMLElement>("[data-bullet-index]");
    const entryH3 = target.closest<HTMLElement>("[data-select-entry]");
    const sectionH2 = target.closest<HTMLElement>("[data-select-section]");

    if (bulletLi) {
      const article = bulletLi.closest<HTMLElement>("[data-entry-id]");
      const sectionEl = bulletLi.closest<HTMLElement>("[data-section-key]");
      if (article && sectionEl) {
        const sk = sectionEl.dataset.sectionKey!;
        pick(
          e,
          {
            level: "bullet",
            sectionKey: sk,
            sectionLabel: labelOf(sk),
            entryId: article.dataset.entryId!,
            entryLabel: article.querySelector("[data-select-entry]")?.getAttribute("data-entry-label") ?? "",
            bulletIndex: Number(bulletLi.dataset.bulletIndex),
            bulletText: bulletLi.textContent?.replace(/^•/, "").trim() ?? "",
          },
          [article],
        );
        return;
      }
    }

    if (entryH3 && !target.closest(".sub-meta")) {
      const article = entryH3.closest<HTMLElement>("[data-entry-id]");
      const sectionEl = entryH3.closest<HTMLElement>("[data-section-key]");
      if (article && sectionEl) {
        const sk = sectionEl.dataset.sectionKey!;
        pick(
          e,
          {
            level: "entry",
            sectionKey: sk,
            sectionLabel: labelOf(sk),
            entryId: article.dataset.entryId!,
            entryLabel: entryH3.getAttribute("data-entry-label") ?? "",
          },
          [article, sectionEl],
        );
        return;
      }
    }

    if (sectionH2) {
      const sk = sectionH2.dataset.selectSection!;
      const sectionEl = sectionH2.closest<HTMLElement>("[data-section-key]");
      pick(e, { level: "section", sectionKey: sk, sectionLabel: labelOf(sk) }, sectionEl ? [sectionEl] : []);
      return;
    }

    /* 点在条目内的空白 → 选中整个条目 */
    const hitArticle = target.closest<HTMLElement>("[data-entry-id]");
    const hitSection = target.closest<HTMLElement>("[data-section-key]");
    if (hitArticle && hitSection) {
      const sk = hitSection.dataset.sectionKey!;
      pick(e, {
        level: "entry",
        sectionKey: sk,
        sectionLabel: labelOf(sk),
        entryId: hitArticle.dataset.entryId!,
        entryLabel: hitArticle.querySelector("[data-select-entry]")?.getAttribute("data-entry-label") ?? "",
      });
      return;
    }

    /* 点在模块内（条目之外的空白）→ 选中整个模块 */
    if (hitSection) {
      const sk = hitSection.dataset.sectionKey!;
      pick(e, { level: "section", sectionKey: sk, sectionLabel: labelOf(sk) });
      return;
    }

    /* 点在纸张空白：清空选区 + 关闭面板 */
    close();
  };

  return (
    <div
      ref={scrollRef}
      className="studio-canvas thin-scroll absolute inset-0 overflow-auto"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
    >
      <div
        className="paper-pad min-h-full"
        style={{
          width: "max-content",
          minWidth: "100%",
          paddingTop: TOP + 20,
          paddingBottom: 112,
          paddingLeft: left,
          paddingRight: right,
          transition: "padding var(--spring-dur) var(--spring)",
        }}
      >
        <div
          className="paper-stage anim-rise mx-auto"
          style={{
            width: A4_WIDTH_PX * scale,
            height: paperH * scale,
            transition: "width var(--spring-dur) var(--spring), height var(--spring-dur) var(--spring)",
          }}
        >
          <div
            className="paper-scale"
            style={{
              width: A4_WIDTH_PX,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
              transition: "transform var(--spring-dur) var(--spring)",
            }}
          >
            <article ref={paperRef} className="resume-paper relative" data-accent={accent}>
              <div className="paper-safe-line no-print" />
              <div ref={measureRef} className="paper-content">
                <ResumeDocument />
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
