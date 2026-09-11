/* ============================================================================
 * 字段控件
 *
 * 按描述符里的 control 决定渲染哪种输入框。这里不认识任何业务字段名，
 * 因此新增模块时这个文件不需要改。
 * ========================================================================== */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

import type { FieldDescriptor, FieldValue } from "../data/schema";
import type { SectionKey } from "../data/sections";
import { asList, asString } from "../lib/resume";
import { useResumeStore } from "../store/useResumeStore";
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from "./icons";
import { IconButton } from "./ui";

const INPUT = [
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5",
  "text-[13px] leading-5 text-slate-800 placeholder:text-slate-300",
  "outline-none transition hover:border-slate-300",
  "focus:border-brand focus:ring-2 focus:ring-blue-100",
].join(" ");

/* ------------------------- 自动撑高的多行输入框 ------------------------- */

function AutoTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className = "",
  taRef,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  taRef?: (el: HTMLTextAreaElement | null) => void;
  name?: string;
}) {
  const inner = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "auto";
    // +2 补偿上下各 1px 边框（全局是 border-box）
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  return (
    <textarea
      ref={(el) => {
        inner.current = el;
        taRef?.(el);
      }}
      name={name}
      autoComplete="off"
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`${INPUT} resize-none overflow-hidden ${className}`}
    />
  );
}

/* ----------------------------- 要点列表 ----------------------------- */

function BulletList({
  section,
  entryId,
  fieldKey,
  items,
  placeholder,
}: {
  section: SectionKey;
  entryId: string;
  fieldKey: string;
  items: string[];
  placeholder?: string;
}) {
  const addBullet = useResumeStore((s) => s.addBullet);
  const setBullet = useResumeStore((s) => s.setBullet);
  const removeBullet = useResumeStore((s) => s.removeBullet);
  const moveBullet = useResumeStore((s) => s.moveBullet);

  const refs = useRef<Array<HTMLTextAreaElement | null>>([]);
  const [focusAt, setFocusAt] = useState<number | null>(null);

  useEffect(() => {
    if (focusAt === null) return;
    const el = refs.current[focusAt];
    if (el) {
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
    setFocusAt(null);
  }, [focusAt, items.length]);

  const list = items.length > 0 ? items : [""];

  return (
    <div className="space-y-1">
      {list.map((text, i) => (
        <div key={i} className="group flex items-start gap-1">
          <span className="mt-[11px] block h-[3px] w-[3px] shrink-0 rounded-full bg-slate-400" />

          <AutoTextarea
            value={text}
            placeholder={placeholder}
            className="flex-1"
            name={`${fieldKey}-${i}`}
            taRef={(el) => {
              refs.current[i] = el;
            }}
            onChange={(v) => setBullet(section, entryId, fieldKey, i, v)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              e.preventDefault();
              if (text.trim() === "") {
                // 空内容回车 → 删除本条（至少保留一条）
                if (list.length > 1) {
                  removeBullet(section, entryId, fieldKey, i);
                  setFocusAt(Math.max(0, i - 1));
                }
              } else {
                // 有内容回车 → 在下方新增一条并聚焦
                addBullet(section, entryId, fieldKey, i);
                setFocusAt(i + 1);
              }
            }}
          />

          <div className="flex shrink-0 items-center pt-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
            <IconButton
              title="上移"
              disabled={i === 0}
              onClick={() => moveBullet(section, entryId, fieldKey, i, -1)}
            >
              <IconArrowUp className="h-3 w-3" />
            </IconButton>
            <IconButton
              title="下移"
              disabled={i === list.length - 1}
              onClick={() => moveBullet(section, entryId, fieldKey, i, 1)}
            >
              <IconArrowDown className="h-3 w-3" />
            </IconButton>
            <IconButton
              title="删除本条"
              disabled={list.length <= 1}
              onClick={() => removeBullet(section, entryId, fieldKey, i)}
            >
              <IconTrash className="h-3 w-3" />
            </IconButton>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => {
          addBullet(section, entryId, fieldKey, list.length - 1);
          setFocusAt(list.length);
        }}
        className="ml-2 mt-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <IconPlus className="h-3 w-3" />
        添加一条要点
      </button>
    </div>
  );
}

/* ------------------------------ 图片 ------------------------------ */

const SMALL_BTN = [
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1",
  "text-[11.5px] font-medium text-slate-700 transition",
  "hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50",
].join(" ");

/** 居中裁成正方形并压缩，避免证件照把 localStorage 撑爆 */
function fileToSquareDataUrl(file: File, maxEdge = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        if (side === 0) throw new Error("图片尺寸异常");

        const out = Math.min(maxEdge, side);
        const canvas = document.createElement("canvas");
        canvas.width = out;
        canvas.height = out;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("当前浏览器不支持图片处理");

        ctx.drawImage(
          img,
          (img.naturalWidth - side) / 2,
          (img.naturalHeight - side) / 2,
          side,
          side,
          0,
          0,
          out,
          out,
        );
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("图片处理失败"));
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败，换一张试试"));
    };

    img.src = url;
  });
}

