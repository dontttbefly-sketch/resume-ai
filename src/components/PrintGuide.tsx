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

import { IconDownload, IconInfo } from "./icons";
import { Button } from "./kit/Button";
import { Dialog } from "./kit/Dialog";

const DISMISS_KEY = "resume-ai/print-guide-dismissed";

export function isPrintGuideDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-solid text-[12px] font-semibold text-on-solid">
        {n}
      </span>
      <div className="pt-0.5 text-[13.5px] leading-relaxed text-fg-2">{children}</div>
    </li>
  );
}

export function PrintGuideDialog({
  open,
  onCancel,
  onProceed,
}: {
  open: boolean;
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
    <Dialog open={open} onClose={onCancel} width={460}>
      <span className="surface curve mb-5 flex h-11 w-11 items-center justify-center text-fg-2" style={{ ["--r" as string]: "14px" }}>
        <IconDownload className="h-5 w-5" />
      </span>
      <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-fg">导出前，改两个打印设置</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-fg-3">打开打印窗口后，在「更多设置」里：</p>

      <ol className="mt-5 space-y-4">
        <Step n={1}>
          <span className="font-semibold text-fg">边距</span> 选「无」—— 页面已内置 14mm 页边距
        </Step>
        <Step n={2}>
          <span className="font-semibold text-fg">取消勾选「页眉和页脚」</span>
          <p className="surface mt-2.5 flex items-start gap-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-fg-3" style={{ ["--r" as string]: "12px" }}>
            <IconInfo className="mt-0.5 h-4 w-4 shrink-0" />
            不取消的话，每页顶部会印上日期、底部印上网址和页码，就是那个去不掉的"水印"。浏览器只允许在这里关。
          </p>
        </Step>
      </ol>

      <label className="mt-6 flex cursor-pointer items-center gap-2.5 text-[13px] text-fg-2">
        <input
          type="checkbox"
          checked={dismiss}
          onChange={(e) => setDismiss(e.target.checked)}
          className="h-4 w-4 accent-[var(--fg)]"
        />
        我记住了，下次不再提示
      </label>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" size="md" onClick={onCancel}>
          取消
        </Button>
        <Button variant="primary" size="md" onClick={proceed}>
          打开打印窗口
        </Button>
      </div>
    </Dialog>
  );
}
