/* 整份简历的排版：按描述符顺序渲染可见且非空的模块 */

import type { EntryData } from "../../data/schema";
import { SECTIONS } from "../../data/sections";
import { useResumeStore } from "../../store/useResumeStore";
import { SectionBody, isEmptySection } from "./SectionRenderer";

const NO_ENTRIES: EntryData[] = [];

export function ResumeDocument() {
  const sections = useResumeStore((s) => s.sections);
  const visibility = useResumeStore((s) => s.visibility);

  return (
    <div>
      {SECTIONS.map((desc) => {
        const visible = visibility[desc.key] ?? desc.defaultVisible;
        if (!visible) return null;

        const entries = sections[desc.key] ?? NO_ENTRIES;
        if (isEmptySection(desc, entries)) return null;

        const isHeader = desc.layout === "header";

        return (
          <section key={desc.key} className={isHeader ? "" : "mt-1.5"}>
            {!isHeader && (
              <h2 className="mb-0.5 text-heading font-semibold text-ink">
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
