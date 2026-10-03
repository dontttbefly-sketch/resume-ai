/* ============================================================================
 * 分段控件：选中态是一块会「滑过去」的浮起滑块
 *
 * 滑块位置靠测量当前项的 offsetLeft / offsetWidth，第一次测量前不加过渡，
 * 避免挂载时从 0 滑进来。
 * ========================================================================== */

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  title?: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegOption<T>[];
  size?: "sm" | "md";
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const el = wrap.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`);
      if (!el) return;
      setThumb({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    // 字体加载完宽度会变
    document.fonts?.ready.then(measure).catch(() => {});
    const t = requestAnimationFrame(() => setReady(true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(t);
    };
  }, [value]);

  const itemCls = size === "sm" ? "h-7 px-3 text-[12px]" : "h-8 px-3.5 text-[13px]";

  return (
    <div ref={wrapRef} role="tablist" className={`seg well ${className}`}>
      {thumb && (
        <span
          aria-hidden
          className="seg-thumb"
          style={{
            width: thumb.w,
            transform: `translateX(${thumb.x - 3}px)`,
            left: 3,
            transition: ready ? undefined : "none",
          }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          data-value={o.value}
          aria-selected={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`seg-item ${itemCls}`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
