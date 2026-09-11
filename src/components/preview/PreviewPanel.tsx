/* 右侧预览：灰底画布 + A4 纸张 + 单页安全区参考线 + 溢出提示 */

import { useOverflow } from "../../hooks/useOverflow";
import { IconWarn } from "../icons";
import { ResumeDocument } from "./ResumeDocument";

export function PreviewPanel() {
  const { measureRef, overflowPx, isOverflow, pages } = useOverflow();

  return (
    <section className="app-preview flex min-h-0 flex-1 flex-col bg-slate-200/70">
      {isOverflow && (
        <div className="no-print flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-700">
          <IconWarn className="h-3.5 w-3.5 shrink-0" />
          <span>
            内容已超出单页约 {overflowPx} px，导出约 {pages} 页。建议精简表述，或用左侧的眼睛图标隐藏不太重要的模块。
          </span>
        </div>
      )}

      <div className="app-preview-scroll thin-scroll min-h-0 flex-1 overflow-auto px-6 py-6">
        <div className="resume-paper relative mx-auto">
          {/* 单页内容安全区底边（距纸张顶边 16mm + 265mm = 281mm），仅屏幕上可见 */}
          <div className="no-print pointer-events-none absolute inset-x-[14mm] top-[283mm] border-t border-dashed border-rose-300/70" />

          <div ref={measureRef} className="paper-content">
            <ResumeDocument />
          </div>
        </div>
      </div>
    </section>
  );
}
