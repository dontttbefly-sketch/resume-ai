/* ============================================================================
 * 顶栏：悬浮的玻璃胶囊
 *
 *   左：品牌标 + 档案名            中：四个视图（站长多一个「用户」）     右：视图动作 · AI 额度 · 主题 · 头像
 *
 * 简历在它下面滚过时会被模糊，这是整页「毛玻璃」质感的主要来源。
 * ========================================================================== */

import { useAccount } from "../../lib/account";
import { exportPdf } from "../../lib/print";
import { requestExport, useExportFlow } from "../../lib/exportFlow";
import { setThemeAnimated, switchView } from "../../lib/transitions";
import { useBossStore } from "../../store/useBossStore";
import { useSelectionStore } from "../../store/useSelectionStore";
import { resolveTheme, useUiStore, type AppView } from "../../store/useUiStore";
import { PrintGuideDialog } from "../PrintGuide";
import { IconBook, IconDoc, IconDownload, IconMoon, IconPlane, IconSpark, IconSun, IconTarget, IconUser } from "../icons";
import { Button, IconButton } from "../kit/Button";
import { Segmented } from "../kit/Segmented";
import { useSpotlight } from "../kit/useSpotlight";
import { QuotaPill } from "../account/QuotaPill";
import { AccountMenu } from "./AccountMenu";
import { Logo } from "./Logo";
import { ProfileMenu } from "./ProfileMenu";

function NavLabel({ children, live }: { children: string; live?: boolean }) {
  return (
    <span className="relative hidden md:inline">
      {children}
      {live && <span className="breathe absolute -right-2 -top-0.5 h-1.5 w-1.5 rounded-full bg-fg" />}
    </span>
  );
}

function ThemeButton() {
  const theme = useUiStore((s) => s.theme);
  const dark = resolveTheme(theme) === "dark";
  return (
    <IconButton
      label={dark ? "切换到浅色" : "切换到深色"}
      size="md"
      pill
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setThemeAnimated(dark ? "light" : "dark", r.left + r.width / 2, r.top + r.height / 2);
      }}
    >
      {dark ? <IconSun className="h-[18px] w-[18px]" /> : <IconMoon className="h-[17px] w-[17px]" />}
    </IconButton>
  );
}

function StudioActions() {
  const panelOpen = useSelectionStore((s) => s.panelOpen);
  const openPanel = useSelectionStore((s) => s.open);
  const closePanel = useSelectionStore((s) => s.close);

  return (
    <div className="anim-fade flex items-center gap-1.5">
      <Button
        size="md"
        pill
        variant={panelOpen ? "primary" : "secondary"}
        icon={<IconSpark className="h-4 w-4" />}
        onClick={() => (panelOpen ? closePanel() : openPanel())}
        title="AI 简历顾问（⌘K）"
      >
        <span className="hidden lg:inline">AI 顾问</span>
      </Button>
      <Button
        size="md"
        pill
        variant="primary"
        icon={<IconDownload className="h-4 w-4" />}
        onClick={requestExport}
        title="导出 PDF（⌘P）"
      >
        <span className="hidden sm:inline">导出 PDF</span>
      </Button>
    </div>
  );
}

export function TopBar() {
  const view = useUiStore((s) => s.view);
  const autopilot = useBossStore((s) => s.auto.running);
  const guideOpen = useExportFlow((s) => s.guideOpen);
  const setGuideOpen = useExportFlow((s) => s.setGuideOpen);
  const spot = useSpotlight<HTMLElement>();
  const isOwner = useAccount((s) => s.me?.role === "owner");

  return (
    <header
      ref={spot}
      className="glass spot no-print vt-topbar fixed inset-x-3 top-3 z-50 flex h-14 items-center gap-2 px-2.5"
      style={{ ["--r" as string]: "var(--r-card)" }}
    >
      <div className="flex min-w-0 flex-1 basis-0 items-center gap-1">
        <Logo />
        <ProfileMenu />
      </div>

      <Segmented<AppView>
        value={view}
        onChange={switchView}
        options={[
          { value: "studio", label: <NavLabel>简历</NavLabel>, icon: <IconDoc className="h-4 w-4" />, title: "简历" },
          { value: "match", label: <NavLabel>岗位</NavLabel>, icon: <IconTarget className="h-4 w-4" />, title: "岗位匹配" },
          {
            value: "deliver",
            label: <NavLabel live={autopilot}>投递</NavLabel>,
            icon: <IconPlane className="h-4 w-4" />,
            title: "BOSS 投递",
          },
          { value: "library", label: <NavLabel>经历</NavLabel>, icon: <IconBook className="h-4 w-4" />, title: "经历库" },
          ...(isOwner
            ? [{ value: "admin" as const, label: <NavLabel>用户</NavLabel>, icon: <IconUser className="h-4 w-4" />, title: "用户管理" }]
            : []),
        ]}
      />

      <div className="flex flex-1 basis-0 items-center justify-end gap-1.5">
        {view === "studio" && <StudioActions />}
        <QuotaPill />
        <ThemeButton />
        <AccountMenu />
      </div>

      <PrintGuideDialog
        open={guideOpen}
        onCancel={() => setGuideOpen(false)}
        onProceed={() => {
          setGuideOpen(false);
          void exportPdf();
        }}
      />
    </header>
  );
}
