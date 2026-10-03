/* ============================================================================
 * 内联图标：统一 20×20 网格、1.5 线宽、圆头圆角
 * 不引第三方图标库，避免额外依赖与体积
 * ========================================================================== */

import type { ReactNode } from "react";

interface IconProps {
  className?: string;
}

function Svg({ className = "h-4 w-4", children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

/* ------------------------------ 基础 ------------------------------ */

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 4.5v11M4.5 10h11" />
  </Svg>
);

export const IconMinus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 10h11" />
  </Svg>
);

export const IconX = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 10.4l3.6 3.6 7.4-8" />
  </Svg>
);

export const IconChevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 8l4 4 4-4" />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 6l4 4-4 4" />
  </Svg>
);

export const IconArrowUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 15.5v-11M5.5 9L10 4.5 14.5 9" />
  </Svg>
);

export const IconArrowDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 4.5v11M5.5 11l4.5 4.5 4.5-4.5" />
  </Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 5.5h13" />
    <path d="M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" />
    <path d="M5.2 5.5l.7 10a1.5 1.5 0 0 0 1.5 1.4h5.2a1.5 1.5 0 0 0 1.5-1.4l.7-10" />
  </Svg>
);

export const IconPencil = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12.8 3.9l3.3 3.3L7.6 15.7l-4 .7.7-4z" />
    <path d="M11.2 5.5l3.3 3.3" />
  </Svg>
);

export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7" y="7" width="9.5" height="9.5" rx="2.2" />
    <path d="M13 7V5.2A1.7 1.7 0 0 0 11.3 3.5H5.2A1.7 1.7 0 0 0 3.5 5.2v6.1A1.7 1.7 0 0 0 5.2 13H7" />
  </Svg>
);

export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" />
    <circle cx="10" cy="10" r="2.4" />
  </Svg>
);

export const IconEyeOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 3l14 14" />
    <path d="M8.3 4.7A8.3 8.3 0 0 1 10 4.5c5 0 8 5.5 8 5.5a14 14 0 0 1-2.2 2.9M5.7 5.9A13 13 0 0 0 2 10s3 5.5 8 5.5a7.7 7.7 0 0 0 3.6-.9" />
    <path d="M8.3 8.4a2.4 2.4 0 0 0 3.3 3.3" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="5" />
    <path d="M12.8 12.8L16.5 16.5" />
  </Svg>
);

export const IconWarn = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 3.2l7.4 13H2.6z" />
    <path d="M10 8.2v3.6M10 14.2v.01" />
  </Svg>
);

export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 9v4.5M10 6.6v.01" />
  </Svg>
);

export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11.5 3.5h5v5M16.5 3.5L9.5 10.5" />
    <path d="M14.5 11.5v3.3a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7V7.2a1.7 1.7 0 0 1 1.7-1.7h3.3" />
  </Svg>
);

export const IconRefresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16 4.5v4h-4" />
    <path d="M15.6 8.5A6 6 0 1 0 16 11.5" />
  </Svg>
);

export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 13V3.5M6 7.5l4-4 4 4" />
    <path d="M3.5 13v1.8a1.7 1.7 0 0 0 1.7 1.7h9.6a1.7 1.7 0 0 0 1.7-1.7V13" />
  </Svg>
);

export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 3.5V13M6 9l4 4 4-4" />
    <path d="M3.5 13v1.8a1.7 1.7 0 0 0 1.7 1.7h9.6a1.7 1.7 0 0 0 1.7-1.7V13" />
  </Svg>
);

export const IconFilter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 5h13M6 10h8M8.5 15h3" />
  </Svg>
);

export const IconSliders = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h7M15 6h1M4 14h1M9 14h7" />
    <circle cx="13" cy="6" r="1.8" />
    <circle cx="7" cy="14" r="1.8" />
  </Svg>
);

export const IconGrip = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 5v.01M12.5 5v.01M7.5 10v.01M12.5 10v.01M7.5 15v.01M12.5 15v.01" strokeWidth={2} />
  </Svg>
);

export const IconImage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3.5" width="14" height="13" rx="2.6" />
    <circle cx="7.6" cy="8" r="1.4" />
    <path d="M16.6 13l-3.8-3.6-7.6 7" />
  </Svg>
);

export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 6.2V10l2.6 1.6" />
  </Svg>
);

export const IconKey = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="7" cy="12.5" r="3.2" />
    <path d="M9.3 10.2l6.2-6.2M13.6 5.9l1.8 1.8M11.8 7.7l1.4 1.4" />
  </Svg>
);

export const IconLogout = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 16.5H5.2a1.7 1.7 0 0 1-1.7-1.7V5.2a1.7 1.7 0 0 1 1.7-1.7H8" />
    <path d="M12.5 13.5L16 10l-3.5-3.5M16 10H8" />
  </Svg>
);

export const IconCloud = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 15.5h8.2a3.3 3.3 0 0 0 .4-6.6 4.8 4.8 0 0 0-9.2 1.2A2.7 2.7 0 0 0 6 15.5z" />
  </Svg>
);

