/* ============================================================================
 * 要点列表编辑
 *   回车 = 在下面新增一条；空行里退格 = 删掉这一条；悬停露出 ↑ ↓ ✕
 *   中文输入法组字时的回车不算（isComposing）
 * ========================================================================== */

import { useEffect, useRef } from "react";

import type { SectionKey } from "../../../data/sections";
import { useResumeStore } from "../../../store/useResumeStore";
import { IconArrowDown, IconArrowUp, IconPlus, IconX } from "../../icons";
import { AutoTextarea } from "../../kit/Field";
import { linkOnPaper } from "../paperLink";

export function BulletsEditor({
  section,
  entryId,
  field,
  list,
}: {
  section: string;
  entryId: string;
  field: string;
  list: string[];
}) {
  const addBullet = useResumeStore((s) => s.addBullet);
  const setBullet = useResumeStore((s) => s.setBullet);
  const removeBullet = useResumeStore((s) => s.removeBullet);
  const moveBullet = useResumeStore((s) => s.moveBullet);
  const sk = section as SectionKey;

  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const focusAt = useRef<number | null>(null);

  useEffect(() => {
    if (focusAt.current == null) return;
    const el = refs.current[focusAt.current];
    focusAt.current = null;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });

  const bulletSel = (i: number) => `[data-entry-id="${CSS.escape(entryId)}"] [data-bullet-index="${i}"]`;

  return (
    <div>
      <ul className="space-y-px">
        {list.map((b, i) => (
          <li
            key={i}
            className="group/b relative flex items-start"
            onMouseEnter={() => linkOnPaper(bulletSel(i), true)}
            onMouseLeave={() => linkOnPaper(bulletSel(i), false)}
          >
            <span className="mt-[12px] mr-0.5 h-[5px] w-[5px] shrink-0 rounded-full bg-fg-4" />
            <AutoTextarea
              value={b}
              placeholder="写一条要点，回车新增"
              taRef={(el) => {
                refs.current[i] = el;
              }}
              onChange={(t) => setBullet(sk, entryId, field, i, t)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addBullet(sk, entryId, field, i);
                  focusAt.current = i + 1;
                } else if (e.key === "Backspace" && b === "" && list.length > 1) {
                  e.preventDefault();
                  removeBullet(sk, entryId, field, i);
                  focusAt.current = Math.max(0, i - 1);
                }
              }}
              className="pr-[76px] text-[12.5px] leading-[1.65] text-fg-2"
            />
            <div className="surface-strong surface absolute right-1 top-1 flex items-center gap-px rounded-[9px] p-0.5 opacity-0 transition-opacity duration-200 group-focus-within/b:opacity-100 group-hover/b:opacity-100">
              <button
                type="button"
                aria-label="上移"
                disabled={i === 0}
                onClick={() => moveBullet(sk, entryId, field, i, -1)}
                className="press flex h-5 w-5 items-center justify-center rounded-[6px] text-fg-3 hover:bg-fill-2 hover:text-fg disabled:opacity-25"
              >
                <IconArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                aria-label="下移"
                disabled={i === list.length - 1}
                onClick={() => moveBullet(sk, entryId, field, i, 1)}
                className="press flex h-5 w-5 items-center justify-center rounded-[6px] text-fg-3 hover:bg-fill-2 hover:text-fg disabled:opacity-25"
              >
                <IconArrowDown className="h-3 w-3" />
              </button>
              <button
                type="button"
                aria-label="删除这条"
                onClick={() => removeBullet(sk, entryId, field, i)}
                className="press flex h-5 w-5 items-center justify-center rounded-[6px] text-fg-3 hover:bg-fill-2 hover:text-danger"
              >
                <IconX className="h-3 w-3" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          addBullet(sk, entryId, field, list.length - 1);
          focusAt.current = list.length;
        }}
        className="press mt-1 flex h-7 items-center gap-1.5 rounded-[9px] px-2 text-[12px] text-fg-4 hover:bg-fill hover:text-fg-2"
      >
        <IconPlus className="h-3.5 w-3.5" />
        添加要点
      </button>
    </div>
  );
}
