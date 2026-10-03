/* ============================================================================
 * 弹出层（下拉菜单 / 浮出面板）
 *
 * 渲染到 body 的 portal 里，用 fixed 定位贴着触发元素。
 * 之所以不就地渲染：玻璃面板（顶栏）带 backdrop-filter，会成为子元素的
 * "backdrop root"——就地渲染的下拉菜单只能模糊顶栏自己，透不到页面上。
 * ========================================================================== */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { usePresence } from "./usePresence";

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  align?: "start" | "end";
  side?: "bottom" | "top";
  offset?: number;
  width?: number;
  className?: string;
  children: ReactNode;
}

interface Pos {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export function Popover({
  open,
  onClose,
  anchorRef,
  align = "start",
  side = "bottom",
  offset = 10,
  width,
  className = "",
  children,
}: PopoverProps) {
  const { mounted, state } = usePresence(open, 150);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos>({});

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a) return;
      const p: Pos = {};
      if (side === "bottom") p.top = a.bottom + offset;
      else p.bottom = window.innerHeight - a.top + offset;
      if (align === "start") p.left = Math.max(8, a.left);
      else p.right = Math.max(8, window.innerWidth - a.right);
      setPos(p);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, anchorRef, align, side, offset]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose, anchorRef]);

  if (!mounted) return null;

  const origin = `${side === "bottom" ? "top" : "bottom"} ${align === "start" ? "left" : "right"}`;

  return createPortal(
    <div
      ref={panelRef}
      data-state={state}
      role="menu"
      className={`glass anim-pop no-print fixed z-[70] p-1.5 ${className}`}
      style={{ ...pos, width, transformOrigin: origin, ["--r" as string]: "var(--r-card)" }}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ------------------------------ 菜单项 ------------------------------ */

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  disabled,
  trailing,
  active,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={
        "press flex h-9 w-full items-center gap-2.5 rounded-[12px] px-2.5 text-left text-[13px] disabled:pointer-events-none disabled:opacity-35 " +
        (danger
          ? "text-danger hover:bg-[color-mix(in_srgb,var(--danger)_9%,transparent)]"
          : active
            ? "bg-fill-2 text-fg"
            : "text-fg-2 hover:bg-fill-2 hover:text-fg")
      }
    >
      {icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center opacity-80">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-medium tracking-[0.06em] text-fg-4">{children}</p>
  );
}

export function MenuSep() {
  return <div className="mx-2 my-1.5 h-px bg-hairline" />;
}
