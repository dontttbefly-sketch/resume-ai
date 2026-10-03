/* 一个模块：标题行（显示开关 / 添加）+ 条目卡片列表 */

import { useState } from "react";

import type { EntryData, SectionDescriptor } from "../../../data/schema";
import type { SectionKey } from "../../../data/sections";
import { useResumeStore } from "../../../store/useResumeStore";
import { IconEye, IconEyeOff, IconPlus } from "../../icons";
import { IconButton } from "../../kit/Button";
import { linkOnPaper, sectionSelector } from "../paperLink";
import { EntryCard } from "./EntryCard";

const NO_ENTRIES: EntryData[] = [];

export function SectionHeader({
  desc,
  count,
  onAdd,
}: {
  desc: SectionDescriptor;
  count?: number;
  onAdd?: () => void;
}) {
  const visible = useResumeStore((s) => s.visibility[desc.key] ?? desc.defaultVisible);
  const toggleSection = useResumeStore((s) => s.toggleSection);
  const sel = sectionSelector(desc.key);

  return (
    <header
      className="flex h-8 items-center gap-2 px-1.5"
      onMouseEnter={() => linkOnPaper(sel, true)}
      onMouseLeave={() => linkOnPaper(sel, false)}
    >
      <h3 className={`text-[12.5px] font-semibold tracking-[-0.005em] transition-colors ${visible ? "text-fg" : "text-fg-4"}`}>
        {desc.label}
      </h3>
      {count != null && count > 0 && <span className="tnum text-[11px] text-fg-4">{count}</span>}
      {!visible && <span className="chip chip-sm chip-outline anim-fade">简历上已隐藏</span>}
      <div className="ml-auto flex items-center">
        <IconButton
          size="xs"
          label={visible ? "在简历上隐藏" : "在简历上显示"}
          onClick={() => toggleSection(desc.key as SectionKey)}
        >
          {visible ? <IconEye className="h-[15px] w-[15px]" /> : <IconEyeOff className="h-[15px] w-[15px]" />}
        </IconButton>
        {onAdd && (
          <IconButton size="xs" label={`添加${desc.entry.itemNoun}`} onClick={onAdd}>
            <IconPlus className="h-[15px] w-[15px]" />
          </IconButton>
        )}
      </div>
    </header>
  );
}

export function SectionBlock({ desc }: { desc: SectionDescriptor }) {
  const entries = useResumeStore((s) => s.sections[desc.key] ?? NO_ENTRIES);
  const visible = useResumeStore((s) => s.visibility[desc.key] ?? desc.defaultVisible);
  const addEntry = useResumeStore((s) => s.addEntry);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const add = () => {
    addEntry(desc.key as SectionKey);
    const list = useResumeStore.getState().sections[desc.key] ?? [];
    const last = list[list.length - 1];
    if (last) setOpen((prev) => new Set(prev).add(last.id));
  };

  return (
    <section data-insp-section={desc.key}>
      <SectionHeader desc={desc} count={entries.length} onAdd={desc.entry.addable ? add : undefined} />
      <div className={`mt-1.5 space-y-2 transition-opacity duration-300 ${visible ? "" : "opacity-55"}`}>
        {entries.map((e, i) => (
          <EntryCard
            key={e.id}
            desc={desc}
            entry={e}
            index={i}
            count={entries.length}
            expanded={open.has(e.id)}
            onToggle={() => toggle(e.id)}
          />
        ))}
        {entries.length === 0 && desc.entry.addable && (
          <button
            type="button"
            onClick={add}
            className="press flex h-11 w-full items-center justify-center gap-1.5 rounded-[var(--r-card)] text-[12.5px] text-fg-4 outline-1 -outline-offset-1 outline-dashed outline-[var(--hairline-2)] hover:bg-fill hover:text-fg-2"
          >
            <IconPlus className="h-4 w-4" />
            添加{desc.entry.itemNoun}
          </button>
        )}
      </div>
    </section>
  );
}
