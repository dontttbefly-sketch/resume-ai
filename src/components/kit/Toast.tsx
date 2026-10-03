/* ============================================================================
 * 轻提示：底部居中的玻璃胶囊，2.4 秒后自动收起
 * ========================================================================== */

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";

import { IconCheck, IconWarn } from "../icons";

interface ToastItem {
  id: number;
  text: ReactNode;
  tone: "default" | "success" | "error";
  leaving?: boolean;
}

interface ToastState {
  items: ToastItem[];
}

const useToasts = create<ToastState>()(() => ({ items: [] }));
let seq = 0;

export function toast(text: ReactNode, tone: ToastItem["tone"] = "default", ms = 2400): void {
  const id = ++seq;
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), { id, text, tone }] }));
  window.setTimeout(() => {
    useToasts.setState((s) => ({ items: s.items.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }));
    window.setTimeout(() => {
      useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, 200);
  }, ms);
}

export function Toaster() {
  const items = useToasts((s) => s.items);

  useEffect(() => () => useToasts.setState({ items: [] }), []);

  return createPortal(
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex flex-col items-center gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="glass flex h-10 items-center gap-2 px-4 text-[13px] font-medium text-fg"
          style={{
            ["--r" as string]: "999px",
            animation: t.leaving
              ? "fade-out 180ms ease-in both"
              : "toast-in var(--spring-dur) var(--spring) both",
          }}
        >
          {t.tone === "success" && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-solid text-on-solid">
              <IconCheck className="h-3 w-3" />
            </span>
          )}
          {t.tone === "error" && <IconWarn className="h-4 w-4 text-danger" />}
          {t.text}
        </div>
      ))}
    </div>,
    document.body,
  );
}
