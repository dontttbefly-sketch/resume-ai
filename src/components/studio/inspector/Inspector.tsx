/* ============================================================================
 * 左侧：内容面板（检查器）
 *
 *   顶部一条模块索引（分段控件）：点击跳到对应模块；滚动时滑块跟着走
 *   基本信息卡 + 各模块的条目卡（收起成摘要，点开就地编辑）
 *
 * 主路径是「点纸上的段落让 AI 改」，这里负责完整、精确的手动编辑。
 * ========================================================================== */

import { useEffect, useRef, useState } from "react";

import { SECTION_MAP, SECTIONS } from "../../../data/sections";
import { useUiStore } from "../../../store/useUiStore";
import { IconSidebar } from "../../icons";
import { IconButton } from "../../kit/Button";
import { Segmented } from "../../kit/Segmented";
import { EDGE, INSPECTOR_W, TOP } from "../layout";
import { BasicsCard } from "./BasicsCard";
import { SectionBlock, SectionHeader } from "./SectionBlock";

const SHORT: Record<string, string> = {
  basics: "基本",
  strengths: "优势",
  work: "工作",
  projects: "项目",
  education: "教育",
  certificates: "证书",
  skills: "技能",
};

export function Inspector() {
  const open = useUiStore((s) => s.inspectorOpen);
  const toggle = useUiStore((s) => s.toggleInspector);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>(SECTIONS[0].key);
  const lockRef = useRef(0);

  /* 滚动监听：当前在看哪个模块 */
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    let raf = 0;
    const spy = () => {
      raf = 0;
      if (performance.now() < lockRef.current) return;
      const nodes = body.querySelectorAll<HTMLElement>("[data-insp-section]");
      let current = nodes[0]?.dataset.inspSection ?? SECTIONS[0].key;
      for (const n of nodes) {
        if (n.offsetTop - 40 <= body.scrollTop) current = n.dataset.inspSection!;
      }
      // 滚到底时最后一个模块可能顶不到上沿，直接算它
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 4) {
        current = nodes[nodes.length - 1]?.dataset.inspSection ?? current;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(spy);
    };
    body.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      body.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const jump = (key: string) => {
    const body = bodyRef.current;
    const el = body?.querySelector<HTMLElement>(`[data-insp-section="${key}"]`);
    if (!body || !el) return;
    setActive(key);
    // 程序滚动期间暂停监听，免得滑块途经中间模块来回跳
    lockRef.current = performance.now() + 700;
    body.scrollTo({ top: el.offsetTop - 10, behavior: "smooth" });
  };

  return (
    <aside
      aria-hidden={!open}
      className="glass no-print fixed z-30 flex flex-col"
      style={{
        left: EDGE,
        top: TOP,
        bottom: EDGE,
        width: INSPECTOR_W,
        transform: open ? "none" : `translateX(calc(-100% - ${EDGE + 12}px))`,
        opacity: open ? 1 : 0,
        pointerEvents: open ? undefined : "none",
        transition: "transform var(--spring-dur) var(--spring), opacity 320ms var(--ease-out-quint)",
      }}
    >
      <div className="flex items-start gap-2 px-4 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-fg">简历内容</p>
          <p className="mt-0.5 text-[11.5px] text-fg-4">在这里改，纸面实时同步；点纸上的段落可交给 AI 改写</p>
        </div>
        <IconButton label="收起（⌘\）" onClick={toggle}>
          <IconSidebar className="h-[17px] w-[17px]" />
        </IconButton>
      </div>

      <div className="px-3 pb-2">
        <Segmented
          size="sm"
          className="w-full [&>button]:flex-1 [&>button]:!px-0"
          value={active}
          onChange={jump}
          options={SECTIONS.map((d) => ({ value: d.key, label: SHORT[d.key] ?? d.label.slice(0, 2), title: d.label }))}
        />
      </div>

      <div ref={bodyRef} className="thin-scroll fade-y relative min-h-0 flex-1 space-y-6 overflow-y-auto px-3 pb-10 pt-3">
        <section data-insp-section="basics">
          <SectionHeader desc={SECTION_MAP.basics} />
          <div className="mt-1.5">
            <BasicsCard />
          </div>
        </section>
        {SECTIONS.filter((d) => d.key !== "basics").map((d) => (
          <SectionBlock key={d.key} desc={d} />
        ))}
      </div>
    </aside>
  );
}
