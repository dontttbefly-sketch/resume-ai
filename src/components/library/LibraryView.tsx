/* ============================================================================
 * 经历库：所有工作 / 项目经历的结构化沉淀
 * AI 写简历、生成话术、岗位匹配时都以这里为事实来源（防编造）
 *
 *   左：按公司分组的经历卡，就地编辑（公司名失焦才提交，免得打字时卡片跳组）
 *   右：经历挖掘对话，聊完一键提炼入库
 * ========================================================================== */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { useExperienceStore, type ExperienceItem } from "../../store/useExperienceStore";
import { IconBook, IconPlus, IconSearch, IconTrash } from "../icons";
import { Button, IconButton } from "../kit/Button";
import { confirmDialog } from "../kit/Dialog";
import { AutoTextarea, GhostInput } from "../kit/Field";
import { EmptyState } from "../kit/misc";
import { MinerChat } from "./MinerChat";

function ItemCard({ item, highlight }: { item: ExperienceItem; highlight: boolean }) {
  const updateItem = useExperienceStore((s) => s.updateItem);
  const removeItem = useExperienceStore((s) => s.removeItem);
  const [company, setCompany] = useState(item.company);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setCompany(item.company), [item.company]);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight]);

  return (
    <div
      ref={ref}
      className={`surface group/item lift px-3 pb-2.5 pt-2.5 ${highlight ? "anim-rise surface-strong" : ""}`}
      style={{ ["--r" as string]: "var(--r-card)" }}
    >
      <GhostInput
        value={item.project}
        onChange={(v) => updateItem(item.id, { project: v })}
        placeholder="项目 / 岗位名"
        className="text-[14px] font-semibold tracking-[-0.01em]"
      />
      <AutoTextarea
        value={item.summary}
        onChange={(v) => updateItem(item.id, { summary: v })}
        placeholder="背景 → 动作 → 量化结果"
        className="mt-0.5 text-[13px] leading-[1.7] text-fg-2"
      />
      <div className="mt-1 flex items-center gap-2 pl-2">
        <span className="text-[11px] text-fg-4">归属</span>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onBlur={() => company.trim() !== item.company && updateItem(item.id, { company: company.trim() || "未标注" })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="ghost !w-auto min-w-0 flex-1 !py-0.5 text-[11.5px] text-fg-3"
        />
        <span className="tnum text-[11px] text-fg-4">{new Date(item.updatedAt).toLocaleDateString("zh-CN")}</span>
        <IconButton
          label="删除"
          size="xs"
          pill
          className="opacity-0 transition-opacity group-hover/item:opacity-100 hover:!text-danger"
          onClick={async () => {
            if (await confirmDialog({ title: `删除「${item.project}」？`, confirmText: "删除", danger: true })) removeItem(item.id);
          }}
        >
          <IconTrash className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

export function LibraryView() {
  const items = useExperienceStore((s) => s.items);
  const addItem = useExperienceStore((s) => s.addItem);
  const [q, setQ] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const query = useDeferredValue(q.trim().toLowerCase());

  const groups = useMemo(() => {
    const list = query
      ? items.filter((i) => [i.company, i.project, i.summary].some((x) => x.toLowerCase().includes(query)))
      : items;
    const map = new Map<string, ExperienceItem[]>();
    for (const it of list) {
      if (!map.has(it.company)) map.set(it.company, []);
      map.get(it.company)!.push(it);
    }
    return [...map.entries()];
  }, [items, query]);

  const add = () => {
    const id = addItem({ company: "未标注", project: "", summary: "" });
    setFresh(id);
  };

  return (
    <div className="thin-scroll absolute inset-0 overflow-y-auto px-6 pb-12 pt-[100px]">
      <div className="mx-auto max-w-[1360px] space-y-6">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <p className="text-[30px] font-semibold leading-none tracking-[-0.035em] text-fg">经历</p>
            <p className="mt-2.5 text-[13px] text-fg-3">AI 写简历、生成话术时只从这里取事实，不会凭空编</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-4" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜经历…" className="field w-56 !rounded-full !py-2 pl-9" />
            </div>
            <Button variant="primary" size="md" pill onClick={add} icon={<IconPlus className="h-4 w-4" />}>
              新增
            </Button>
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_440px]">
          <div className="min-w-0 space-y-7">
            {items.length === 0 ? (
              <EmptyState className="min-h-[480px]" icon={<IconBook className="h-6 w-6" />} title="经历库还是空的">
                在右边和 AI 聊聊你的经历，或点「新增」手动写一条。
              </EmptyState>
            ) : groups.length === 0 ? (
              <p className="py-20 text-center text-[13px] text-fg-4">没搜到</p>
            ) : (
              groups.map(([company, list]) => (
                <section key={company} className="anim-rise">
                  <p className="mb-2.5 flex items-baseline gap-2 px-1">
                    <span className="text-[15px] font-semibold tracking-[-0.015em] text-fg">{company}</span>
                    <span className="tnum text-[12px] text-fg-4">{list.length}</span>
                  </p>
                  <div className="grid gap-2.5 xl:grid-cols-2">
                    {list.map((it) => (
                      <ItemCard key={it.id} item={it} highlight={fresh === it.id} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
          <MinerChat onExtracted={setFresh} />
        </div>
      </div>
    </div>
  );
}
