/* ============================================================================
 * 条目卡片：默认收起成一行摘要（主标题 · 副标题 · 时间），点开就地编辑
 * 悬停 → 纸上对应段落浮出标记线；展开 → 纸张滚到这一段
 * ========================================================================== */

import type { EntryData, SectionDescriptor } from "../../../data/schema";
import type { SectionKey } from "../../../data/sections";
import { fieldsByRole, formatDateRange, joinValues, readList } from "../../../lib/resume";
import { useResumeStore } from "../../../store/useResumeStore";
import { IconArrowDown, IconArrowUp, IconChevron, IconTrash } from "../../icons";
import { confirmDialog } from "../../kit/Dialog";
import { entrySelector, linkOnPaper, revealOnPaper } from "../paperLink";
import { FieldGrid } from "./FieldControl";
import { BulletsEditor } from "./BulletsEditor";

function summaryOf(desc: SectionDescriptor, entry: EntryData) {
  const primary = joinValues(entry, fieldsByRole(desc, "primary"));
  const secondary = joinValues(entry, [...fieldsByRole(desc, "secondary"), ...fieldsByRole(desc, "meta").filter((f) => f.control !== "tags")]);
  const date = formatDateRange(entry, fieldsByRole(desc, "date"));
  const body = joinValues(entry, fieldsByRole(desc, "body"), " ");
  const bullets = fieldsByRole(desc, "bullets").flatMap((f) => readList(entry, f.key)).filter((b) => b.trim());
  return { primary, secondary, date, body, bullets };
}

export function EntryCard({
  desc,
  entry,
  index,
  count,
  expanded,
  onToggle,
}: {
  desc: SectionDescriptor;
  entry: EntryData;
  index: number;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const removeEntry = useResumeStore((s) => s.removeEntry);
  const moveEntry = useResumeStore((s) => s.moveEntry);
  const sk = desc.key as SectionKey;
  const { primary, secondary, date, body, bullets } = summaryOf(desc, entry);
  const sel = entrySelector(entry.id);

  const headFields = desc.entry.fields.filter((f) => f.control !== "bullets");
  const bulletFields = desc.entry.fields.filter((f) => f.control === "bullets");
  const min = desc.entry.minItems ?? 0;

  // 没有主标题的条目（比如「个人优势」只有要点）拿第一条要点当标题
  const title =
    primary || bullets[0] || (desc.layout === "skill-list" ? "未命名分类" : `${desc.entry.itemNoun}（未命名）`);
  const sub =
    desc.layout === "skill-list"
      ? body
      : secondary || (bullets.length ? `${bullets.length} 条要点` : "");
  const named = Boolean(primary || bullets[0]);

  return (
    <div
      className={`surface group/card lift ${expanded ? "surface-strong !transform-none" : ""}`}
      style={{ ["--r" as string]: "var(--r-card)" }}
      onMouseEnter={() => linkOnPaper(sel, true)}
      onMouseLeave={() => linkOnPaper(sel, false)}
    >
      <div className="relative p-1.5">
        <button
          type="button"
          onClick={() => {
            onToggle();
            if (!expanded) revealOnPaper(sel, false);
          }}
          className="press flex w-full min-w-0 items-start gap-2 rounded-[12px] px-2 py-1.5 text-left hover:bg-fill"
          aria-expanded={expanded}
        >
          <IconChevron
            className={`mt-[3px] h-3.5 w-3.5 shrink-0 text-fg-4 transition-transform duration-300 ${expanded ? "" : "-rotate-90"}`}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className={`truncate text-[13px] font-semibold tracking-[-0.005em] ${named ? "text-fg" : "text-fg-4"}`}>
                {title}
              </span>
              {date && (
                <span className="tnum ml-auto shrink-0 text-[11px] text-fg-4 transition-opacity duration-200 group-hover/card:opacity-0">
                  {date}
                </span>
              )}
            </span>
            {sub && <span className="mt-0.5 block truncate text-[11.5px] text-fg-3">{sub}</span>}
          </span>
        </button>

        {/* 悬停才浮出的操作：盖在日期位置上，不占版面 */}
        <div className="surface surface-strong absolute right-3 top-2.5 flex items-center gap-px rounded-[10px] p-0.5 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 group-focus-within/card:opacity-100">
          {desc.entry.sortable && (
            <>
              <button
                type="button"
                aria-label="上移"
                disabled={index === 0}
                onClick={() => moveEntry(sk, entry.id, -1)}
                className="press flex h-6 w-6 items-center justify-center rounded-[8px] text-fg-4 hover:bg-fill-2 hover:text-fg disabled:opacity-25"
              >
                <IconArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="下移"
                disabled={index === count - 1}
                onClick={() => moveEntry(sk, entry.id, 1)}
                className="press flex h-6 w-6 items-center justify-center rounded-[8px] text-fg-4 hover:bg-fill-2 hover:text-fg disabled:opacity-25"
              >
                <IconArrowDown className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {desc.entry.removable && (
            <button
              type="button"
              aria-label="删除"
              disabled={count <= min}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: `删除「${title}」？`,
                  body: "这一条的全部内容会一起删掉。",
                  confirmText: "删除",
                  danger: true,
                });
                if (ok) removeEntry(sk, entry.id);
              }}
              className="press flex h-6 w-6 items-center justify-center rounded-[8px] text-fg-4 hover:bg-fill-2 hover:text-danger disabled:opacity-25"
            >
              <IconTrash className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="disclose" data-open={expanded}>
        <div>
          <div className="space-y-3 px-2.5 pb-3 pt-0.5">
            {headFields.length > 0 && <FieldGrid section={desc.key} entry={entry} fields={headFields} />}
            {bulletFields.map((f) => (
              <div key={f.key}>
                <span className="mb-0.5 block px-2 text-[10.5px] font-medium tracking-[0.02em] text-fg-4">{f.label}</span>
                <BulletsEditor section={desc.key} entryId={entry.id} field={f.key} list={readList(entry, f.key)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
