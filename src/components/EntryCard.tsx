/* 单条条目卡片：折叠头 + 字段网格 + 上移/下移/删除 */

import { useState } from "react";

import type { EntryData } from "../data/schema";
import { SECTION_MAP, type SectionKey } from "../data/sections";
import { asString, isEntryEmpty } from "../lib/resume";
import { useResumeStore } from "../store/useResumeStore";
import { FieldInput } from "./FieldInput";
import { IconArrowDown, IconArrowUp, IconChevron, IconTrash } from "./icons";
import { IconButton } from "./ui";

export function EntryCard({
  section,
  entry,
  index,
  total,
}: {
  section: SectionKey;
  entry: EntryData;
  index: number;
  total: number;
}) {
  const desc = SECTION_MAP[section];
  const setField = useResumeStore((s) => s.setField);
  const removeEntry = useResumeStore((s) => s.removeEntry);
  const moveEntry = useResumeStore((s) => s.moveEntry);

  const [open, setOpen] = useState(true);

  const primaryField = desc.entry.fields.find((f) => f.role === "primary");
  const rawTitle = primaryField ? asString(entry.values[primaryField.key]).trim() : "";
  const title = rawTitle || `${desc.label} ${index + 1}`;
  const empty = isEntryEmpty(desc, entry);

  const canSort = desc.entry.sortable && total > 1;
  const canRemove = desc.entry.removable;

  const fields = (
    <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5">
      {desc.entry.fields.map((field) => (
        <FieldInput
          key={field.key}
          section={section}
          entryId={entry.id}
          field={field}
          value={entry.values[field.key]}
          onChange={(v) => setField(section, entry.id, field.key, v)}
        />
      ))}
    </div>
  );

  // 基本信息只有一条且不可增删，不需要折叠头
  if (!desc.entry.addable) {
    return <div className="rounded-lg border border-slate-200 bg-white p-2.5">{fields}</div>;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-slate-300">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left"
        >
          <IconChevron
            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
          <span
            className={`truncate text-[12.5px] font-medium ${
              empty ? "text-slate-400" : "text-slate-700"
            }`}
          >
            {title}
          </span>
        </button>

        <div className="flex shrink-0 items-center">
          {canSort && (
            <>
              <IconButton
                title="上移"
                disabled={index === 0}
                onClick={() => moveEntry(section, entry.id, -1)}
              >
                <IconArrowUp className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                title="下移"
                disabled={index === total - 1}
                onClick={() => moveEntry(section, entry.id, 1)}
              >
                <IconArrowDown className="h-3.5 w-3.5" />
              </IconButton>
            </>
          )}
          {canRemove && (
            <IconButton
              title="删除这条"
              onClick={() => {
                if (window.confirm(`确定删除「${title}」吗？此操作不可撤销。`)) {
                  removeEntry(section, entry.id);
                }
              }}
            >
              <IconTrash className="h-3.5 w-3.5" />
            </IconButton>
          )}
        </div>
      </div>

      {open && <div className="border-t border-slate-100 p-2.5">{fields}</div>}
    </div>
  );
}
