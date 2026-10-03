/* 档案切换：名字即档案（文档标题风格），下拉里新建 / 复制 / 重命名 / 删除 */

import { useRef, useState } from "react";

import { MAX_PROFILES, useResumeStore } from "../../store/useResumeStore";
import { IconCheck, IconChevron, IconCopy, IconPencil, IconPlus, IconTrash } from "../icons";
import { confirmDialog, promptDialog } from "../kit/Dialog";
import { MenuItem, MenuLabel, MenuSep, Popover } from "../kit/Popover";
import { toast } from "../kit/Toast";

export function ProfileMenu() {
  const profiles = useResumeStore((s) => s.profiles);
  const activeId = useResumeStore((s) => s.activeId);
  const createProfile = useResumeStore((s) => s.createProfile);
  const duplicateProfile = useResumeStore((s) => s.duplicateProfile);
  const renameProfile = useResumeStore((s) => s.renameProfile);
  const deleteProfile = useResumeStore((s) => s.deleteProfile);
  const switchProfile = useResumeStore((s) => s.switchProfile);

  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const full = profiles.length >= MAX_PROFILES;
  const last = profiles.length <= 1;
  const active = profiles.find((p) => p.id === activeId);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="press flex h-9 min-w-0 items-center gap-1.5 rounded-[12px] px-2.5 text-[14px] font-semibold tracking-[-0.01em] text-fg hover:bg-fill-2"
      >
        <span className="truncate">{active?.name ?? "简历"}</span>
        <IconChevron
          className={`h-3.5 w-3.5 shrink-0 text-fg-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} width={248}>
        <MenuLabel>
          简历档案 · {profiles.length}/{MAX_PROFILES}
        </MenuLabel>
        {profiles.map((p) => (
          <MenuItem
            key={p.id}
            active={p.id === activeId}
            onClick={() => {
              switchProfile(p.id);
              setOpen(false);
            }}
            trailing={p.id === activeId ? <IconCheck className="h-3.5 w-3.5 text-fg" /> : null}
          >
            {p.name}
          </MenuItem>
        ))}
        <MenuSep />
        <MenuItem
          icon={<IconPlus className="h-4 w-4" />}
          disabled={full}
          onClick={async () => {
            setOpen(false);
            const ok = await confirmDialog({
              title: "新建一份空白简历？",
              body: "当前内容会保留在原档案里，随时可以切回来。",
              confirmText: "新建",
            });
            if (ok && createProfile()) toast("已新建并切换", "success");
          }}
        >
          新建简历
        </MenuItem>
        <MenuItem
          icon={<IconCopy className="h-4 w-4" />}
          disabled={full}
          onClick={() => {
            setOpen(false);
            if (duplicateProfile()) toast("已复制为新档案", "success");
          }}
        >
          复制当前
        </MenuItem>
        <MenuItem
          icon={<IconPencil className="h-4 w-4" />}
          onClick={async () => {
            setOpen(false);
            const name = await promptDialog({ title: "重命名档案", initial: active?.name ?? "", confirmText: "保存" });
            if (name) renameProfile(name);
          }}
        >
          重命名
        </MenuItem>
        <MenuItem
          icon={<IconTrash className="h-4 w-4" />}
          danger
          disabled={last}
          onClick={async () => {
            setOpen(false);
            const ok = await confirmDialog({
              title: `删除「${active?.name}」？`,
              body: "这份简历的全部内容会一起删掉，不可恢复。",
              confirmText: "删除",
              danger: true,
            });
            if (ok) deleteProfile();
          }}
        >
          删除
        </MenuItem>
      </Popover>
    </>
  );
}
