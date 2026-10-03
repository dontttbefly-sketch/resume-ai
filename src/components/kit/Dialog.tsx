/* ============================================================================
 * 对话框 + 全局确认 / 输入
 *
 * confirmDialog() / promptDialog() 返回 Promise，替代原生 window.confirm /
 * window.prompt —— 原生弹窗样式没法统一，也会打断动效。
 * 由 <DialogHost /> 渲染（挂在 App 根部一次）。
 * ========================================================================== */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";

import { Button } from "./Button";
import { usePresence } from "./usePresence";

export function Dialog({
  open,
  onClose,
  width = 440,
  children,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  const { mounted, state } = usePresence(open, 170);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center p-6">
      <div
        data-state={state}
        className="anim-overlay absolute inset-0 bg-black/20 backdrop-blur-[6px] dark:bg-black/55"
        onClick={onClose}
      />
      <div
        data-state={state}
        role="dialog"
        aria-modal="true"
        className="glass anim-dialog relative max-h-[86vh] w-full overflow-y-auto p-6"
        style={{ maxWidth: width, ["--r" as string]: "var(--r-panel)" }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------ 全局确认 / 输入 ------------------------------ */

interface AskBase {
  title: string;
  body?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface AskState {
  current:
    | (AskBase & { kind: "confirm"; resolve: (v: boolean) => void })
    | (AskBase & { kind: "prompt"; initial: string; placeholder?: string; resolve: (v: string | null) => void })
    | null;
}

const useAsk = create<AskState>()(() => ({ current: null }));

export function confirmDialog(opts: AskBase): Promise<boolean> {
  return new Promise((resolve) => {
    useAsk.setState({ current: { ...opts, kind: "confirm", resolve } });
  });
}

export function promptDialog(opts: AskBase & { initial?: string; placeholder?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    useAsk.setState({ current: { ...opts, initial: opts.initial ?? "", kind: "prompt", resolve } });
  });
}

export function DialogHost() {
  const current = useAsk((s) => s.current);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!current) return;
    setOpen(true);
    if (current.kind === "prompt") setText(current.initial);
    const t = window.setTimeout(() => {
      if (current.kind === "prompt") inputRef.current?.select();
      else confirmRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(t);
  }, [current]);

  const finish = (ok: boolean) => {
    if (!current) return;
    if (current.kind === "confirm") current.resolve(ok);
    else current.resolve(ok ? text.trim() : null);
    setOpen(false);
    window.setTimeout(() => useAsk.setState({ current: null }), 180);
  };

  return (
    <Dialog open={open && !!current} onClose={() => finish(false)} width={400}>
      {current && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            finish(true);
          }}
        >
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-fg">{current.title}</h2>
          {current.body && <div className="mt-2 text-[13px] leading-relaxed text-fg-3">{current.body}</div>}
          {current.kind === "prompt" && (
            <input
              ref={inputRef}
              value={text}
              placeholder={current.placeholder}
              onChange={(e) => setText(e.target.value)}
              className="field mt-4"
            />
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => finish(false)}>
              {current.cancelText ?? "取消"}
            </Button>
            <Button
              ref={confirmRef}
              type="submit"
              variant={current.danger ? "danger" : "primary"}
              size="md"
              className={current.danger ? "!bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]" : ""}
            >
              {current.confirmText ?? "确定"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
