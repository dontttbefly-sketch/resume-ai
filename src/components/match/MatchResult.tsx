/* 匹配结果：分数环 + 硬条件识别 + 关键词命中与缺失（全部本地计算，不调模型） */

import { summarizeScore, type JdAnalysis, type JdKeyword } from "../../lib/jdMatch";
import { IconCheck, IconWarn } from "../icons";
import { NumberTicker, Ring } from "../kit/misc";
import { useSpotlight } from "../kit/useSpotlight";

function toneLabel(score: number): string {
  if (score >= 80) return "匹配度很高";
  if (score >= 60) return "基本匹配";
  if (score >= 40) return "差距明显";
  return "匹配度偏低";
}

export function KeywordChip({ keyword, hit }: { keyword: JdKeyword; hit: boolean }) {
  const tip = hit ? `简历里写过：${keyword.evidence}` : `简历里没找到「${keyword.term}」的相关表述`;
  const core = keyword.weight === 3;
  return (
    <span
      title={tip}
      className={`chip cursor-default ${hit ? "" : core ? "chip-outline !text-fg !shadow-[inset_0_0_0_1.5px_var(--fg-3)]" : "chip-dashed"}`}
    >
      {hit && <IconCheck className="h-3 w-3 text-fg-3" />}
      {keyword.term}
      {core && <span className="text-[9.5px] font-semibold opacity-50">核心</span>}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 text-[13px]">
      <span className="w-12 shrink-0 text-fg-4">{label}</span>
      <span className="text-fg-2">{value}</span>
    </div>
  );
}

export function MatchResult({ analysis }: { analysis: JdAnalysis }) {
  const spot = useSpotlight<HTMLDivElement>();
  const { requirement: req } = analysis;

  if (analysis.keywords.length === 0) {
    return (
      <div className="surface flex items-start gap-2.5 px-4 py-3.5 text-[13px] text-fg-2" style={{ ["--r" as string]: "16px" }}>
        <IconWarn className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        没在这段文本里识别到岗位关键词，确认一下是不是粘贴了完整的岗位描述。
      </div>
    );
  }

  return (
    <div className="stagger space-y-4">
      <div ref={spot} className="glass spot flex items-center gap-7 p-6" style={{ ["--r" as string]: "var(--r-panel)", ["--i" as string]: 0 }}>
        <Ring value={analysis.score / 100} size={128} stroke={6}>
          <span className="display-num text-[42px] text-fg">
            <NumberTicker value={analysis.score} />
          </span>
          <span className="mt-1 text-[11px] text-fg-4">匹配度</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="text-[22px] font-semibold tracking-[-0.025em] text-fg">{toneLabel(analysis.score)}</p>
          <p className="mt-1 text-[13px] text-fg-3">{summarizeScore(analysis.score, analysis.keywords.length)}</p>
          <div className="mt-4 space-y-1.5">
            {req.roleTitle && <Row label="岗位" value={req.roleTitle} />}
            {req.years != null && <Row label="经验" value={req.yearsRaw || `${req.years} 年`} />}
            {req.degree && <Row label="学历" value={req.degree} />}
            <Row
              label="关键词"
              value={`共 ${analysis.keywords.length} 个，覆盖 ${analysis.hits.length}，缺 ${analysis.missing.length}`}
            />
          </div>
        </div>
      </div>

      {analysis.coreMissing.length > 0 && (
        <div className="surface flex items-start gap-3 px-5 py-4" style={{ ["--r" as string]: "var(--r-card)", ["--i" as string]: 1 }}>
          <IconWarn className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div className="text-[13px] leading-relaxed text-fg-2">
            <p>
              <span className="font-semibold text-fg">{analysis.coreMissing.length} 个核心能力</span>在简历里没有对应表述：
              {analysis.coreMissing.map((k) => k.term).join("、")}
            </p>
            <p className="mt-1 text-fg-4">确实做过但没写进去，补上再投；真的没有，这条岗位大概率在初筛被刷。</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2" style={{ ["--i" as string]: 2 }}>
        <section className="surface p-5" style={{ ["--r" as string]: "var(--r-card)" }}>
          <p className="mb-3 text-[12.5px] font-semibold text-fg">
            已覆盖 <span className="tnum font-normal text-fg-4">{analysis.hits.length}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.hits.length === 0 ? (
              <span className="text-[12.5px] text-fg-4">一个都没覆盖到</span>
            ) : (
              analysis.hits.map((k) => <KeywordChip key={k.term} keyword={k} hit />)
            )}
          </div>
        </section>
        <section className="surface p-5" style={{ ["--r" as string]: "var(--r-card)" }}>
          <p className="mb-3 text-[12.5px] font-semibold text-fg">
            待补充 <span className="tnum font-normal text-fg-4">{analysis.missing.length}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.missing.length === 0 ? (
              <span className="text-[12.5px] text-fg-3">JD 提到的能力全都覆盖了</span>
            ) : (
              analysis.missing.map((k) => <KeywordChip key={k.term} keyword={k} hit={false} />)
            )}
          </div>
        </section>
      </div>

      <p className="px-1 text-[12px] leading-relaxed text-fg-4">
        匹配度是本地按关键词加权算的，只反映「字面覆盖」。招聘方真正看的是证据强度，低分不一定没机会，高分也不代表稳过。
      </p>
    </div>
  );
}
