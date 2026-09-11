/* 通用界面原子：图标按钮与文本按钮 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

export function IconButton({ children, className = "", ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-25 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "ghost" | "outline" | "primary" | "danger";
};

const VARIANTS: Record<string, string> = {
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  outline: "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
  primary: "bg-brand text-white shadow-sm hover:bg-blue-700",
  danger: "text-rose-500 hover:bg-rose-50 hover:text-rose-600",
};

export function Btn({ children, variant = "ghost", className = "", ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
