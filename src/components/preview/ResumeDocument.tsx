/* 整份简历的排版：按描述符顺序渲染可见且非空的模块 */

import type { EntryData, FieldValue } from "../../data/schema";
import { SECTIONS, SECTION_MAP } from "../../data/sections";
import { useResumeStore } from "../../store/useResumeStore";
import { SectionBody, isEmptySection } from "./SectionRenderer";

const NO_ENTRIES: EntryData[] = [];

/** 从「基本信息」里读作品二维码（字段还在编辑器里，只是渲染位置挪到了页脚） */
function useQrCode(): string {
  const sections = useResumeStore((s) => s.sections);
  const desc = SECTION_MAP.basics;
  const field = desc.entry.fields.find((f) => f.role === "qr");
  if (!field) return "";
  const entry = sections.basics?.[0];
  const v: FieldValue | undefined = entry?.values[field.key];
  return typeof v === "string" ? v.trim() : "";
}

export function ResumeDocument() {
  const sections = useResumeStore((s) => s.sections);
  const visibility = useResumeStore((s) => s.visibility);
  const qr = useQrCode();

  return (
    <div>
      {SECTIONS.map((desc) => {
        const visible = visibility[desc.key] ?? desc.defaultVisible;
        if (!visible) return null;

        const entries = sections[desc.key] ?? NO_ENTRIES;
        if (isEmptySection(desc, entries)) return null;

        const isHeader = desc.layout === "header";
        const isSkills = desc.key === "skills";

        if (isSkills) {
          return (
            <section key={desc.key} className="mt-[2px]">
              <h2 className="mb-0.5 text-heading font-semibold text-ink">
                <span className="border-b-2 border-brand pb-px">{desc.label}</span>
              </h2>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <SectionBody desc={desc} entries={entries} />
                </div>
                {qr && (
                  <div className="flex shrink-0 flex-col items-center gap-0.5">
                    <img src={qr} alt="" className="h-[15mm] w-[15mm]" />
                    <p className="text-micro text-ink-muted">作品集</p>
                  </div>
                )}
              </div>
            </section>
          );
        }

        return (
          <section key={desc.key} className={isHeader ? "" : "mt-[2px]"} data-section-key={desc.key}>
            {!isHeader && (
              <h2
                data-select-section={desc.key}
                className="selectable-block mb-0.5 inline-block cursor-pointer rounded-[6px] text-heading font-semibold text-ink transition-[background-color,box-shadow] duration-100"
              >
                <span className="border-b-2 border-brand pb-px">{desc.label}</span>
              </h2>
            )}
            <SectionBody desc={desc} entries={entries} />
          </section>
        );
      })}
    </div>
  );
}
