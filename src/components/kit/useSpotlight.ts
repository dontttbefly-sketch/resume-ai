/* ============================================================================
 * 跟随指针的玻璃高光
 *
 * 只写两个 CSS 变量（--mx / --my），由 .glass.spot::after 的径向渐变消费。
 * rAF 合帧，触屏与「减少动态效果」下不启用。
 * ========================================================================== */

import { useCallback, useRef } from "react";

const enabled =
  typeof window !== "undefined" &&
  window.matchMedia?.("(pointer: fine)").matches &&
  !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useSpotlight<T extends HTMLElement>() {
  const cleanup = useRef<(() => void) | null>(null);

  return useCallback((el: T | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el || !enabled) return;

    let raf = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      raf = 0;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      el.style.setProperty("--my", "-40%");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    cleanup.current = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);
}
