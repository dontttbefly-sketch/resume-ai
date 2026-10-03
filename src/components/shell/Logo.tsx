/* 品牌标：墨色超椭圆里一页纸 + 一颗四角星 */

export function Logo() {
  return (
    <span
      className="solid curve flex h-9 w-9 shrink-0 items-center justify-center"
      style={{ ["--r" as string]: "12px" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 20 20" className="h-[19px] w-[19px]" fill="none">
        <path
          d="M10.6 16.5H5.6a.8.8 0 0 1-.8-.8V4.3a.8.8 0 0 1 .8-.8h5.2l3.4 3.4v2.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M7.6 9.2h3.6M7.6 11.8h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path
          d="M14.6 10.8c.28 1.9 1 3.08 3.1 3.7-2.1.62-2.82 1.8-3.1 3.7-.28-1.9-1-3.08-3.1-3.7 2.1-.62 2.82-1.8 3.1-3.7z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
