/* ============================================================================
 * 私有简历数据的加载器
 *
 * 真实简历数据（myResume.ts / myResumeFull.ts）放在 src/data/private/ 下，
 * 该目录已加入 .gitignore —— 开源仓库里没有你的任何个人信息。
 *
 * 加载用 import.meta.glob：
 *   - 本机有 private 文件 → 构建时打包进去，一切照常
 *   - 别人 clone 后没有这些文件 → glob 匹配为空，回退到内置示例数据，
 *     构建照样通过（这就是不用静态 import 的原因）
 *
 * 想放自己的真实数据？把 myResume.ts / myResumeFull.ts 仿照
 * sampleResume.ts 的结构写进 src/data/private/ 即可，字段见 src/data/sections.ts。
 * ========================================================================== */

import type { Resume } from "./schema";
import { buildEmptyResume, buildSampleResume } from "./sampleResume";

const modules = import.meta.glob<{ buildMyResume?: () => Resume; buildFullResume?: () => Resume }>(
  "./private/myResume*.ts",
  { eager: true },
);

function pick(key: "buildMyResume" | "buildFullResume"): Resume {
  for (const mod of Object.values(modules)) {
    const fn = mod[key];
    if (typeof fn === "function") return fn();
  }
  // 没有私有数据：示例数据顶上（clone 仓库后的开箱体验）
  return key === "buildMyResume" ? buildSampleResume() : buildEmptyResume();
}

/** 一页版简历（默认载入） */
export function buildMyResume(): Resume {
  return pick("buildMyResume");
}

/** 完整版简历（工具栏「载入完整版」） */
export function buildFullResume(): Resume {
  return pick("buildFullResume");
}

/** 本机是否放了私有数据（用来决定「载入一页版/完整版」按钮的行为提示） */
export function hasPrivateResume(): boolean {
  return Object.keys(modules).length > 0;
}
