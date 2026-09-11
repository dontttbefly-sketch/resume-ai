/* 内联图标：不引第三方图标库，避免额外依赖与体积 */

import type { ReactNode } from "react";

interface IconProps {
  className?: string;
}

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3.2v9.6M3.2 8h9.6" />
  </Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.6 4.4h10.8" />
    <path d="M6.2 4.4V3a.6.6 0 0 1 .6-.6h2.4a.6.6 0 0 1 .6.6v1.4" />
    <path d="M4.3 4.4l.6 8.4a.6.6 0 0 0 .6.6h5a.6.6 0 0 0 .6-.6l.6-8.4" />
  </Svg>
);

export const IconArrowUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 12.6V3.4" />
    <path d="M4.4 7L8 3.4 11.6 7" />
  </Svg>
);

export const IconArrowDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3.4v9.2" />
    <path d="M4.4 9L8 12.6 11.6 9" />
  </Svg>
);

export const IconChevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6.2l4 4 4-4" />
  </Svg>
);

export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M1.5 8S3.9 4.2 8 4.2 14.5 8 14.5 8 12.1 11.8 8 11.8 1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="1.9" />
  </Svg>
);

export const IconEyeOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.4 4.5A6.6 6.6 0 0 1 8 4.2c4.1 0 6.5 3.8 6.5 3.8a12 12 0 0 1-2 2.5" />
    <path d="M4.2 5.6A11.7 11.7 0 0 0 1.5 8S3.9 11.8 8 11.8a6.7 6.7 0 0 0 2.4-.45" />
    <path d="M6.9 6.9a1.9 1.9 0 0 0 2.6 2.6" />
    <path d="M2.6 2.6l10.8 10.8" />
  </Svg>
);

export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2.4v7.8" />
    <path d="M4.8 7L8 10.2 11.2 7" />
    <path d="M2.6 13.2h10.8" />
  </Svg>
);

export const IconReset = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.6 8a5.4 5.4 0 1 0 1.7-3.9" />
    <path d="M2.4 3.2v3h3" />
  </Svg>
);

export const IconDoc = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.2 1.8H4.6a1 1 0 0 0-1 1v10.4a1 1 0 0 0 1 1h6.8a1 1 0 0 0 1-1V5z" />
    <path d="M9.2 1.8V5h3.2" />
    <path d="M6 8.6h4M6 10.8h3" />
  </Svg>
);

/* 三张叠起来的纸：一排更全的历史版本 */
export const IconLayers = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 1.9l5.6 2.9L8 7.7 2.4 4.8z" />
    <path d="M2.6 8.1L8 10.9l5.4-2.8" />
    <path d="M2.6 11.1L8 13.9l5.4-2.8" />
  </Svg>
);

export const IconWarn = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2.6l5.9 10.2H2.1z" />
    <path d="M8 6.4v3.1" />
    <circle cx="8" cy="11.4" r="0.5" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.2 8.4l3.1 3.1 6.5-7" />
  </Svg>
);

export const IconTarget = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.6" />
    <circle cx="8" cy="8" r="2.3" />
    <circle cx="8" cy="8" r="0.5" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconSpark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2.2l1.5 4.3 4.3 1.5-4.3 1.5L8 13.8l-1.5-4.3L2.2 8l4.3-1.5z" />
  </Svg>
);

export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5.8" y="5.8" width="7.6" height="7.6" rx="1.4" />
    <path d="M10.2 5.8V4.2a1.4 1.4 0 0 0-1.4-1.4H4.2a1.4 1.4 0 0 0-1.4 1.4v4.6a1.4 1.4 0 0 0 1.4 1.4h1.6" />
  </Svg>
);

export const IconKey = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5.4" cy="10.6" r="2.6" />
    <path d="M7.4 8.6l5.8-5.8" />
    <path d="M11 5l1.6 1.6" />
    <path d="M9.4 6.6L11 8.2" />
  </Svg>
);

/* 岗位池：一个公文包 */
export const IconSuitcase = (p: IconProps) => (
  <Svg {...p}>
    <rect x="1.9" y="5.4" width="12.2" height="7.6" rx="1.6" />
    <path d="M6 5.4V4.2a1.4 1.4 0 0 1 1.4-1.4h1.2A1.4 1.4 0 0 1 10 4.2v1.2" />
    <path d="M1.9 8.8h12.2" />
  </Svg>
);

/* 跳去站外 */
export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.6 2.6h3.8v3.8" />
    <path d="M13.4 2.6L7.6 8.4" />
    <path d="M11.6 9.4v2.8a1.4 1.4 0 0 1-1.4 1.4H4.2a1.4 1.4 0 0 1-1.4-1.4V6.2a1.4 1.4 0 0 1 1.4-1.4h2.8" />
  </Svg>
);

/* 漏斗 */
export const IconFilter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.4 3.4h11.2L9.4 8.2v4.2l-2.8 1.4V8.2z" />
  </Svg>
);

/* 从文件读入 */
export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 10.6V2.8" />
    <path d="M5.2 5.4L8 2.6l2.8 2.8" />
    <path d="M2.8 10.4v1.6a1.4 1.4 0 0 0 1.4 1.4h7.6a1.4 1.4 0 0 0 1.4-1.4v-1.6" />
  </Svg>
);

/* 刷新 / 重新读快照 */
export const IconRefresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.4 8a5.4 5.4 0 1 1-1.7-3.9" />
    <path d="M13.6 2.6v3.2h-3.2" />
  </Svg>
);

/* 铅笔（重命名） */
export const IconPencil = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11.2 2.8l2 2L6 12l-2.8.8L4 10z" />
    <path d="M9.8 4.2l2 2" />
  </Svg>
);
