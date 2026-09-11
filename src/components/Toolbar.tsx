/* 顶部工具条：视图切换、导出、示例、清空、完成度自检 */

import { useMemo, useState, type ReactNode } from "react";

import { exportPdf } from "../lib/print";
import { buildAiDevResume } from "../data/privateResume";
import { checkCompletion } from "../lib/resume";
import { MAX_PROFILES, useResumeStore } from "../store/useResumeStore";
import { usePoolStore } from "../store/usePoolStore";
import { useUiStore, type AppView } from "../store/useUiStore";
import { isPrintGuideDismissed, PrintGuideDialog } from "./PrintGuide";
import { AccountButton } from "./Auth";
import {
  IconCopy,
  IconDoc,
  IconDownload,
  IconLayers,
  IconPencil,
  IconPlus,
  IconReset,
  IconSuitcase,
  IconTarget,
  IconTrash,
} from "./icons";
import { Btn, IconButton } from "./ui";

const PRINT_TIP =
  "导出前建议：打印窗口里边距选「无」、取消勾选「页眉和页脚」（否则每页会多出日期和网址）。导出的 PDF 文字可选中、可搜索。";

const SUBTITLE: Record<AppView, string> = {
  resume: "内容自动保存在本机，随时导出 PDF",
  jd: "粘贴岗位描述，看匹配度与话术",
  pool: "抓来的岗位按匹配度排序，投递还是你自己来",
  experience: "和 AI 聊聊经历，沉淀成写简历的素材库",
};

