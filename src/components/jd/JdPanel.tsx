/* ============================================================================
 * 岗位匹配面板
 *
 * 左边粘岗位描述，右边出匹配分析与打招呼话术。
 * 简历数据直接读主 store，不用重复录一遍。
 * ========================================================================== */

import { useMemo } from "react";

import { flattenResume } from "../../lib/resumeText";
import { useJdStore } from "../../store/useJdStore";
import { useResumeStore } from "../../store/useResumeStore";
import { IconTarget, IconTrash } from "../icons";
import { Btn } from "../ui";
import { MatchResult } from "./MatchResult";
import { PhraseCards } from "./PhraseCards";

const SAMPLE_JD = `AI 产品经理

岗位职责：
1. 负责公司 AI 客服方向的产品规划与设计，输出 PRD 并推动落地；
2. 结合大模型能力设计对话流程，持续优化意图识别准确率与应答质量；
3. 搭建并维护客服知识库，通过 badcase 分析驱动 prompt 与知识迭代；
4. 与算法、研发、运营跨部门协作，跟进需求评审、排期与上线；
5. 建立服务质量指标体系，用数据分析定位问题并推动改进。

任职要求：
1. 本科及以上学历，3 年以上产品相关经验；
2. 有 AI 产品或智能客服项目经验，熟悉 RAG、Agent 等大模型应用形态；
3. 具备较强的数据分析能力，能独立完成埋点设计与效果评估；
4. 熟悉 Coze / Dify 等平台，有 Prompt 工程实践经验；
5. 沟通表达清晰，有较强的项目推进能力。`;

export function JdPanel() {
  const jdText = useJdStore((s) => s.jdText);
  const setJdText = useJdStore((s) => s.setJdText);
  const analysis = useJdStore((s) => s.analysis);
  const analyze = useJdStore((s) => s.analyze);
  const clearJd = useJdStore((s) => s.clearJd);

  const sections = useResumeStore((s) => s.sections);
  const visibility = useResumeStore((s) => s.visibility);

  const flat = useMemo(() => flattenResume(sections, visibility), [sections, visibility]);

  const resumeMeta = useMemo(() => {
    const entryCount = Object.values(sections).reduce((sum, list) => sum + list.length, 0);
    return {
      modules: flat.blocks.length,
      entries: entryCount,
      chars: flat.plain.replace(/\s/g, "").length,
    };
  }, [flat, sections]);

  const canAnalyze = jdText.trim().length > 0 && resumeMeta.chars > 0;

  return (
    <div className="flex min-h-0 flex-1">
      {/* ------------------------------ 左：输入 ------------------------------ */}
      <aside className="thin-scroll flex w-[440px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-slate-50">
        <div className="space-y-3 p-4">
          <header className="flex items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <IconTarget className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="text-[13.5px] font-medium text-slate-800">岗位匹配</h2>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-400">
                把招聘软件上的岗位描述整段复制过来，越完整越准。
              </p>
            </div>
          </header>

          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="在这里粘贴岗位描述（职位名、岗位职责、任职要求）…"
            className="thin-scroll min-h-[260px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12.5px] leading-relaxed text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
          />

          <div className="flex items-center gap-2">
            <Btn variant="primary" disabled={!canAnalyze} onClick={analyze}>
              <IconTarget className="h-3.5 w-3.5" />
              分析匹配度
            </Btn>

            <Btn
              variant="outline"
              onClick={() => setJdText(SAMPLE_JD)}
              title="填入一段示例岗位描述，先看看效果"
            >
              载入示例
            </Btn>

            <Btn
              variant="danger"
              className="ml-auto"
              disabled={!jdText && !analysis}
              onClick={() => {
                if (window.confirm("确定清空岗位描述和分析结果吗？")) clearJd();
              }}
            >
              <IconTrash className="h-3.5 w-3.5" />
              清空
            </Btn>
          </div>

          {/* 比对基准：让用户清楚拿什么在比 */}
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[11.5px] text-slate-400">比对基准</p>
            {resumeMeta.chars === 0 ? (
              <p className="mt-1 text-[12px] text-amber-600">
                当前简历是空的，先回到「简历编辑」填点内容。
              </p>
            ) : (
              <p className="tnum mt-1 text-[12px] text-slate-600">
                {resumeMeta.modules} 个模块 · {resumeMeta.entries} 条经历 ·{" "}
                {resumeMeta.chars} 字
              </p>
            )}
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              只比对当前显示的模块，隐藏的模块不参与。
            </p>
          </div>
        </div>
      </aside>

      {/* ------------------------------ 右：结果 ------------------------------ */}
      <section className="thin-scroll min-h-0 flex-1 overflow-auto bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-[860px] space-y-5">
          {analysis ? (
            <>
              <MatchResult analysis={analysis} />
              <PhraseCards />
            </>
          ) : (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-300">
                <IconTarget className="h-6 w-6" />
              </span>
              <p className="text-[13px] text-slate-500">
                把岗位描述粘到左边，点「分析匹配度」
              </p>
              <p className="max-w-[420px] text-[12px] leading-relaxed text-slate-400">
                会告诉你这个岗位偏重什么能力、你已经覆盖了哪些、还缺什么，
                然后按三个不同角度生成可以直接发出去的打招呼话术。
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
