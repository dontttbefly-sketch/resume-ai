/* ============================================================================
 * 三种排版器
 *
 * 每个排版器只按 FieldRole 取字段，不认识 school / company 这类业务字段名。
 * 想调整某字段在简历上的位置，改它的 role 即可，不用动这里。
 * ========================================================================== */

import type { EntryData, SectionDescriptor } from "../../data/schema";
import {
  asString,
  fieldsByRole,
  formatDateRange,
  isEntryEmpty,
  joinValues,
  readList,
  splitTags,
} from "../../lib/resume";

/* ------------------------------ 抬头 ------------------------------ */

function HeaderLayout({ desc, entries }: { desc: SectionDescriptor; entries: EntryData[] }) {
  const entry = entries[0];
  if (!entry) return null;

  const name = joinValues(entry, fieldsByRole(desc, "primary"));
  const title = joinValues(entry, fieldsByRole(desc, "secondary"));
  const metas = fieldsByRole(desc, "meta")
    .map((f) => asString(entry.values[f.key]).trim())
    .filter(Boolean);
  const body = joinValues(entry, fieldsByRole(desc, "body"), "\n");
  const avatarField = fieldsByRole(desc, "avatar")[0];
  const avatar = avatarField ? asString(entry.values[avatarField.key]).trim() : "";
  const qrField = fieldsByRole(desc, "qr")[0];
  const qr = qrField ? asString(entry.values[qrField.key]).trim() : "";

  if (!name && !title && metas.length === 0 && !body && !avatar && !qr) return null;

  return (
    <header className="border-b border-line pb-1.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {name && <h1 className="text-name font-bold text-ink">{name}</h1>}
          {title && <p className="mt-0.5 text-heading font-semibold text-brand">{title}</p>}
          {metas.length > 0 && (
            <p className="tnum mt-1 text-small text-ink-muted">{metas.join(" · ")}</p>
          )}
          {body && <p className="mt-2 whitespace-pre-line text-body text-ink">{body}</p>}
        </div>

        {(qr || avatar) && (
          /* 右侧是「作品二维码 + 证件照」横排。二维码与照片同高（20mm），
             两者加起来不到 50mm，只要左列文字比 20mm 高（必然如此），
             抬头总高就仍由左列决定，不会因为加了码而变高。 */
          <div className="flex shrink-0 items-start gap-2">
            {qr && <img src={qr} alt="" className="h-[20mm] w-[20mm] shrink-0" />}
            {avatar && (
              <img
                src={avatar}
                alt=""
                className="h-[20mm] w-[20mm] shrink-0 rounded-sm object-cover"
              />
            )}
          </div>
        )}
      </div>
    </header>
  );
}

/* ---------------------------- 时间线条目 ---------------------------- */

function EntriesLayout({ desc, entries }: { desc: SectionDescriptor; entries: EntryData[] }) {
  const metaFields = fieldsByRole(desc, "meta");
  const plainMeta = metaFields.filter((f) => f.control !== "tags");
  const tagFields = metaFields.filter((f) => f.control === "tags");
  const bodyFields = fieldsByRole(desc, "body");
  const bulletFields = fieldsByRole(desc, "bullets");

  return (
    <div className="space-y-1">
      {entries.map((entry) => {
        const primary = joinValues(entry, fieldsByRole(desc, "primary"));
        const dates = formatDateRange(entry, fieldsByRole(desc, "date"));
        const secondary = joinValues(entry, fieldsByRole(desc, "secondary"));
        const sub = [secondary, joinValues(entry, plainMeta)].filter(Boolean).join(" · ");
        const tags = tagFields.flatMap((f) => splitTags(asString(entry.values[f.key])));
        const bodies = bodyFields
          .map((f) => asString(entry.values[f.key]).trim())
          .filter(Boolean);
        const bullets = bulletFields
          .flatMap((f) => readList(entry, f.key))
          .map((s) => s.trim())
          .filter(Boolean);

        if (!primary && !sub && tags.length === 0 && bodies.length === 0 && bullets.length === 0) {
          return null;
        }

        return (
          <article key={entry.id} className="entry-block">
            <div className="entry-head flex items-baseline justify-between gap-3">
              <h3 className="text-body font-semibold text-ink">{primary}</h3>
              {dates && <span className="tnum shrink-0 text-small text-ink-muted">{dates}</span>}
            </div>

            {(sub || tags.length > 0) && (
              <div className="entry-head mt-px flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-ink-muted">
                {sub && <span>{sub}</span>}
                {tags.map((t) => (
                  <span key={t} className="rounded border border-line px-1 text-micro">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {bodies.map((b, i) => (
              <p key={i} className="mt-px whitespace-pre-line text-small text-ink-muted">
                {b}
              </p>
            ))}

            {bullets.length > 0 && (
              <ul className="mt-0 space-y-0">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-1.5 text-body text-ink">
                    <span className="select-none text-ink-soft">•</span>
                    <span className="flex-1">{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}

/* --------------------------- 左标签右内容 --------------------------- */

function SkillListLayout({ desc, entries }: { desc: SectionDescriptor; entries: EntryData[] }) {
  return (
    <div className="space-y-0">
      {entries.map((entry) => {
        const category = joinValues(entry, fieldsByRole(desc, "primary"));
        const content = joinValues(entry, fieldsByRole(desc, "body"), " ");
        if (!category && !content) return null;
        return (
          <div
            key={entry.id}
            className="entry-block grid grid-cols-[fit-content(9em)_1fr] gap-x-3"
          >
            <span className="text-body font-semibold text-ink">{category}</span>
            <span className="whitespace-pre-line text-body text-ink">{content}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- 分发 ------------------------------- */

/** 该模块下所有条目是否都为空（用于跳过空白模块，避免简历上出现空标题） */
export function isEmptySection(desc: SectionDescriptor, entries: EntryData[]): boolean {
  return entries.length === 0 || entries.every((e) => isEntryEmpty(desc, e));
}

export function SectionBody({
  desc,
  entries,
}: {
  desc: SectionDescriptor;
  entries: EntryData[];
}) {
  switch (desc.layout) {
    case "header":
      return <HeaderLayout desc={desc} entries={entries} />;
    case "skill-list":
      return <SkillListLayout desc={desc} entries={entries} />;
    case "entries":
    default:
      return <EntriesLayout desc={desc} entries={entries} />;
  }
}
