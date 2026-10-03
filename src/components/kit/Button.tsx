/* 按钮与图标按钮。样式在 styles/controls.css */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "sm", pill, icon, className = "", children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`btn btn-${size} btn-${variant} ${pill ? "btn-pill" : ""} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 无障碍名称，同时作为悬停提示 */
  label: string;
  size?: ButtonSize;
  active?: boolean;
  /** 提示气泡出现在上方（底部浮条里的按钮用） */
  tipTop?: boolean;
  /** 不显示悬停提示（菜单里等已有文字的场合） */
  noTip?: boolean;
  pill?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "sm", active, tipTop, noTip, pill, className = "", children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      data-tip={noTip ? undefined : label}
      data-tip-pos={tipTop ? "top" : undefined}
      data-active={active ? "true" : undefined}
      className={`btn icon-btn btn-${size} ${pill ? "btn-pill" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
