/* 简历工作台：画布（纸张）在底，内容面板 / AI 面板 / 底部浮条浮在上面 */

import { AiPanel } from "./AiPanel";
import { Canvas } from "./Canvas";
import { Inspector } from "./inspector/Inspector";
import { PaperDock } from "./PaperDock";

export function StudioView() {
  return (
    <>
      <Canvas />
      <Inspector />
      <PaperDock />
      <AiPanel />
    </>
  );
}
