/* ============================================================================
 * 页面级过渡：视图切换、主题切换
 *
 * 用浏览器原生 View Transitions：只对两张快照做合成层动画，
 * 不在 JS 里逐帧改样式，开销接近零；不支持的浏览器直接瞬时切换。
 * ========================================================================== */

import { flushSync } from "react-dom";

import { applyTheme, resolveTheme, useUiStore, type AppView, type ThemePref } from "../store/useUiStore";

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

type VtDocument = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

export function switchView(view: AppView): void {
  const ui = useUiStore.getState();
  if (ui.view === view) return;
  const doc = document as VtDocument;
  const run = () => flushSync(() => useUiStore.getState().setView(view));
  if (!doc.startViewTransition || reduced()) {
    run();
    return;
  }
  doc.startViewTransition(run);
}

/** 主题切换：从 (x, y) 处圆形展开新主题 */
export function setThemeAnimated(pref: ThemePref, x?: number, y?: number): void {
  const doc = document as VtDocument;
  const before = resolveTheme(useUiStore.getState().theme);
  const apply = () => {
    useUiStore.getState().setTheme(pref);
    applyTheme(pref);
  };

  if (!doc.startViewTransition || reduced() || before === resolveTheme(pref)) {
    flushSync(apply);
    return;
  }

  const root = document.documentElement;
  const cx = x ?? window.innerWidth;
  const cy = y ?? 0;
  const r = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));
  root.style.setProperty("--vt-x", `${cx}px`);
  root.style.setProperty("--vt-y", `${cy}px`);
  root.style.setProperty("--vt-r", `${r}px`);
  root.classList.add("theme-vt");
  doc
    .startViewTransition(() => flushSync(apply))
    .finished.finally(() => root.classList.remove("theme-vt"));
}
