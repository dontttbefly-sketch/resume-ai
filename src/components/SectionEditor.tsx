/* ============================================================================
 * 通用模块编辑器
 *
 * 完全由描述符驱动：它只读 SECTION_MAP 里的配置，不写死任何业务字段。
 * 新增模块时这个文件不需要改。
 * ========================================================================== */

import type { EntryData } from "../data/schema";
import { SECTION_MAP, type SectionKey } from "../data/sections";
import { useResumeStore } from "../store/useResumeStore";
import { EntryCard } from "./EntryCard";
import { IconPlus } from "./icons";

const NO_ENTRIES: EntryData[] = [];

export function SectionEditor({ section }: { section: SectionKey }) {
  const desc = SECTION_MAP[section];
  const entries = useResumeStore((s) => s.sections[section]) ?? NO_ENTRIES;
  const addEntry = useResumeStore((s) => s.addEntry);

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <EntryCard
          key={entry.id}
          section={section}
          entry={entry}
          index={i}
          total={entries.length}
        />
      ))}

      {entries.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[12px] text-slate-400">
          还没有内容，点下面的按钮添加。
        </p>
      )}

      {desc.entry.addable && (
        <button
          type="button"
          onClick={() => addEntry(section)}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-[12px] text-slate-500 transition hover:border-brand hover:bg-blue-50/60 hover:text-brand"
        >
          <IconPlus className="h-3.5 w-3.5" />
          添加{desc.entry.itemNoun}
        </button>
      )}
    </div>
  );
}
