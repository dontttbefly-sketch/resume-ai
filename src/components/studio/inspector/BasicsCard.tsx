/* 基本信息：照片 + 姓名 / 求职意向（大字），联系方式网格，个人简介 */

import type { SectionKey } from "../../../data/sections";
import { SECTION_MAP } from "../../../data/sections";
import { asString } from "../../../lib/resume";
import { useResumeStore } from "../../../store/useResumeStore";
import { GhostInput } from "../../kit/Field";
import { FieldGrid } from "./FieldControl";
import { ImageSlot } from "./ImageSlot";

export function BasicsCard() {
  const desc = SECTION_MAP.basics;
  const entry = useResumeStore((s) => s.sections.basics?.[0]);
  const setField = useResumeStore((s) => s.setField);
  if (!entry) return null;

  const fields = desc.entry.fields;
  const images = fields.filter((f) => f.control === "image");
  const name = fields.find((f) => f.role === "primary");
  const title = fields.find((f) => f.role === "secondary");
  const rest = fields.filter((f) => f !== name && f !== title && f.control !== "image");
  const set = (key: string, v: string) => setField("basics" as SectionKey, entry.id, key, v);

  return (
    <div className="surface p-3" style={{ ["--r" as string]: "var(--r-card)" }}>
      <div className="flex items-start gap-3 pb-6">
        <div className="flex gap-2.5">
          {images.map((f) => (
            <ImageSlot
              key={f.key}
              value={asString(entry.values[f.key])}
              onChange={(v) => set(f.key, v)}
              label={f.label}
              kind={f.role === "qr" ? "qr" : "avatar"}
              size={58}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          {name && (
            <GhostInput
              value={asString(entry.values[name.key])}
              onChange={(v) => set(name.key, v)}
              placeholder={name.label}
              className="text-[19px] font-semibold tracking-[-0.02em]"
            />
          )}
          {title && (
            <GhostInput
              value={asString(entry.values[title.key])}
              onChange={(v) => set(title.key, v)}
              placeholder={title.label}
              className="text-[13px] text-fg-2"
            />
          )}
        </div>
      </div>
      <FieldGrid section="basics" entry={entry} fields={rest} />
    </div>
  );
}