function ViewTab({
  active,
  view,
  children,
}: {
  active: boolean;
  view: AppView;
  children: ReactNode;
}) {
  const setView = useUiStore((s) => s.setView);
  return (
    <button
      type="button"
      onClick={() => setView(view)}
      className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition ${
        active ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------- 档案切换（最多 3 份） ------------------------- */

function ProfileBar() {
  const profiles = useResumeStore((s) => s.profiles);
  const activeId = useResumeStore((s) => s.activeId);
  const createProfile = useResumeStore((s) => s.createProfile);
  const duplicateProfile = useResumeStore((s) => s.duplicateProfile);
  const renameProfile = useResumeStore((s) => s.renameProfile);
  const deleteProfile = useResumeStore((s) => s.deleteProfile);
  const switchProfile = useResumeStore((s) => s.switchProfile);

  const active = profiles.find((p) => p.id === activeId);
  const full = profiles.length >= MAX_PROFILES;
  const last = profiles.length <= 1;

  return (
    <div className="ml-2 flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
      <select
        value={activeId}
        onChange={(e) => switchProfile(e.target.value)}
        title="切换简历档案（最多 3 份，各自独立保存）"
        className="max-w-[132px] cursor-pointer truncate rounded-md bg-white px-2 py-1 text-[12.5px] text-slate-700 outline-none"
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <span className="tnum px-1 text-[10.5px] text-slate-400" title={`最多 ${MAX_PROFILES} 份`}>
        {profiles.length}/{MAX_PROFILES}
      </span>

      <IconButton
        title={full ? `最多 ${MAX_PROFILES} 份，先删一份再新建` : "新建一份空白简历档案"}
        disabled={full}
        onClick={() => {
          if (full) return;
          if (window.confirm("新建并切换到一份空白简历，当前内容仍保留在原档案里。继续吗？")) {
            createProfile();
          }
        }}
      >
        <IconPlus className="h-3.5 w-3.5" />
      </IconButton>

      <IconButton
        title={full ? `最多 ${MAX_PROFILES} 份，先删一份再复制` : "把当前简历复制成一份新档案"}
        disabled={full}
        onClick={() => void duplicateProfile()}
      >
        <IconCopy className="h-3.5 w-3.5" />
      </IconButton>

      <IconButton
        title="重命名当前档案"
        onClick={() => {
          const name = window.prompt("档案名称", active?.name ?? "");
          if (name !== null) renameProfile(name);
        }}
      >
        <IconPencil className="h-3.5 w-3.5" />
      </IconButton>

      <IconButton
        title={last ? "至少保留一份档案" : "删除当前档案（内容不可恢复）"}
        disabled={last}
        onClick={() => {
          if (last) return;
          if (window.confirm(`确定删除「${active?.name}」吗？这份简历的全部内容会一起删掉，不可恢复。`)) {
            deleteProfile();
          }
        }}
      >
        <IconTrash className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );
}

export function Toolbar() {
  const view = useUiStore((s) => s.view);

  const sections = useResumeStore((s) => s.sections);
  const visibility = useResumeStore((s) => s.visibility);
  const loadMine = useResumeStore((s) => s.loadMine);
  const loadFull = useResumeStore((s) => s.loadFull);
  const loadAiDev = useResumeStore((s) => s.loadAiDev);
  const hasAiDev = buildAiDevResume() != null;
  const loadSample = useResumeStore((s) => s.loadSample);
  const clearAll = useResumeStore((s) => s.clearAll);

  const poolCount = usePoolStore((s) => s.pool?.jobs.length ?? 0);

  const report = useMemo(() => checkCompletion(sections, visibility), [sections, visibility]);
  const missingText = report.missing.length
    ? report.missing.map((m) => `· ${m.section}：${m.label}`).join("\n")
    : "所有必填项都已填写";

  const onResumeView = view === "resume";
  const [guideOpen, setGuideOpen] = useState(false);

  const requestExport = () => {
    // 引导只弹一次；勾了「不再提示」后直接进打印
    if (isPrintGuideDismissed()) void exportPdf();
    else setGuideOpen(true);
  };

  return (
    <header className="no-print flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white">
          <IconDoc className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[13.5px] font-semibold text-slate-800">简历工作台</p>
          <p className="text-[10.5px] text-slate-400">{SUBTITLE[view]}</p>
        </div>
      </div>

      <div className="ml-2 flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
        <ViewTab active={view === "resume"} view="resume">
          简历编辑
        </ViewTab>
        <ViewTab active={view === "jd"} view="jd">
          <span className="inline-flex items-center gap-1">
            <IconTarget className="h-3.5 w-3.5" />
            岗位匹配
          </span>
        </ViewTab>
        <ViewTab active={view === "pool"} view="pool">
          <span className="inline-flex items-center gap-1">
            <IconSuitcase className="h-3.5 w-3.5" />
            岗位池
            {poolCount > 0 && (
              <span className="tnum rounded bg-slate-200/80 px-1 text-[10.5px] leading-4 text-slate-500">
                {poolCount}
              </span>
            )}
          </span>
        </ViewTab>
        <ViewTab active={view === "experience"} view="experience">
          <span className="inline-flex items-center gap-1">
            <IconDoc className="h-3.5 w-3.5" />
            经历库
          </span>
        </ViewTab>
      </div>

      {onResumeView && <ProfileBar />}

      <div className="ml-auto flex items-center gap-3">
        <AccountButton />
        {onResumeView && (
          <>
            <div className="hidden items-center gap-2 sm:flex" title={missingText}>
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    report.percent === 100 ? "bg-emerald-500" : "bg-brand"
                  }`}
                  style={{ width: `${report.percent}%` }}
                />
              </div>
              <span className="tnum text-[11.5px] text-slate-500" title={missingText}>
                完成度 {report.filled}/{report.total}
              </span>
            </div>

            <div className="h-5 w-px bg-slate-200" />

            <Btn
              variant="outline"
              title="一页精简版：保留项目经历与 AI 相关内容，已砍掉课程/销售业绩、软技能罗列等非 AI 表述"
              onClick={() => {
                if (window.confirm("载入一页版会覆盖当前所有内容，确定吗？")) loadMine();
              }}
            >
              <IconDoc className="h-3.5 w-3.5" />
              载入一页版
            </Btn>

            <Btn
              variant="outline"
              title="完整版：含全部经历，共 3 页。作为「邹康平简历.pdf」的历史备份，随时可切回。"
              onClick={() => {
                if (window.confirm("载入完整版会覆盖当前所有内容，确定吗？")) loadFull();
              }}
            >
              <IconLayers className="h-3.5 w-3.5" />
              载入完整版
            </Btn>

            {hasAiDev && (
              <Btn
                variant="outline"
                title="AI 开发工程师版：面向开发岗重写的侧重版本，配合「新建档案」使用不覆盖其他简历"
                onClick={() => {
                  if (window.confirm("载入 AI 开发版会覆盖当前档案内容（建议先新建一份档案），确定吗？")) loadAiDev();
                }}
              >
                <IconDoc className="h-3.5 w-3.5" />
                载入 AI 开发版
              </Btn>
            )}

            <Btn
              variant="outline"
              onClick={() => {
                if (window.confirm("载入示例会覆盖当前所有内容，确定吗？")) loadSample();
              }}
            >
              <IconReset className="h-3.5 w-3.5" />
              载入示例
            </Btn>

            <Btn
              variant="danger"
              onClick={() => {
                if (window.confirm("确定清空所有内容吗？此操作不可撤销。")) clearAll();
              }}
            >
              <IconTrash className="h-3.5 w-3.5" />
              清空
            </Btn>

            <Btn variant="primary" title={PRINT_TIP} onClick={requestExport}>
              <IconDownload className="h-3.5 w-3.5" />
              导出 PDF
            </Btn>
          </>
        )}

        {!onResumeView && (
          <p className="hidden text-[11.5px] text-slate-400 md:block">
            {view === "pool"
              ? "数据来自 ./scripts/shixiseng/run.sh，投递请人工"
              : "想改简历内容，切回「简历编辑」"}
          </p>
        )}
      </div>

      {guideOpen && (
        <PrintGuideDialog
          onCancel={() => setGuideOpen(false)}
          onProceed={() => {
            setGuideOpen(false);
            void exportPdf();
          }}
        />
      )}
    </header>
  );
}
