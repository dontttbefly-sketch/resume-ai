/* ============================================================================
 * 站长专属简历（线上）
 *
 * 线上版不打包任何人的私人简历。站长账号（role = owner）登录后，门禁才会放行
 * /owner/resume.json（scripts/build-owner-data.mjs 构建时生成）；其他人请求是 404。
 *
 * 拿到之后：
 *   - 「载入一页版 / 完整版 / AI 开发版」都改用站长自己的数据
 *   - 当前档案还停在示例简历（第一次打开）→ 直接换成站长的；改过的内容不动
 * 本机开发不走这里：本机直接读 src/data/private/。
 * ========================================================================== */

import { create } from "zustand";

import { setOwnerResumes, type OwnerResumes } from "../data/privateResume";
import { buildSampleResume } from "../data/sampleResume";
import { useResumeStore } from "../store/useResumeStore";
import { asString } from "./resume";

export const useOwnerData = create<{ ready: boolean; runnerCommand: string }>(() => ({ ready: false, runnerCommand: "" }));

function nameOf(sections: ReturnType<typeof buildSampleResume>["sections"]): string {
  return asString(sections.basics?.[0]?.values.name).trim();
}

export async function loadOwnerData(): Promise<void> {
  if (!import.meta.env.PROD) return;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}owner/resume.json`, { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return;
    const data = (await res.json()) as OwnerResumes & { runnerCommand?: string };
    if (!data?.mine) return;
    setOwnerResumes(data);
    // 站长用自己技能目录里的投递数据启动执行器（不是朋友那套一键安装）
    useOwnerData.setState({ ready: true, runnerCommand: data.runnerCommand ?? "" });

    const sampleName = nameOf(buildSampleResume().sections);
    if (nameOf(useResumeStore.getState().sections) === sampleName) useResumeStore.getState().loadMine();
  } catch {
    /* 不是站长、或者离线：照常用示例 / 本地数据 */
  }
}
