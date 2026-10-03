/* ============================================================================
 * 输入控件
 *   GhostInput / AutoTextarea：平时就是一段字，悬停/聚焦才露出输入框
 *   ChipsInput：回车或逗号成标签（城市、希望投 / 不投）
 * ========================================================================== */

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { IconX } from "../icons";

export function GhostInput({
  value,
  onChange,
  placeholder,
  className = "",
  onKeyDown,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`ghost ${className}`}
    />
  );
}

/** 随内容自动撑高的多行输入。variant = ghost（默认）或 field */
export function AutoTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  variant = "ghost",
  minRows = 1,
  onKeyDown,
  taRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  variant?: "ghost" | "field";
  minRows?: number;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  taRef?: (el: HTMLTextAreaElement | null) => void;
}) {
  const inner = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={(el) => {
        inner.current = el;
        taRef?.(el);
      }}
      rows={minRows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`${variant} ${variant === "field" ? "!resize-none overflow-hidden" : ""} ${className}`}
    />
  );
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="field-label flex items-baseline gap-2">
      {children}
      {hint && <span className="font-normal tracking-normal text-fg-4">{hint}</span>}
    </span>
  );
}

export function ChipsInput({
  values,
  onChange,
  placeholder,
  tone = "default",
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  tone?: "default" | "outline";
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const parts = draft
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !values.includes(s));
    if (parts.length) onChange([...values, ...parts]);
    setDraft("");
  };

  return (
    <div className="field flex min-h-[42px] flex-wrap items-center gap-1.5 !py-2">
      {values.map((v) => (
        <span key={v} className={`chip ${tone === "outline" ? "chip-outline" : ""} anim-fade gap-1 !pr-1`}>
          {v}
          <button
            type="button"
            aria-label={`移除 ${v}`}
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="flex h-4 w-4 items-center justify-center rounded-full text-fg-4 transition-colors hover:bg-fill-3 hover:text-fg"
          >
            <IconX className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={values.length ? "" : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === "，") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        className="min-w-[90px] flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-4"
      />
    </div>
  );
}
