/* ============================================================================
 * 字段控件（描述符驱动）
 *
 * 按 FieldDescriptor.control 决定渲染哪种输入，不认识任何业务字段名 ——
 * 在 data/sections.ts 里加模块 / 加字段，这里一行不用改。
 * ========================================================================== */

import type { EntryData, FieldDescriptor } from "../../../data/schema";
import type { SectionKey } from "../../../data/sections";
import { asString, readList } from "../../../lib/resume";
import { useResumeStore } from "../../../store/useResumeStore";
import { AutoTextarea, GhostInput } from "../../kit/Field";
import { BulletsEditor } from "./BulletsEditor";
import { ImageSlot } from "./ImageSlot";

export function FieldControl({
  section,
  entry,
  field,
  className = "",
}: {
  section: string;
  entry: EntryData;
  field: FieldDescriptor;
  className?: string;
}) {
  const setField = useResumeStore((s) => s.setField);
  const value = asString(entry.values[field.key]);
  const set = (v: string) => setField(section as SectionKey, entry.id, field.key, v);
  const placeholder = field.placeholder ?? field.label;

  switch (field.control) {
    case "textarea":
      return (
        <AutoTextarea
          value={value}
          onChange={set}
          placeholder={placeholder}
          className={`text-[13px] leading-[1.6] text-fg-2 ${className}`}
        />
      );
    case "bullets":
      return <BulletsEditor section={section} entryId={entry.id} field={field.key} list={readList(entry, field.key)} />;
    case "image":
      return <ImageSlot value={value} onChange={set} label={field.label} kind={field.role === "qr" ? "qr" : "avatar"} />;
    case "month":
      return <GhostInput value={value} onChange={set} placeholder={placeholder} className={`tnum text-[13px] ${className}`} />;
    case "tags":
      return <GhostInput value={value} onChange={set} placeholder={`${placeholder}（逗号分隔）`} className={`text-[13px] ${className}`} />;
    case "text":
    default:
      return <GhostInput value={value} onChange={set} placeholder={placeholder} className={`text-[13px] ${className}`} />;
  }
}

/** 两列网格：colSpan 2 独占一行，相邻两个 1 并排 */
export function FieldGrid({
  section,
  entry,
  fields,
}: {
  section: string;
  entry: EntryData;
  fields: readonly FieldDescriptor[];
}) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-2">
      {fields.map((f) => (
        <label key={f.key} className={f.colSpan === 2 || f.control === "textarea" ? "col-span-2" : "col-span-1"}>
          <span className="mb-0.5 block px-2 text-[10.5px] font-medium tracking-[0.02em] text-fg-4">
            {f.label}
            {f.required && <span className="ml-0.5 text-fg-3">*</span>}
          </span>
          <FieldControl section={section} entry={entry} field={f} />
        </label>
      ))}
    </div>
  );
}
