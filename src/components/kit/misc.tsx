/* 小部件：开关、加载、数字滚动、进度环、状态点、空状态 */

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="switch disabled:opacity-40"
    />
  );
}

export function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`spin ${className}`} aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
      <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ShimmerText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`shimmer-text ${className}`}>{children}</span>;
}

/** 数字滚动到目标值（只在值变化时跑一小段 rAF）；format 默认是千分位 */
export function NumberTicker({
  value,
  duration = 900,
  className = "",
  format = (n: number) => n.toLocaleString("zh-CN"),
}: {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      fromRef.current = value;
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = value;
    };
  }, [value, duration]);

  return <span className={`tnum ${className}`}>{format(shown)}</span>;
}

/** 细线进度环（单色） */
export function Ring({
  value,
  size = 88,
  stroke = 5,
  children,
  className = "",
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--fg)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 900ms var(--ease-out-quint)" }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  );
}

/** 状态点：live 时外圈有脉冲 */
export function StatusDot({ tone, live }: { tone: "on" | "off" | "warn"; live?: boolean }) {
  const color = tone === "on" ? "bg-fg" : tone === "warn" ? "bg-danger" : "bg-fg-4";
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {live && <span className={`ping absolute inset-0 rounded-full ${color}`} />}
      <span className={`relative h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`anim-rise flex flex-col items-center justify-center text-center ${className}`}>
      {icon && (
        <span className="surface curve mb-5 flex h-14 w-14 items-center justify-center text-fg-3" style={{ ["--r" as string]: "20px" }}>
          {icon}
        </span>
      )}
      <p className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</p>
      {children && <div className="mt-2 max-w-[420px] text-[13px] leading-relaxed text-fg-3">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** 页面级小标题：灰色小字 + 细线 */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-medium tracking-[0.08em] text-fg-4 ${className}`}>{children}</p>;
}
