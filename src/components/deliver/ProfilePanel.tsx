/* ============================================================================
 * 设置：关键词计划 + 判岗画像（AI 判断「投 / 不投」的全部依据）
 * 存在执行器那台电脑的 user_profile.json 里 —— 终端里跑技能用的也是这一份
 * ========================================================================== */

import { useEffect, useMemo, useState } from "react";

import type { BossProfile } from "../../lib/bossApi";
import { useBossStore } from "../../store/useBossStore";
import { IconArrowDown, IconArrowUp, IconPlus, IconX } from "../icons";
import { Button, IconButton } from "../kit/Button";
import { AutoTextarea, ChipsInput, FieldLabel } from "../kit/Field";
import { toast } from "../kit/Toast";

interface Draft {
  role_summary: string;
  keyword_plan: string[];
  target_cities: string[];
  city_code: string;
  min_salary_k: number;
  max_salary_k: number;
  prefer: string[];
  avoid: string[];
  judge_rules: string[];
}

function toDraft(p: BossProfile | undefined): Draft {
  const cities = p?.target_cities?.length ? p.target_cities : p?.target_city ? [p.target_city] : [];
  return {
    role_summary: p?.role_summary ?? "",
    keyword_plan: p?.keyword_plan?.length ? p.keyword_plan : ["推荐页"],
    target_cities: cities,
    city_code: p?.city_code ?? "",
    min_salary_k: Number(p?.min_salary_k ?? 0),
    max_salary_k: Number(p?.max_salary_k ?? 0),
    prefer: p?.prefer ?? [],
    avoid: p?.avoid ?? [],
    judge_rules: p?.judge_rules ?? [],
  };
}

