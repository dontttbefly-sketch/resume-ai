/* ============================================================================
 * 导出 PDF 前的打印设置引导
 *
 * 为什么需要它：浏览器打印对话框里「页眉和页脚」默认是勾选的，
 * 勾着导出的 PDF 每页顶部有日期、底部有网址和页码 —— 这就是常被当成
 * "水印"的东西。实测 CSS（哪怕把页边距归零）无法关掉它，
 * 只有用户在对话框里取消勾选这一条路。
 *
 * 好消息：Chrome 会记住同一站点的打印偏好，取消一次以后默认就不勾了。
 * 所以这个引导只需要认真看一次，「不再提示」就是给这次用的。
 * ========================================================================== */

import { useState } from "react";

import { IconWarn } from "./icons";
import { Btn } from "./ui";

const DISMISS_KEY = "resume-ai/print-guide-dismissed";

export function isPrintGuideDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function PrintGuideDialog({
  onCancel,
  onProceed,
}: {
  onCancel: () => void;
  onProceed: () => void;
}) {
  const [dismiss, setDismiss] = useState(false);

  const proceed = () => {
    if (dismiss) {
      try {
        localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* 隐私模式下存不进去就算了，下次再提示一次 */
      }
    }
    onProceed();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-[460px] rounded-2xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-medium text-slate-800">导出前，请在打印窗口里改两个设置</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
          点「打开打印窗口」后，在打印预览的「更多设置」里：
        </p>

        <ol className="mt-3 space-y-2.5">
          <li className="flex gap-2.5">
            <span className="tnum flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11.5px] font-medium text-brand">
              1
            </span>
            <p className="text-[12.5px] leading-relaxed text-slate-700">
              <span className="font-medium">边距</span>选「无」—— 页面已内置 14mm 页边距
            </p>
          </li>
          <li className="flex gap-2.5">
            <span className="tnum flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11.5px] font-medium text-brand">
              2
            </span>
            <div className="text-[12.5px] leading-relaxed text-slate-700">
              <span className="font-medium">取消勾选「页眉和页脚」</span>
              <p className="mt-1 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11.5px] leading-relaxed text-amber-700">
                <IconWarn className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                不取消的话，每页顶部会印上日期、底部会印上网址和页码 ——
                就是那个去不掉的"水印"。浏览器没法替你关，只能在这里取消。
              </p>
            </div>
          </li>
        </ol>

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-[12px] text-slate-600">
          <input
            type="checkbox"
            checked={dismiss}
            onChange={(e) => setDismiss(e.target.checked)}
            className="h-3.5 w-3.5 accent-blue-600"
          />
          我记住了，下次不再提示
        </label>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Btn variant="ghost" onClick={onCancel}>
            取消
          </Btn>
          <Btn variant="primary" onClick={proceed}>
            打开打印窗口
          </Btn>
        </div>
      </div>
    </div>
  );
}
