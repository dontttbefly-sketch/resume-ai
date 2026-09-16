/* ============================================================================
 * 左侧：简历模块目录
 *
 * 设计逻辑（见讨论定稿）：
 *   - 灰字（公司/职位/城市/时间）= 元信息 → 永远平铺、点一下就地编辑
 *   - bullets = 内容 → 默认折叠成摘要，点「展开编辑」才进入手动编辑
 *   - 主路径在中间预览区（点选 + AI 改），这里是总览与兜底编辑
 * ========================================================================== */

import { useState } from "react";
import { SECTIONS } from "../../data/sections";
import { useResumeStore } from "../../store/useResumeStore";
import { useSelectionStore } from "../../store/useSelectionStore";
import { asString, readList } from "../../lib/resume";

/** 就地编辑的一行文本：默认显示，点击变输入框 */
function InlineEdit({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onChange(draft.trim());
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={
          "w-full rounded-lg border border-sky-300 bg-white px-2 py-1 text-[13px] text-slate-800 outline-none ring-2 ring-sky-100 " +
          (className ?? "")
        }
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={
        "w-full truncate rounded-lg px-2 py-1 text-left text-[13px] transition-colors duration-100 hover:bg-slate-100 " +
        (className ?? "")
      }
      title="点击编辑"
    >
      {value || <span className="text-slate-300">{placeholder ?? "（空）"}</span>}
    </button>
  );
}

/** 一张条目卡：公司名 + 灰字平铺 + 要点折叠 */
function EntryCard({
  sectionKey,
  sectionLabel,
  entryId,
}: {
  sectionKey: string;
  sectionLabel: string;
  entryId: string;
}) {
  const entry = useResumeStore((s) => s.sections[sectionKey]?.find((e) => e.id === entryId));
  const setField = useResumeStore((s) => s.setField);
  const setBullet = useResumeStore((s) => s.setBullet);
  const toggle = useSelectionStore((s) => s.toggle);
  const [expanded, setExpanded] = useState(false);

  if (!entry) return null;

  const bulletList = readList(entry, "bullets");

  /* 不同模块的主字段不同：work→company / projects→name / education→school */
  const primaryField =
    sectionKey === "education" ? "school" : sectionKey === "projects" ? "name" : "company";
  const primaryVal = asString(entry.values[primaryField]);
  const hasMeta = Boolean(primaryVal);  /* strengths 这类模块没有公司字段 */
  const titleField = "title";
  const cityField = "city";

  const title = hasMeta ? primaryVal : `${sectionLabel} · ${bulletList.length} 条要点`;
  const role = asString(entry.values[titleField]);
  const city = asString(entry.values[cityField]);
  const start = asString(entry.values.start);
  const end = asString(entry.values.end);

  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 hover:border-slate-300/80 hover:shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
      {/* 公司/学校名：inline 编辑 */}
      <InlineEdit
        value={title}
        onChange={(v) => setField(sectionKey as never, entryId, primaryField, v)}
        className="font-medium text-slate-800"
        placeholder="名称"
      />
      {/* 灰字平铺行：职位 · 城市 · 时间，各自就地编辑（无公司字段的模块不显示） */}
      <div className={(hasMeta ? "" : "hidden ") + "mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-slate-400"}>
        <span className="inline-flex min-w-0 flex-1 basis-24">
          <InlineEdit
            value={role}
            onChange={(v) => setField(sectionKey as never, entryId, titleField, v)}
            className="!py-0.5 text-[11.5px] text-slate-500"
            placeholder="职位"
          />
        </span>
        <span className="inline-flex basis-14">
          <InlineEdit
            value={city}
            onChange={(v) => setField(sectionKey as never, entryId, cityField, v)}
            className="!py-0.5 text-[11.5px] text-slate-400"
            placeholder="城市"
          />
        </span>
        <span className="text-slate-300">·</span>
        <span className="tnum inline-flex basis-28">
          <InlineEdit
            value={start}
            onChange={(v) => setField(sectionKey as never, entryId, "start", v)}
            className="!py-0.5 text-[11.5px] text-slate-400"
            placeholder="开始"
          />
        </span>
        <span className="text-slate-300">—</span>
        <span className="tnum inline-flex basis-20">
          <InlineEdit
            value={end}
            onChange={(v) => setField(sectionKey as never, entryId, "end", v)}
            className="!py-0.5 text-[11.5px] text-slate-400"
            placeholder="结束"
          />
        </span>
      </div>

      {/* 要点：折叠摘要 / 展开编辑 */}
      <div className="mt-2 border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
        >
          <span className={"transition-transform duration-200 " + (expanded ? "rotate-90" : "")}>▸</span>
          {bulletList.length} 条要点
          <span className="ml-auto text-[10.5px] text-slate-300 group-hover:text-slate-400">
            {expanded ? "收起" : "手动编辑"}
          </span>
        </button>
        {expanded && (
          <ul className="mt-1 space-y-1.5 animate-[vault-fade-in_200ms_ease-out]">
            {bulletList.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                <textarea
                  value={b}
                  rows={2}
                  onChange={(e) => setBullet(sectionKey as never, entryId, "bullets", i, e.target.value)}
                  className="w-full resize-none rounded-lg border border-transparent bg-slate-50 px-2 py-1 text-[12px] leading-relaxed text-slate-600 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 点「在简历中改进」→ 选中该条目并呼出 AI 面板 */}
      <button
        type="button"
        onClick={() =>
          toggle({ level: "entry", sectionKey, sectionLabel, entryId, entryLabel: title, key: `${sectionKey}:${entryId}` })
        }
        className="mt-2 hidden w-full items-center justify-center gap-1 rounded-xl border border-sky-200 bg-sky-50/60 py-1.5 text-[11.5px] font-medium text-sky-600 transition-all duration-150 hover:bg-sky-100 group-hover:flex"
      >
        ✦ 在简历中改进
      </button>
    </div>
  );
}

export function OutlinePanel() {
  const sections = useResumeStore((s) => s.sections);
  const visibility = useResumeStore((s) => s.visibility);
  const toggle = useSelectionStore((s) => s.toggle);

  const visibleSections = SECTIONS.filter(
    (d) => d.key !== "basics" && (visibility[d.key] ?? d.defaultVisible) && (sections[d.key]?.length ?? 0) > 0,
  );

  return (
    <aside className="no-print flex w-[248px] shrink-0 flex-col border-r border-slate-200/70 bg-gradient-to-b from-slate-50/90 to-white/60 backdrop-blur-xl">
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 px-4 pb-2 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">简历结构</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            点击中间简历的任意段落，让 AI 改进它
          </p>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-6">
          {visibleSections.map((desc) => (
            <div key={desc.key} className="mb-4">
              <button
                type="button"
                onClick={() =>
                  toggle({ level: "section", sectionKey: desc.key, sectionLabel: desc.label, key: `sec:${desc.key}` })
                }
                className="mb-2 flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-slate-200/60"
                title="选中整个模块"
              >
                <span className="text-[12.5px] font-semibold text-slate-600">{desc.label}</span>
                <span className="text-[10px] text-slate-300">整块 ✦</span>
              </button>
              <div className="space-y-2">
                {(sections[desc.key] ?? []).map((entry) => (
                  <EntryCard
                    key={entry.id}
                    sectionKey={desc.key}
                    sectionLabel={desc.label}
                    entryId={entry.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
