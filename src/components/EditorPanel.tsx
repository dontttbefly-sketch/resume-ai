/* 左侧编辑区：模块清单 + 显示/隐藏开关 */

import type { EntryData } from "../data/schema";
import { SECTIONS } from "../data/sections";
import { useResumeStore } from "../store/useResumeStore";
import { SectionEditor } from "./SectionEditor";
import { IconEye, IconEyeOff } from "./icons";
import { IconButton } from "./ui";

const NO_ENTRIES: EntryData[] = [];

export function EditorPanel() {
  const sections = useResumeStore((s) => s.sections);
  const visibility = useResumeStore((s) => s.visibility);
  const toggleSection = useResumeStore((s) => s.toggleSection);
  const setAllVisible = useResumeStore((s) => s.setAllVisible);

  const hiddenCount = SECTIONS.filter(
    (d) => !(visibility[d.key] ?? d.defaultVisible),
  ).length;

  return (
    <aside className="app-editor thin-scroll flex w-[400px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-slate-50 2xl:w-[460px]">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[12.5px] font-semibold text-slate-700">简历内容</h2>
          {hiddenCount > 0 && (
            <span className="text-[11px] text-slate-400">{hiddenCount} 个模块已隐藏</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAllVisible(true)}
            className="rounded-md px-1.5 py-0.5 text-[11.5px] text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-700"
          >
            全部显示
          </button>
          <button
            type="button"
            onClick={() => setAllVisible(false)}
            className="rounded-md px-1.5 py-0.5 text-[11.5px] text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-700"
          >
            全部隐藏
          </button>
        </div>
      </div>

      <div className="space-y-2.5 px-3 py-3 pb-10">
        {SECTIONS.map((desc) => {
          const visible = visibility[desc.key] ?? desc.defaultVisible;
          const count = (sections[desc.key] ?? NO_ENTRIES).length;

          return (
            <section
              key={desc.key}
              className={`rounded-xl border bg-white shadow-sm transition ${
                visible ? "border-slate-200" : "border-dashed border-slate-300"
              }`}
            >
              <header className="flex items-center gap-2 px-3 py-2">
                <h3
                  className={`text-[13px] font-semibold ${
                    visible ? "text-slate-800" : "text-slate-400"
                  }`}
                >
                  {desc.label}
                </h3>
                {desc.entry.addable && count > 0 && (
                  <span className="rounded bg-slate-100 px-1.5 text-[10.5px] leading-4 text-slate-500">
                    {count}
                  </span>
                )}
                {!visible && (
                  <span className="rounded bg-slate-100 px-1.5 text-[10.5px] leading-4 text-slate-400">
                    已隐藏
                  </span>
                )}

                <div className="ml-auto">
                  <IconButton
                    title={visible ? "在简历上隐藏该模块" : "在简历上显示该模块"}
                    onClick={() => toggleSection(desc.key)}
                  >
                    {visible ? (
                      <IconEye className="h-4 w-4" />
                    ) : (
                      <IconEyeOff className="h-4 w-4" />
                    )}
                  </IconButton>
                </div>
              </header>

              <div className={`px-3 pb-3 ${visible ? "" : "opacity-55"}`}>
                <SectionEditor section={desc.key} />
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
