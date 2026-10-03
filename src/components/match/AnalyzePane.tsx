/* 分析 JD：左边粘岗位描述，右边出匹配分析与打招呼话术 */

import { useMemo } from "react";

import { flattenResume } from "../../lib/resumeText";
import { useJdStore } from "../../store/useJdStore";
import { useResumeStore } from "../../store/useResumeStore";
import { IconTarget, IconTrash } from "../icons";
import { Button } from "../kit/Button";
import { confirmDialog } from "../kit/Dialog";
import { EmptyState } from "../kit/misc";
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

export function AnalyzePane() {
  const jdText = useJdStore((s) => s.jdText);
  const setJdText = useJdStore((s) => s.setJdText);
  const analysis = useJdStore((s) => s.analysis);
  const analyze = useJdStore((s) => s.analyze);
  const clearJd = useJdStore((s) => s.clearJd);
  const sections = useResumeStore((s) => s.sections);
  const visibility = useResumeStore((s) => s.visibility);

  const meta = useMemo(() => {
    const flat = flattenResume(sections, visibility);
    return {
      modules: flat.blocks.length,
      entries: Object.values(sections).reduce((n, l) => n + l.length, 0),
      chars: flat.plain.replace(/\s/g, "").length,
    };
  }, [sections, visibility]);

  const canAnalyze = jdText.trim().length > 0 && meta.chars > 0;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
      <section className="glass p-5 lg:sticky lg:top-[92px]" style={{ ["--r" as string]: "var(--r-panel)" }}>
        <p className="text-[14px] font-semibold tracking-[-0.01em] text-fg">岗位描述</p>
        <p className="mt-1 text-[12px] text-fg-4">从招聘软件整段复制：职位名 + 职责 + 要求，越完整越准</p>
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="在这里粘贴岗位描述…"
          className="field thin-scroll mt-4 min-h-[340px] !text-[13px] !leading-[1.75]"
        />
        <div className="mt-3 flex items-center gap-2">
          <Button variant="primary" size="md" pill disabled={!canAnalyze} onClick={analyze} icon={<IconTarget className="h-4 w-4" />}>
            分析匹配度
          </Button>
          <Button size="md" pill onClick={() => setJdText(SAMPLE_JD)}>
            载入示例
          </Button>
          <Button
            variant="danger"
            size="md"
            pill
            className="ml-auto !px-3"
            disabled={!jdText && !analysis}
            aria-label="清空"
            onClick={async () => {
              if (await confirmDialog({ title: "清空岗位描述和分析结果？", confirmText: "清空", danger: true })) clearJd();
            }}
            icon={<IconTrash className="h-4 w-4" />}
          />
        </div>
        <div className="mt-5 pt-4 hair-t">
          <p className="text-[11.5px] font-medium text-fg-3">比对基准 · 当前简历</p>
          {meta.chars === 0 ? (
            <p className="mt-1 text-[12.5px] text-danger">当前简历是空的，先回「简历」填点内容。</p>
          ) : (
            <p className="tnum mt-1 text-[12.5px] text-fg-2">
              {meta.modules} 个模块 · {meta.entries} 条经历 · {meta.chars} 字
            </p>
          )}
          <p className="mt-1 text-[11.5px] text-fg-4">只比对简历上显示的模块，隐藏的不参与。</p>
        </div>
      </section>

      <div className="min-w-0 space-y-5">
        {analysis ? (
          <>
            <MatchResult analysis={analysis} />
            <PhraseCards />
          </>
        ) : (
          <EmptyState className="min-h-[520px]" icon={<IconTarget className="h-6 w-6" />} title="把岗位描述粘到左边，点「分析匹配度」">
            会告诉你这个岗位偏重什么能力、你覆盖了哪些、还缺什么，再按三个角度生成能直接发出去的打招呼话术。
          </EmptyState>
        )}
      </div>
    </div>
  );
}
