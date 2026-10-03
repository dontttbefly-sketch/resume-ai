/* ============================================================================
 * 判岗画像：AI 判断「投 / 不投」的全部依据
 * 直接读写技能目录下的 user_profile.json —— 终端里跑技能用的也是这一份
 * ========================================================================== */

import { useEffect, useMemo, useState } from "react";

import type { BossProfile } from "../../lib/bossApi";
import { useBossStore } from "../../store/useBossStore";
import { IconPlus, IconX } from "../icons";
import { Button } from "../kit/Button";
import { AutoTextarea, ChipsInput, FieldLabel } from "../kit/Field";
import { toast } from "../kit/Toast";

interface Draft {
  role_summary: string;
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
    target_cities: cities,
    city_code: p?.city_code ?? "",
    min_salary_k: Number(p?.min_salary_k ?? 0),
    max_salary_k: Number(p?.max_salary_k ?? 0),
    prefer: p?.prefer ?? [],
    avoid: p?.avoid ?? [],
    judge_rules: p?.judge_rules ?? [],
  };
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
      <p className="text-[14px] font-semibold tracking-[-0.01em] text-fg">判岗画像</p>
      <p className="mt-1 text-[12px] leading-relaxed text-fg-4">AI 判断投不投的全部依据，和终端里跑技能共用同一份配置。</p>

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