/* ------------------------------ 界面 ------------------------------ */

export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="3.2" />
    <path d="M10 2.5v1.6M10 15.9v1.6M2.5 10h1.6M15.9 10h1.6M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M4.7 15.3l1.1-1.1M14.2 5.8l1.1-1.1" />
  </Svg>
);

export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16 12.3A6.5 6.5 0 0 1 7.7 4a6.5 6.5 0 1 0 8.3 8.3z" />
  </Svg>
);

export const IconMonitor = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.8" y="3.5" width="14.4" height="10" rx="2.2" />
    <path d="M7.5 16.5h5M10 13.5v3" />
  </Svg>
);

export const IconSidebar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.8" y="3.5" width="14.4" height="13" rx="2.6" />
    <path d="M7.8 3.5v13" />
  </Svg>
);

export const IconFit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 7.5v-4h4M16.5 7.5v-4h-4M3.5 12.5v4h4M16.5 12.5v4h-4" />
  </Svg>
);

export const IconLocate = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="4.5" />
    <path d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3" />
  </Svg>
);

export const IconPalette = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 3a7 7 0 0 0 0 14c1 0 1.6-.7 1.6-1.5 0-1-.8-1.4-.8-2.3 0-.9.7-1.5 1.6-1.5H14a3 3 0 0 0 3-3C17 5.6 13.9 3 10 3z" />
    <circle cx="6.6" cy="9.4" r=".9" fill="currentColor" stroke="none" />
    <circle cx="9.2" cy="6.3" r=".9" fill="currentColor" stroke="none" />
    <circle cx="12.9" cy="6.9" r=".9" fill="currentColor" stroke="none" />
  </Svg>
);

/* ------------------------------ 业务 ------------------------------ */

/** AI：四角星 */
export const IconSpark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 2.8c.5 3.6 1.9 6 5.9 7.2-4 1.2-5.4 3.6-5.9 7.2-.5-3.6-1.9-6-5.9-7.2 4-1.2 5.4-3.6 5.9-7.2z" />
  </Svg>
);

export const IconSend = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 15.5V4.8M5.5 9.2L10 4.6l4.5 4.6" strokeWidth={1.8} />
  </Svg>
);

/** 简历：带折角的纸 */
export const IconDoc = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3.5h6.5L15 7v8.8a.7.7 0 0 1-.7.7H5.7a.7.7 0 0 1-.7-.7V4.2a.7.7 0 0 1 .7-.7z" />
    <path d="M11.5 3.5V7H15M7.5 10.5h5M7.5 13h3.5" />
  </Svg>
);

/** 岗位匹配：靶心 */
export const IconTarget = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7" />
    <circle cx="10" cy="10" r="3.6" />
    <circle cx="10" cy="10" r=".6" fill="currentColor" />
  </Svg>
);

/** 投递：纸飞机 */
export const IconPlane = (p: IconProps) => (
  <Svg {...p}>
    <path d="M17 3L3.2 8.6l5.4 2.2L17 3zM17 3l-4.4 13.7-4-5.9" />
  </Svg>
);

/** 经历库：书 */
export const IconBook = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 5.5C8.6 4.4 6.6 4 3.5 4v11c3.1 0 5.1.4 6.5 1.5 1.4-1.1 3.4-1.5 6.5-1.5V4c-3.1 0-5.1.4-6.5 1.5z" />
    <path d="M10 5.5v11" />
  </Svg>
);

export const IconSuitcase = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="14" height="10.5" rx="2.4" />
    <path d="M7.5 6V4.7A1.2 1.2 0 0 1 8.7 3.5h2.6a1.2 1.2 0 0 1 1.2 1.2V6M3 10.5h14" />
  </Svg>
);

export const IconLayers = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 3.5l7 3.7-7 3.7-7-3.7z" />
    <path d="M3 10.6l7 3.7 7-3.7" />
  </Svg>
);

export const IconPlay = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 4.6v10.8a.6.6 0 0 0 .9.5l8.6-5.4a.6.6 0 0 0 0-1L7.4 4.1a.6.6 0 0 0-.9.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconPause = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5.5" y="4.5" width="3" height="11" rx="1" fill="currentColor" stroke="none" />
    <rect x="11.5" y="4.5" width="3" height="11" rx="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconSkip = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 5l6 5-6 5zM11 5l6 5-6 5z" />
  </Svg>
);

export const IconBolt = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11 2.8L4.8 11h4.6L9 17.2 15.2 9h-4.6z" />
  </Svg>
);

export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="7" r="3.2" />
    <path d="M3.8 16.5c.8-3 3.3-4.7 6.2-4.7s5.4 1.7 6.2 4.7" />
  </Svg>
);

export const IconQr = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="5" height="5" rx="1" />
    <rect x="11.5" y="3.5" width="5" height="5" rx="1" />
    <rect x="3.5" y="11.5" width="5" height="5" rx="1" />
    <path d="M11.5 11.5h2v2M16.5 11.5v.01M11.5 16.5h5v-2.5" />
  </Svg>
);
