/* ============================================================================
 * 顶栏 · 极简版
 *
 * 原则：只保留使用过程中必须看到的东西
 *   常驻：Logo · 档案 · 经历库 · AI · 导出 · 头像
 *   收纳：账号 / 完成度 / 版本载入 / 示例 / 清空 → 全部进头像下拉
 * ========================================================================== */

import { useEffect, useMemo, useRef, useState } from "react";

import { exportPdf } from "../lib/print";
import { buildAiDevResume } from "../data/privateResume";
import { checkCompletion } from "../lib/resume";
import { MAX_PROFILES, useResumeStore } from "../store/useResumeStore";
import { useSelectionStore } from "../store/useSelectionStore";
import { isPrintGuideDismissed, PrintGuideDialog } from "./PrintGuide";
import { AccountButton } from "./Auth";

/* ------------------------- 头像下拉菜单 ------------------------- */

function MenuBtn({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full rounded-xl px-3 py-2 text-left text-[12.5px] transition-colors duration-100 " +
        (danger
          ? "text-rose-500 hover:bg-rose-50"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-800")
      }
    >
      {children}
    </button>
  );
}

function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const setVaultOpen = useSelectionStore((s) => s.setVaultOpen);
  const ref = useRef<HTMLDivElement>(null);

  const sections = useResumeStore((s) => s.sections);
  const visibility = useResumeStore((s) => s.visibility);
  const loadMine = useResumeStore((s) => s.loadMine);
  const loadFull = useResumeStore((s) => s.loadFull);
  const loadAiDev = useResumeStore((s) => s.loadAiDev);
  const hasAiDev = buildAiDevResume() != null;
  const loadSample = useResumeStore((s) => s.loadSample);
  const clearAll = useResumeStore((s) => s.clearAll);

  const report = useMemo(() => checkCompletion(sections, visibility), [sections, visibility]);
  const missingText = report.missing.length
    ? report.missing.map((m) => `· ${m.section}：${m.label}`).join("\n")
    : "所有必填项都已填写";

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-500 text-[12px] font-bold text-white shadow-sm ring-2 ring-white transition-all duration-150 hover:brightness-110 active:scale-90"
        title="账号与设置"
      >
        邹
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 origin-top-right overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 shadow-[0_4px_12px_rgba(15,23,42,0.08),0_16px_48px_rgba(15,23,42,0.14)] backdrop-blur-2xl animate-[vault-fade-in_160ms_ease-out]">
          {/* 完成度 */}
          <div className="border-b border-slate-100 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-slate-500">简历完成度</span>
              <span className="tnum text-[12px] font-semibold text-slate-700">{report.percent}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={
                  "h-full rounded-full bg-gradient-to-r transition-all duration-500 " +
                  (report.percent === 100 ? "from-emerald-400 to-emerald-500" : "from-violet-400 to-sky-400")
                }
                style={{ width: `${report.percent}%` }}
              />
            </div>
            {report.missing.length > 0 && (
              <p className="mt-2 whitespace-pre-line text-[10.5px] leading-relaxed text-slate-400">
                {missingText}
              </p>
            )}
          </div>

          {/* 版本载入 */}
          <div className="border-b border-slate-100 px-2 py-2">
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-300">
              版本
            </p>
            <MenuBtn
              onClick={() => {
                if (window.confirm("载入一页版会覆盖当前所有内容，确定吗？")) loadMine();
                setOpen(false);
              }}
            >
              载入一页版
            </MenuBtn>
            <MenuBtn
              onClick={() => {
                if (window.confirm("载入完整版会覆盖当前所有内容，确定吗？")) loadFull();
                setOpen(false);
              }}
            >
              载入完整版（3 页）
            </MenuBtn>
            {hasAiDev && (
              <MenuBtn
                onClick={() => {
                  if (window.confirm("载入 AI 开发版会覆盖当前档案（建议先新建档案），确定吗？")) loadAiDev();
                  setOpen(false);
                }}
              >
                载入 AI 开发版
              </MenuBtn>
            )}
            <MenuBtn
              onClick={() => {
                if (window.confirm("载入示例会覆盖当前内容，确定吗？")) loadSample();
                setOpen(false);
              }}
            >
              载入示例
            </MenuBtn>
          </div>

          {/* 经历库 */}
          <div className="border-b border-slate-100 px-2 py-2">
            <MenuBtn
              onClick={() => {
                setVaultOpen(true);
                setOpen(false);
              }}
            >
              📖 经历库
            </MenuBtn>
          </div>

          {/* 账号 */}
          <div className="border-b border-slate-100 px-4 py-3">
            <AccountButton />
          </div>

          {/* 危险区 */}
          <div className="px-2 py-2">
            <MenuBtn
              danger
              onClick={() => {
                if (window.confirm("清空所有内容？此操作不可恢复。")) clearAll();
                setOpen(false);
              }}
            >
              清空全部内容
            </MenuBtn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------- 档案切换（紧凑） ------------------------- */