/** 关键词计划：一行一个来源，可上下调整；「推荐页」是平台的个性化推荐 */
function PlanEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft("");
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div>
      <ol className="space-y-1.5">
        {value.map((kw, i) => (
          <li key={kw} className="surface group/kw flex items-center gap-2 py-1.5 pl-3 pr-1.5" style={{ ["--r" as string]: "12px" }}>
            <span className="tnum w-4 text-[11px] text-fg-4">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
              {kw}
              {kw === "推荐页" && <span className="ml-1.5 text-[11px] text-fg-4">平台按你的画像推荐</span>}
            </span>
            <span className="flex opacity-0 transition-opacity group-hover/kw:opacity-100 group-focus-within/kw:opacity-100">
              <IconButton label="上移" size="xs" noTip disabled={i === 0} onClick={() => move(i, -1)}>
                <IconArrowUp className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="下移" size="xs" noTip disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                <IconArrowDown className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="移除" size="xs" noTip disabled={value.length <= 1} onClick={() => onChange(value.filter((x) => x !== kw))}>
                <IconX className="h-3.5 w-3.5" />
              </IconButton>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="加一个关键词，回车"
          className="field !py-2 !text-[12.5px]"
        />
        {!value.includes("推荐页") && (
          <Button size="sm" pill onClick={() => onChange(["推荐页", ...value])}>
            + 推荐页
          </Button>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-fg-4">推荐页要先翻到底才能搜关键词（技能的规则），执行器会自动处理。</p>
    </div>
  );
}

export function ProfilePanel() {
  const profile = useBossStore((s) => s.snap?.profile);
  const save = useBossStore((s) => s.saveProfile);
  const source = useMemo(() => toDraft(profile), [profile]);
  const [draft, setDraft] = useState<Draft>(source);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(source);

  // 外部（比如终端里的智能体）改了画像、而这边没有未保存的修改 → 跟上
  useEffect(() => {
    if (!dirty) setDraft(source);
  }, [source]);

  const patch = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <section className="glass relative p-5" style={{ ["--r" as string]: "var(--r-panel)" }}>
      <p className="text-[14px] font-semibold tracking-[-0.01em] text-fg">设置</p>
      <p className="mt-1 text-[12px] leading-relaxed text-fg-4">执行器按这里的设置去翻、去判。改完点保存，下一张卡起生效。</p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <FieldLabel>求职方向</FieldLabel>
          <AutoTextarea
            variant="field"
            value={draft.role_summary}
            onChange={(v) => patch("role_summary", v)}
            placeholder="一句话说清楚想找什么工作"
            minRows={2}
          />
        </label>

        <div>
          <FieldLabel hint="按顺序翻，翻完一个自动换下一个">关键词计划</FieldLabel>
          <PlanEditor value={draft.keyword_plan} onChange={(v) => patch("keyword_plan", v)} />
        </div>

        <div>
          <FieldLabel hint="第一个是主城市">城市</FieldLabel>
          <ChipsInput values={draft.target_cities} onChange={(v) => patch("target_cities", v)} placeholder="深圳，回车添加" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <FieldLabel>薪资下限</FieldLabel>
            <div className="relative">
              <input
                value={draft.min_salary_k || ""}
                onChange={(e) => patch("min_salary_k", Number(e.target.value.replace(/\D/g, "")))}
                className="field tnum pr-8"
                placeholder="0"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-fg-4">K</span>
            </div>
          </label>
          <label className="block">
            <FieldLabel>薪资上限</FieldLabel>
            <div className="relative">
              <input
                value={draft.max_salary_k || ""}
                onChange={(e) => patch("max_salary_k", Number(e.target.value.replace(/\D/g, "")))}
                className="field tnum pr-8"
                placeholder="不限"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-fg-4">K</span>
            </div>
          </label>
          <label className="block">
            <FieldLabel>城市代码</FieldLabel>
            <input value={draft.city_code} onChange={(e) => patch("city_code", e.target.value.trim())} className="field tnum" placeholder="101280600" />
          </label>
        </div>

        <div>
          <FieldLabel>希望投</FieldLabel>
          <ChipsInput values={draft.prefer} onChange={(v) => patch("prefer", v)} placeholder="AI 产品经理，回车添加" />
        </div>

        <div>
          <FieldLabel>不投</FieldLabel>
          <ChipsInput values={draft.avoid} onChange={(v) => patch("avoid", v)} placeholder="纯销售，回车添加" tone="outline" />
        </div>

        <div>
          <FieldLabel hint={`${draft.judge_rules.length} 条 · 逐条执行`}>判岗规则</FieldLabel>
          <ol className="space-y-1.5">
            {draft.judge_rules.map((r, i) => (
              <li key={i} className="group/rule relative flex items-start gap-2">
                <span className="tnum mt-[9px] w-4 shrink-0 text-right text-[11px] font-medium text-fg-4">{i + 1}</span>
                <AutoTextarea
                  value={r}
                  onChange={(v) => patch("judge_rules", draft.judge_rules.map((x, j) => (j === i ? v : x)))}
                  className="!pr-8 text-[12.5px] leading-[1.6] text-fg-2"
                />
                <button
                  type="button"
                  aria-label="删除这条规则"
                  onClick={() => patch("judge_rules", draft.judge_rules.filter((_, j) => j !== i))}
                  className="press absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-fg-4 opacity-0 transition-opacity hover:bg-fill-2 hover:text-danger group-hover/rule:opacity-100"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => patch("judge_rules", [...draft.judge_rules, ""])}
            className="press mt-1 ml-5 flex h-7 items-center gap-1.5 rounded-[9px] px-2 text-[12px] text-fg-4 hover:bg-fill hover:text-fg-2"
          >
            <IconPlus className="h-3.5 w-3.5" />
            添加规则
          </button>
        </div>
      </div>

      {/* 有改动才浮出的保存条 */}
      <div className="disclose" data-open={dirty}>
        <div>
          <div className="mt-5 flex items-center gap-2 pt-4 hair-t">
            <span className="text-[12px] text-fg-3">有未保存的修改</span>
            <Button size="sm" variant="ghost" pill className="ml-auto" onClick={() => setDraft(source)}>
              还原
            </Button>
            <Button
              size="sm"
              variant="primary"
              pill
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                const ok = await save({ ...draft, judge_rules: draft.judge_rules.map((r) => r.trim()).filter(Boolean) });
                setSaving(false);
                if (ok) toast("画像已保存", "success");
              }}
            >
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
