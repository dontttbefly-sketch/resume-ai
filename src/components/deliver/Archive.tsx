/* ============================================================================
 * 已投递档案：全部投递记录，可搜索、可按行业 / 方向分组
 * ========================================================================== */

import { useDeferredValue, useMemo, useState } from "react";

import type { DeliveredRec } from "../../lib/bossApi";
import { useBossStore } from "../../store/useBossStore";
import { IconSearch } from "../icons";
import { Button } from "../kit/Button";
import { Segmented } from "../kit/Segmented";

type Group = "none" | "industry" | "direction";
const PAGE = 60;
const NO_DELIVERED: DeliveredRec[] = [];

function Row({ d }: { d: DeliveredRec }) {
  const date = d.deliveredAt ? d.deliveredAt.slice(5, 10).replace("-", "/") : "";
  return (
    <li className="flex items-center gap-3 rounded-[12px] px-2.5 py-2 transition-colors hover:bg-fill">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-fg">{d.title || "（无标题）"}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-fg-3">
          {d.company}
          {d.industry && <span className="text-fg-4"> · {d.industry}</span>}
        </p>
      </div>
      <span className="tnum shrink-0 text-[12px] font-medium text-fg-2">{d.salary}</span>
      <span className="tnum w-10 shrink-0 text-right text-[11px] text-fg-4">{date}</span>
    </li>
  );
}

export function Archive() {
  const delivered = useBossStore((s) => s.snap?.delivered ?? NO_DELIVERED);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<Group>("none");
  const [limit, setLimit] = useState(PAGE);
  const query = useDeferredValue(q.trim().toLowerCase());

  const list = useMemo(() => {
    const rev = [...delivered].reverse();
    if (!query) return rev;
    return rev.filter((d) =>
      [d.title, d.company, d.industry, d.direction, d.salary].some((x) => (x ?? "").toLowerCase().includes(query)),
    );
  }, [delivered, query]);

  const groups = useMemo(() => {
    if (group === "none") return null;
    const map = new Map<string, DeliveredRec[]>();
    for (const d of list) {
      const k = (group === "industry" ? d.industry : d.direction) || "未标注";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [list, group]);

  return (
    <section className="glass flex max-h-[620px] min-h-[320px] flex-col overflow-hidden" style={{ ["--r" as string]: "var(--r-panel)" }}>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5 px-5 pb-3 pt-5">
        <p className="text-[14px] font-semibold tracking-[-0.01em] text-fg">已投递</p>
        <span className="tnum text-[12px] text-fg-4">{query ? `${list.length} / ${delivered.length}` : delivered.length}</span>
        <Segmented<Group>
          size="sm"
          className="ml-auto"
          value={group}
          onChange={(g) => {
            setGroup(g);
            setLimit(PAGE);
          }}
          options={[
            { value: "none", label: "时间" },
            { value: "industry", label: "行业" },
            { value: "direction", label: "方向" },
          ]}
        />
      </div>
      <div className="relative mx-5 mb-2 shrink-0">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-4" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="搜公司、岗位、行业…"
          className="field !py-2 pl-9"
        />
      </div>

      <div className="thin-scroll fade-y min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {groups ? (
          groups.map(([k, items]) => (
            <div key={k} className="pt-2">
              <p className="flex items-baseline gap-2 px-2.5 pb-1 pt-1 text-[11.5px] font-medium text-fg-3">
                {k}
                <span className="tnum text-fg-4">{items.length}</span>
              </p>
              <ul className="grid gap-x-4 xl:grid-cols-2">
                {items.slice(0, 12).map((d) => (
                  <Row key={d.jobId} d={d} />
                ))}
                {items.length > 12 && <li className="px-2.5 py-1 text-[11.5px] text-fg-4">还有 {items.length - 12} 条…</li>}
              </ul>
            </div>
          ))
        ) : (
          <ul className="grid gap-x-4 pt-1 xl:grid-cols-2">
            {list.slice(0, limit).map((d) => (
              <Row key={d.jobId} d={d} />
            ))}
          </ul>
        )}
        {!groups && list.length > limit && (
          <div className="flex justify-center pt-2">
            <Button size="sm" pill onClick={() => setLimit((l) => l + PAGE)}>
              再显示 {Math.min(PAGE, list.length - limit)} 条
            </Button>
          </div>
        )}
        {list.length === 0 && <p className="py-10 text-center text-[12.5px] text-fg-4">{query ? "没搜到" : "还没有投递记录"}</p>}
      </div>
    </section>
  );
}