function ProfileBar() {
  const profiles = useResumeStore((s) => s.profiles);
  const activeId = useResumeStore((s) => s.activeId);
  const createProfile = useResumeStore((s) => s.createProfile);
  const duplicateProfile = useResumeStore((s) => s.duplicateProfile);
  const switchProfile = useResumeStore((s) => s.switchProfile);

  const full = profiles.length >= MAX_PROFILES;

  return (
    <div className="flex items-center gap-1">
      <select
        value={activeId}
        onChange={(e) => switchProfile(e.target.value)}
        title="切换简历档案"
        className="cursor-pointer rounded-lg border border-slate-200/70 bg-white/60 px-2 py-1 text-[12px] text-slate-600 outline-none backdrop-blur transition-colors hover:border-slate-300 focus:border-sky-300"
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        title={full ? `最多 ${MAX_PROFILES} 份` : "新建档案"}
        disabled={full}
        onClick={() => createProfile()}
        className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 active:scale-90 disabled:opacity-30"
      >
        +
      </button>
      <button
        type="button"
        title={full ? "档案已满" : "复制当前档案"}
        disabled={full}
        onClick={() => void duplicateProfile()}
        className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 active:scale-90 disabled:opacity-30"
      >
        ⧉
      </button>
    </div>
  );
}

/* ------------------------------ 顶栏 ------------------------------ */

export function Toolbar() {
  const openFull = useSelectionStore((s) => s.openFull);
  const [guideOpen, setGuideOpen] = useState(false);

  const requestExport = () => {
    if (isPrintGuideDismissed()) void exportPdf();
    else setGuideOpen(true);
  };

  return (
    <header className="no-print relative z-30 flex h-12 shrink-0 items-center gap-3 border-b border-slate-200/60 bg-white/70 px-4 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-gradient-to-br from-violet-500 via-indigo-500 to-sky-400 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(99,102,241,0.35)]">
          简
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-slate-700">简历工作台</span>
      </div>

      {/* 档案 */}
      <div className="hidden md:flex">
        <ProfileBar />
      </div>

      {/* 右侧 */}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={openFull}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-sky-400 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_2px_10px_rgba(99,102,241,0.35)] transition-all duration-150 hover:brightness-110 active:scale-95"
        >
          ✦ AI
        </button>
        <button
          type="button"
          onClick={requestExport}
          className="rounded-full bg-slate-800 px-3.5 py-1.5 text-[12px] font-medium text-white shadow-sm transition-all duration-150 hover:bg-slate-700 active:scale-95"
        >
          导出 PDF
        </button>

        <div className="mx-0.5 h-5 w-px bg-slate-200" />

        <AvatarMenu />
      </div>

      {guideOpen && (
        <PrintGuideDialog onCancel={() => setGuideOpen(false)} onProceed={() => { setGuideOpen(false); void exportPdf(); }} />
      )}
    </header>
  );
}
