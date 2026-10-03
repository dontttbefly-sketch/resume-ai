/* ============================================================================
 * 单页溢出检测
 *
 * 观察对象必须是「内容包裹层」（.paper-content），而不是纸张本身 ——
 * 纸张有 min-height: 297mm，高度恒定，永远测不出变化。
 *
 * 用 ResizeObserver 而不是依赖数组：触发源太多（打字、增删条目、切换模块、
 * 字体加载完成、窗口缩放），依赖数组一定会漏。
 *
 * 量的是「布局尺寸」（borderBoxSize / offsetHeight），不是 getBoundingClientRect：
 * 纸张在画布上会被 transform: scale 缩放，后者量到的是缩放后的视觉尺寸。
 * ========================================================================== */

import { useEffect, useRef, useState } from "react";
import { CONTENT_HEIGHT_PX, OVERFLOW_EPSILON_PX } from "../lib/units";

export function useOverflow(thresholdPx: number = CONTENT_HEIGHT_PX) {
  const ref = useRef<HTMLDivElement>(null);
  const [heightPx, setHeightPx] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.borderBoxSize?.[0];
      setHeightPx(box ? box.blockSize : el.offsetHeight);
    });
    observer.observe(el);

    // 字体加载前后行高会变，加载完成后必须复测一次
    document.fonts?.ready.then(() => setHeightPx(el.offsetHeight)).catch(() => {});

    return () => observer.disconnect();
  }, []);

  const over = heightPx - thresholdPx;
  const overflowPx = over > OVERFLOW_EPSILON_PX ? Math.round(over) : 0;
  // 一页装得下的内容高度是 thresholdPx，据此估算打印后会占几页
  const pages = Math.max(1, Math.ceil(heightPx / thresholdPx));

  return { measureRef: ref, heightPx, overflowPx, isOverflow: overflowPx > 0, pages };
}
