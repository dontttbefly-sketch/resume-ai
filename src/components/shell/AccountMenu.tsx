/* ============================================================================
 * 头像菜单：完成度 / 版本载入 / 外观 / 账号 / 危险区
 * 不常用但需要随手够得到的东西都收在这里
 * ========================================================================== */

import { useMemo, useRef, useState } from "react";

import { buildAiDevResume } from "../../data/privateResume";
import { checkCompletion, asString } from "../../lib/resume";
import { setThemeAnimated } from "../../lib/transitions";
import { useAuthStore } from "../../store/useAuthStore";
import { useResumeStore } from "../../store/useResumeStore";
import { useUiStore, type PaperAccent, type ThemePref } from "../../store/useUiStore";
import { AuthDialog } from "../Auth";
import { IconCloud, IconDoc, IconLayers, IconLogout, IconMonitor, IconMoon, IconSun, IconTrash } from "../icons";
import { confirmDialog } from "../kit/Dialog";
import { Ring } from "../kit/misc";
import { MenuItem, MenuLabel, MenuSep, Popover } from "../kit/Popover";
import { Segmented } from "../kit/Segmented";
import { toast } from "../kit/Toast";

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);

  const sections = useResumeStore((s) => s.sections);
  const visibility = useResumeStore((s) => s.visibility);
  const loadMine = useResumeStore((s) => s.loadMine);
  const loadFull = useResumeStore((s) => s.loadFull);
  const loadAiDev = useResumeStore((s) => s.loadAiDev);
  const loadSample = useResumeStore((s) => s.loadSample);
  const clearAll = useResumeStore((s) => s.clearAll);
  const hasAiDev = useMemo(() => buildAiDevResume() != null, []);

  const theme = useUiStore((s) => s.theme);
  const accent = useUiStore((s) => s.paperAccent);
  const setAccent = useUiStore((s) => s.setPaperAccent);

  const status = useAuthStore((s) => s.status);
  const email = useAuthStore((s) => s.email);
  const signOut = useAuthStore((s) => s.signOut);

  const report = useMemo(() => checkCompletion(sections, visibility), [sections, visibility]);
  const initial = asString(sections.basics?.[0]?.values.name).trim().slice(0, 1) || "我";

  const load = async (label: string, fn: () => void, note = "会覆盖当前档案的全部内容。") => {
    setOpen(false);
    const ok = await confirmDialog({ title: `载入${label}？`, body: note, confirmText: "载入" });
    if (ok) {
      fn();
      toast(`已载入${label}`, "success");
    }
  };

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label="账号与设置"
        onClick={() => setOpen((v) => !v)}
        className="press relative ml-0.5 flex h-9 w-9 items-center justify-center rounded-full"
      >
        <span className="absolute inset-0">
          <Ring value={report.percent / 100} size={36} stroke={2} />
        </span>
        <span className="solid flex h-[26px] w-[26px] items-center justify-center rounded-full text-[12px] font-semibold">
          {initial}
        </span>
        {status === "signed-in" && (
          <span className="absolute -right-px -top-px h-2.5 w-2.5 rounded-full border-2 border-[var(--canvas)] bg-fg" />
        )}
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} align="end" width={296}>
        {/* 完成度 */}
        <div className="flex items-center gap-3 px-2.5 pb-2.5 pt-2">
          <Ring value={report.percent / 100} size={42} stroke={3.5}>
            <span className="tnum text-[11px] font-semibold text-fg">{report.percent}</span>
          </Ring>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-fg">简历完成度</p>
            <p className="mt-0.5 truncate text-[11.5px] text-fg-3">
              {report.missing.length === 0
                ? "必填项都填好了"
                : `还缺 ${report.missing
                    .slice(0, 3)
                    .map((m) => m.label)
                    .join("、")}${report.missing.length > 3 ? " 等" : ""}`}
            </p>
          </div>
        </div>

        <MenuSep />
        <MenuLabel>版本</MenuLabel>
        <MenuItem icon={<IconDoc className="h-4 w-4" />} onClick={() => void load("一页版", loadMine)}>
          载入一页版
        </MenuItem>
        <MenuItem icon={<IconLayers className="h-4 w-4" />} onClick={() => void load("完整版", loadFull)}>
          载入完整版
        </MenuItem>
        {hasAiDev && (
          <MenuItem
            icon={<IconDoc className="h-4 w-4" />}
            onClick={() => void load("AI 开发版", loadAiDev, "会覆盖当前档案，建议先新建一份档案再载入。")}
          >
            载入 AI 开发版
          </MenuItem>
        )}
        <MenuItem icon={<IconDoc className="h-4 w-4" />} onClick={() => void load("示例", loadSample)}>
          载入示例
        </MenuItem>

        <MenuSep />
        <MenuLabel>外观</MenuLabel>
        <div className="space-y-2 px-1.5 pb-1.5">
          <Segmented<ThemePref>
            size="sm"
            className="w-full [&>button]:flex-1"
            value={theme}
            onChange={(t) => {
              const r = anchor.current?.getBoundingClientRect();
              setThemeAnimated(t, r ? r.left + r.width / 2 : undefined, r ? r.top + r.height / 2 : undefined);
            }}
            options={[
              { value: "system", label: "跟随系统", icon: <IconMonitor className="h-3.5 w-3.5" /> },
              { value: "light", label: "浅色", icon: <IconSun className="h-3.5 w-3.5" /> },
              { value: "dark", label: "深色", icon: <IconMoon className="h-3.5 w-3.5" /> },
            ]}
          />
          <Segmented<PaperAccent>
            size="sm"
            className="w-full [&>button]:flex-1"
            value={accent}
            onChange={setAccent}
            options={[
              { value: "blue", label: <>简历 · 经典蓝</>, icon: <span className="h-2 w-2 rounded-full bg-[#2563eb]" /> },
              { value: "ink", label: <>简历 · 墨黑</>, icon: <span className="h-2 w-2 rounded-full bg-[#111]" /> },
            ]}
          />
        </div>

        <MenuSep />
        {status === "signed-in" ? (
          <MenuItem
            icon={<IconLogout className="h-4 w-4" />}
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            trailing={<span className="max-w-[120px] truncate text-[11px] text-fg-4">{email}</span>}
          >
            退出登录
          </MenuItem>
        ) : status === "signed-out" ? (
          <MenuItem
            icon={<IconCloud className="h-4 w-4" />}
            onClick={() => {
              setOpen(false);
              setAuthOpen(true);
            }}
            trailing={<span className="text-[11px] text-fg-4">可选</span>}
          >
            登录并云同步
          </MenuItem>
        ) : null}

        <MenuItem
          icon={<IconTrash className="h-4 w-4" />}
          danger
          onClick={async () => {
            setOpen(false);
            const ok = await confirmDialog({
              title: "清空当前档案？",
              body: "所有内容会被清空，不可恢复。",
              confirmText: "清空",
              danger: true,
            });
            if (ok) clearAll();
          }}
        >
          清空全部内容
        </MenuItem>
      </Popover>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
