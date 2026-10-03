/* 工作台的版式常量（顶栏 / 侧栏 / AI 面板的尺寸与间距） */

export const EDGE = 12;
/** 顶栏底边 + 间距：12 + 56 + 12 */
export const TOP = 80;
export const INSPECTOR_W = 368;
export const AI_W = 404;
/** 纸张与两侧面板之间留白 */
export const GUTTER = 32;

/** 画布左右留给面板的距离 */
export function canvasInsets(inspectorOpen: boolean, aiOpen: boolean): { left: number; right: number } {
  return {
    left: inspectorOpen ? EDGE + INSPECTOR_W + GUTTER : GUTTER,
    right: aiOpen ? EDGE + AI_W + GUTTER : GUTTER,
  };
}
