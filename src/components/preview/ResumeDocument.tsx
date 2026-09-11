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

/** 页脚：作品集二维码（17mm，右下角，与说明小字并排；17mm 是实测可扫下限） */
function FooterQr({ qr }: { qr: string }) {
  if (!qr) return null;
  return (
    <footer className="mt-[2px] flex items-center justify-between border-t border-line pt-[3px]">
      <p className="text-small text-ink-muted">作品集 · 扫码即达</p>
      <img src={qr} alt="" className="h-[17mm] w-[17mm] shrink-0" />
    </footer>
  );
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

        return (
          <section key={desc.key} className={isHeader ? "" : "mt-[2px]"}>
            {!isHeader && (
              <h2 className="mb-0.5 text-heading font-semibold text-ink">
                <span className="border-b-2 border-brand pb-px">{desc.label}</span>
              </h2>
            )}
            <SectionBody desc={desc} entries={entries} />
          </section>
        );
      })}
      <FooterQr qr={qr} />
    </div>
  );
}
