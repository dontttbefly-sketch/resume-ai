/* 匹配结果：分数环 + 硬条件识别 + 关键词命中与缺失 */

import { summarizeScore, type JdAnalysis, type JdKeyword } from "../../lib/jdMatch";
import { IconCheck, IconWarn } from "../icons";

interface Tone {
  ring: string;
  text: string;
  label: string;
}

function toneOf(score: number): Tone {
  if (score >= 80) return { ring: "text-emerald-500", text: "text-emerald-600", label: "匹配度很高" };
  if (score >= 60) return { ring: "text-brand", text: "text-brand", label: "基本匹配" };
  if (score >= 40) return { ring: "text-amber-500", text: "text-amber-600", label: "差距明显" };
  return { ring: "text-rose-500", text: "text-rose-600", label: "匹配度偏低" };
}

function ScoreRing({ score, tone }: { score: number; tone: Tone }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(score, 100) / 100);

  return (
    <div className="relative h-[84px] w-[84px] shrink-0">
      <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-slate-200"
        />
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-[stroke-dashoffset] duration-500 ${tone.ring}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`tnum text-[19px] font-semibold leading-none ${tone.text}`}>{score}</span>
        <span className="text-[10px] text-slate-400">匹配度</span>
      </div>
    </div>
  );
}

function KeywordChip({ keyword, hit }: { keyword: JdKeyword; hit: boolean }) {
  const tone = hit
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : keyword.weight === 3
      ? "border-rose-200 bg-rose-50 text-rose-600"
      : "border-slate-200 bg-white text-slate-500";

  const tip = hit
    ? `简历里写过：${keyword.evidence}`
    : `简历里没找到「${keyword.term}」的相关表述`;

  return (
    <span
      title={tip}
      className={`inline-flex cursor-default items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11.5px] leading-5 ${tone}`}
    >
      {keyword.term}
      {keyword.weight === 3 && <span className="text-[9px] opacity-60">核心</span>}
    </span>
  );
}

function RequirementRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[12px]">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="text-slate-700">{value}</span>
    </div>
  );
}

export function MatchResult({ analysis }: { analysis: JdAnalysis }) {
  const tone = toneOf(analysis.score);
  const { requirement: req } = analysis;

  if (analysis.keywords.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-700">
        <IconWarn className="mt-0.5 h-4 w-4 shrink-0" />
        <span>没在这段文本里识别到岗位关键词，确认一下是不是粘贴了完整的岗位描述。</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <ScoreRing score={analysis.score} tone={tone} />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={`text-[13.5px] font-medium ${tone.text}`}>{tone.label}</span>
            <span className="text-[12px] text-slate-500">
              {summarizeScore(analysis.score, analysis.keywords.length)}
            </span>
          </div>

          <div className="space-y-1">
            {req.roleTitle && <RequirementRow label="岗位" value={req.roleTitle} />}
            {req.years != null && (
              <RequirementRow label="经验" value={req.yearsRaw || `${req.years} 年`} />
            )}
            {req.degree && <RequirementRow label="学历" value={req.degree} />}
            <RequirementRow
              label="关键词"
              value={`共 ${analysis.keywords.length} 个，覆盖 ${analysis.hits.length} 个，缺 ${analysis.missing.length} 个`}
            />
          </div>
        </div>
      </div>

      {analysis.coreMissing.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <IconWarn className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          <div className="text-[12.5px] leading-relaxed text-rose-700">
            <span className="font-medium">
              有 {analysis.coreMissing.length} 个核心能力在简历里没有对应表述：
            </span>
            <span className="ml-1">
              {analysis.coreMissing.map((k) => k.term).join("、")}
            </span>
            <p className="mt-1 text-rose-600/80">
              如果你确实做过但没写进去，补上再投；如果真的没有，这条岗位大概率会在初筛被刷。
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <header className="mb-2 flex items-center gap-1.5">
            <IconCheck className="h-3.5 w-3.5 text-emerald-500" />
            <h3 className="text-[12.5px] font-medium text-slate-700">
              已覆盖 {analysis.hits.length}
            </h3>
          </header>
          <div className="flex flex-wrap gap-1.5">
            {analysis.hits.length === 0 ? (
              <span className="text-[12px] text-slate-400">一个都没覆盖到</span>
            ) : (
              analysis.hits.map((k) => <KeywordChip key={k.term} keyword={k} hit />)
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <header className="mb-2 flex items-center gap-1.5">
            <IconWarn className="h-3.5 w-3.5 text-slate-400" />
            <h3 className="text-[12.5px] font-medium text-slate-700">
              待补充 {analysis.missing.length}
            </h3>
          </header>
          <div className="flex flex-wrap gap-1.5">
            {analysis.missing.length === 0 ? (
              <span className="text-[12px] text-emerald-600">JD 提到的能力全都覆盖了</span>
            ) : (
              analysis.missing.map((k) => <KeywordChip key={k.term} keyword={k} hit={false} />)
            )}
          </div>
        </section>
      </div>

      <p className="px-1 text-[11.5px] leading-relaxed text-slate-400">
        匹配度是本地按关键词加权算出来的，只反映「字面覆盖」。
        招聘方真正看的是证据的强度，所以低分不一定没机会，高分也不代表稳过。
      </p>
    </div>
  );
}
