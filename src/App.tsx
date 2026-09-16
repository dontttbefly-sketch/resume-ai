/* ============================================================================
 * AI native 简历工作台
 *
 * 布局（见讨论定稿）：
 *   ┌─────────────┬──────────────────────┐
 *   │ 左：模块目录   │  中：简历预览（可点选）  │      右：AI 面板（浮动滑出）
 *   │ 灰字平铺可编辑 │  点小段 / 大块 / 整块    │  +  经历库浮窗（半屏）
 *   └─────────────┴──────────────────────┘
 *
 * 交互核心：点简历的任意段落 → AI 面板滑出携带上下文 → 说不满 → 候选 → 应用
 * ========================================================================== */

import { Toolbar } from "./components/Toolbar";
import { PreviewPanel } from "./components/preview/PreviewPanel";
import { OutlinePanel } from "./components/outline/OutlinePanel";
import { AiPanel } from "./components/ai/AiPanel";
import { ExperienceVault } from "./components/ai/ExperienceVault";

export default function App() {
  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-white to-sky-50/70">
      <Toolbar />
      <div className="app-main flex min-h-0 flex-1">
        <OutlinePanel />
        <PreviewPanel />
      </div>
      <AiPanel />
      <ExperienceVault />
    </div>
  );
}
