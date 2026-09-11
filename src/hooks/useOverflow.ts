/* ============================================================================
 * 单页溢出检测
 *
 * 观察对象必须是「内容包裹层」（.paper-content），而不是纸张本身 ——
 * 纸张有 min-height: 297mm，高度恒定，永远测不出变化。
 *
 * 用 ResizeObserver 而不是依赖数组：触发源太多（打字、增删条目、切换模块、
 * 字体加载完成、窗口缩放），依赖数组一定会漏。
 * ========================================================================== */

import { useEffect, useRef, useState } from "react";
import { CONTENT_HEIGHT_PX, OVERFLOW_EPSILON_PX } from "../lib/units";

export function useOverflow(thresholdPx: number = CONTENT_HEIGHT_PX) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowPx, setOverflowPx] = useState(0);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;

    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const height = el.getBoundingClientRect().height;
        const over = height - thresholdPx;
        setOverflowPx(over > OVERFLOW_EPSILON_PX ? Math.round(over) : 0);
        // 一页装得下的内容高度是 thresholdPx，据此估算打印后会占几页
        setPages(Math.max(1, Math.ceil(height / thresholdPx)));
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(el);

    // 字体加载前后行高会变，加载完成后必须复测一次
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(measure).catch(() => {});
    }

    measure();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [thresholdPx]);

  return { measureRef: ref, overflowPx, isOverflow: overflowPx > 0, pages };
}