function ImageField({
  value,
  onChange,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-start gap-2">
      <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10.5px] text-slate-400">未设置</span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={SMALL_BTN}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "处理中…" : value ? "更换图片" : "选择图片"}
          </button>
          {value && (
            <button
              type="button"
              className={SMALL_BTN}
              onClick={() => {
                onChange("");
                setError(null);
              }}
            >
              移除
            </button>
          )}
        </div>

        {error ? (
          <p className="text-[10.5px] leading-4 text-rose-500">{error}</p>
        ) : (
          <p className="text-[10.5px] leading-4 text-slate-400">
            {hint ?? "会自动裁成正方形并压缩。"}
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setError(null);
          fileToSquareDataUrl(file)
            .then(onChange)
            .catch((ex: unknown) =>
              setError(ex instanceof Error ? ex.message : "图片处理失败"),
            )
            .finally(() => setBusy(false));
        }}
      />
    </div>
  );
}

/* ------------------------------ 字段本体 ------------------------------ */

export function FieldInput({
  section,
  entryId,
  field,
  value,
  onChange,
}: {
  section: SectionKey;
  entryId: string;
  field: FieldDescriptor;
  value: FieldValue | undefined;
  onChange: (v: FieldValue) => void;
}) {
  let control: ReactNode;

  switch (field.control) {
    case "bullets":
      control = (
        <BulletList
          section={section}
          entryId={entryId}
          fieldKey={field.key}
          items={asList(value)}
          placeholder={field.placeholder}
        />
      );
      break;

    case "image":
      control = (
        <ImageField
          value={asString(value)}
          hint={field.hint}
          onChange={(v) => onChange(v)}
        />
      );
      break;

    case "textarea":
      control = (
        <AutoTextarea
          value={asString(value)}
          placeholder={field.placeholder}
          name={field.key}
          onChange={(v) => onChange(v)}
        />
      );
      break;

    case "month":
    case "tags":
    case "text":
    default:
      control = (
        <input
          type="text"
          value={asString(value)}
          placeholder={field.placeholder}
          name={field.key}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
        />
      );
      break;
  }

  return (
    <div className={field.colSpan === 2 ? "col-span-2" : "col-span-1"}>
      <label className="mb-1 block text-[11px] font-medium text-slate-500">
        {field.label}
        {field.required && <span className="ml-0.5 text-rose-400">*</span>}
      </label>
      {control}
      {/* 图片控件的提示由 ImageField 自己渲染（出错时要顶掉提示），这里不重复渲染 */}
      {field.hint && field.control !== "image" && (
        <p className="mt-1 text-[10.5px] leading-4 text-slate-400">{field.hint}</p>
      )}
    </div>
  );
}
