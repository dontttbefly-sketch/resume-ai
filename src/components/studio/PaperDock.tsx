/* ============================================================================
 * 底部浮条：侧栏开关 · 缩放 · 页数余量
 *
 * 页数余量替代原来那条琥珀色警告横幅：一页内显示「还剩多少 px」，
 * 超出时显示「约几页 · 超出多少 px」，一眼知道还能不能往里加内容。
 * ========================================================================== */

import { CONTENT_HEIGHT_PX } from "../../lib/units";
import { usePaperStore } from "../../store/usePaperStore";
import { useSelectionStore } from "../../store/useSelectionStore";
import { useUiStore } from "../../store/useUiStore";
import { IconFit, IconMinus, IconPlus, IconSidebar } from "../icons";
import { IconButton } from "../kit/Button";
import { canvasInsets } from "./layout";

const STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5];

function Divider() {
  return <span className="mx-1 h-5 w-px bg-hairline-2" />;
}

function PageMeter() {
  const contentPx = usePaperStore((s) => s.contentPx);
  if (!contentPx) return null;

  const ratio = contentPx / CONTENT_HEIGHT_PX;
  const pages = Math.max(1, Math.ceil(ratio - 0.001));
  const over = Math.round(contentPx - CONTENT_HEIGHT_PX);
  const fits = over <= 1;
  // 一页内：进度条按「占一页的比例」填；超出：满格 + 溢出段
  const fill = Math.min(1, ratio);
  const spill = fits ? 0 : Math.min(1, ratio - 1);

  return (
    <div
      className="flex items-center gap-2.5 pl-1.5 pr-3"
      title={fits ? `单页内容高度上限 ${Math.round(CONTENT_HEIGHT_PX)}px` : "导出时会自动分页，每页都带 14mm 页边距"}
    >
      <span className="relative flex h-[22px] w-[16px] shrink-0 flex-col justify-end overflow-hidden rounded-[3px] bg-fill-2 shadow-[inset_0_0_0_1px_var(--hairline-2)]">
        <span
          className="block w-full bg-fg"
          style={{ height: `${fill * 100}%`, transition: "height 600ms var(--ease-out-quint)", opacity: 0.85 }}
        />
        {!fits && (
          <span
            className="absolute inset-x-0 top-0 block bg-danger"
            style={{ height: `${spill * 100}%`, transition: "height 600ms var(--ease-out-quint)" }}
          />
        )}
      </span>
      <span className="tnum whitespace-nowrap text-[12px] font-medium text-fg-2">
        {fits ? (
          <>
            1 页<span className="text-fg-4"> · 余 {Math.max(0, -over)}px</span>
          </>
        ) : (
          <>
            约 {pages} 页<span className="text-danger"> · 超出 {over}px</span>
          </>
        )}
      </span>
    </div>
  );
}

export function PaperDock() {
  const inspectorOpen = useUiStore((s) => s.inspectorOpen);
  const toggleInspector = useUiStore((s) => s.toggleInspector);
  const zoom = useUiStore((s) => s.zoom);
  const setZoom = useUiStore((s) => s.setZoom);
  const panelOpen = useSelectionStore((s) => s.panelOpen);
  const scale = usePaperStore((s) => s.scale);

  const { left, right } = canvasInsets(inspectorOpen, panelOpen);

  const step = (dir: 1 | -1) => {
    const cur = scale;
    const next =
      dir > 0 ? (STEPS.find((s) => s > cur + 0.001) ?? STEPS[STEPS.length - 1]) : ([...STEPS].reverse().find((s) => s < cur - 0.001) ?? STEPS[0]);
    setZoom(next);
  };

  return (
    <div
      className="no-print pointer-events-none fixed bottom-4 z-40 flex justify-center"
      style={{ left, right, transition: "left var(--spring-dur) var(--spring), right var(--spring-dur) var(--spring)" }}
    >
      <div className="glass anim-rise pointer-events-auto flex h-11 items-center px-1.5" style={{ ["--r" as string]: "999px" }}>
        <IconButton label={inspectorOpen ? "收起内容面板（⌘\\）" : "展开内容面板（⌘\\）"} tipTop pill active={inspectorOpen} onClick={toggleInspector}>
          <IconSidebar className="h-[17px] w-[17px]" />
        </IconButton>
        <Divider />
        <IconButton label="缩小" tipTop pill onClick={() => step(-1)} disabled={scale <= STEPS[0] + 0.001}>
          <IconMinus className="h-4 w-4" />
        </IconButton>
        <button
          type="button"
          onClick={() => setZoom(zoom === "fit" ? 1 : "fit")}
          className="press tnum h-8 w-[52px] rounded-full text-[12.5px] font-medium text-fg-2 hover:bg-fill-2 hover:text-fg"
          title={zoom === "fit" ? "切到 100%" : "适应宽度"}
        >
          {Math.round(scale * 100)}%
        </button>
        <IconButton label="放大" tipTop pill onClick={() => step(1)} disabled={scale >= STEPS[STEPS.length - 1] - 0.001}>
          <IconPlus className="h-4 w-4" />
        </IconButton>
        <IconButton label="适应宽度" tipTop pill active={zoom === "fit"} onClick={() => setZoom("fit")}>
          <IconFit className="h-4 w-4" />
        </IconButton>
        <Divider />
        <PageMeter />
      </div>
    </div>
  );
}
