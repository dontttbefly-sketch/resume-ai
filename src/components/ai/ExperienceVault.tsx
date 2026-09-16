/* ============================================================================
 * 经历库浮窗：从右侧滑入，约遮半屏
 *
 * 交互（见讨论定稿）：
 *   - 默认只读浏览
 *   - 点击「编辑」进入编辑态（就地修改公司/项目/摘要）
 *   - 切换有状态特效说明（顶部横幅渐变提示）
 * ========================================================================== */

import { useMemo, useState } from "react";
import { useExperienceStore } from "../../store/useExperienceStore";
import { useSelectionStore } from "../../store/useSelectionStore";

function VaultItem({
  item,
  editing,
}: {
  item: { id: string; company: string; project: string; summary: string };
  editing: boolean;
}) {
  const removeItem = useExperienceStore((s) => s.removeItem);
  const [company, setCompany] = useState(item.company);
  const [project, setProject] = useState(item.project);
  const [summary, setSummary] = useState(item.summary);

  if (editing) {
    return (
      <div className="rounded-2xl border border-sky-200 bg-white p-3.5 shadow-sm">
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-slate-800 outline-none ring-2 ring-transparent transition-all focus:border-sky-400 focus:ring-sky-100"
        />
        <input
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] text-slate-600 outline-none ring-2 ring-transparent transition-all focus:border-sky-400 focus:ring-sky-100"
        />
        <textarea
          value={summary}
          rows={3}
          onChange={(e) => setSummary(e.target.value)}
          className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] leading-relaxed text-slate-600 outline-none ring-2 ring-transparent transition-all focus:border-sky-400 focus:ring-sky-100"
        />
      </div>
    );
  }
  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white/80 p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all duration-150 hover:border-slate-300 hover:shadow-[0_2px_12px_rgba(15,23,42,0.07)]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-slate-800">{item.company}</p>
        <button
          type="button"
          onClick={() => removeItem(item.id)}
          className="shrink-0 rounded-full px-1.5 text-[11px] text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-400 group-hover:opacity-100"
          title="删除"
        >
          ✕
        </button>
      </div>
      <p className="mt-0.5 text-[12.5px] font-medium text-slate-500">{item.project}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{item.summary}</p>
    </div>
  );
}

export function ExperienceVault() {
  const vaultOpen = useSelectionStore((s) => s.vaultOpen);
  const setVaultOpen = useSelectionStore((s) => s.setVaultOpen);
  const items = useExperienceStore((s) => s.items);
  const addItem = useExperienceStore((s) => s.addItem);
  const [editing, setEditing] = useState(false);

  /* 按公司分组（经历库太长 → 分组折叠，一眼看清有什么） */
  const groups = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const it of items) {
      if (!map.has(it.company)) map.set(it.company, []);
      map.get(it.company)!.push(it);
    }
    return [...map.entries()];
  }, [items]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (!vaultOpen) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={() => setVaultOpen(false)}>
      {/* 背景遮罩：轻 */}
      <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] animate-[vault-fade-in_200ms_ease-out]" />

      {/* 浮窗本体：右侧滑入，约半屏 */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 right-0 top-0 flex w-[min(560px,52vw)] flex-col border-l border-white/70 bg-white/85 shadow-[0_-4px_48px_rgba(15,23,42,0.12)] backdrop-blur-2xl animate-[vault-slide-in_300ms_cubic-bezier(0.32,0.72,0,1)]"
      >
        {/* 头部 */}
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-slate-800">经历库</h2>
            <p className="mt-0.5 text-[11.5px] text-slate-400">
              {items.length} 条经历 · 写简历时 AI 会自动引用这些素材
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={
              "rounded-full px-4 py-1.5 text-[12px] font-medium transition-all duration-150 active:scale-95 " +
              (editing
                ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                : "bg-slate-800 text-white hover:bg-slate-700")
            }
          >
            {editing ? "完成" : "编辑"}
          </button>
          <button
            type="button"
            onClick={() => setVaultOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 active:scale-90"
          >
            ✕
          </button>
        </div>

        {/* 状态提示条（编辑/浏览切换的特效说明） */}
        <div
          className={
            "shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] " +
            (editing ? "max-h-10 opacity-100" : "max-h-0 opacity-0")
          }
        >
          <div className="border-b border-emerald-100 bg-emerald-50/80 px-5 py-2 text-[11.5px] text-emerald-600">
            ✎ 编辑模式 — 修改完成后点击「完成」保存，AI 会记住这些经历
          </div>
        </div>

        {/* 内容 */}
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {groups.map(([company, groupItems]) => {
            const isCollapsed = collapsed.has(company);
            return (
              <div key={company} className="mb-3">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(company)) next.delete(company);
                      else next.add(company);
                      return next;
                    })
                  }
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-100"
                >
                  <span
                    className={
                      "text-[10px] text-slate-400 transition-transform duration-200 " +
                      (isCollapsed ? "" : "rotate-90")
                    }
                  >
                    ▸
                  </span>
                  <span className="text-[13px] font-semibold text-slate-700">{company}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-400">
                    {groupItems.length} 条
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="ml-3 mt-1 space-y-2 border-l-2 border-slate-100 pl-3">
                    {groupItems.map((it) => (
                      <VaultItem key={it.id} item={it} editing={editing} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-300">
              <p className="text-[13px]">经历库还是空的</p>
              <p className="text-[11.5px]">跟 AI 聊聊你的经历，它会自动帮你存进来</p>
            </div>
          )}
        </div>

        {/* 底部：新增 */}
        <div className="shrink-0 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={() => addItem({ company: "新经历", project: "项目名", summary: "描述…" })}
            className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-[12px] text-slate-400 transition-all hover:border-sky-300 hover:bg-sky-50/50 hover:text-sky-500"
          >
            + 新增一条经历
          </button>
        </div>
      </div>
    </div>
  );
}
