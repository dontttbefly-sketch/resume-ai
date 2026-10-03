/* 顶部四块指标：今日 / 累计 / 判否 / 当前位置 */

import type { ReactNode } from "react";

import { DAILY_CAP, useBossStore } from "../../store/useBossStore";
import { NumberTicker } from "../kit/misc";
import { useSpotlight } from "../kit/useSpotlight";

function Tile({ label, children, foot, i }: { label: string; children: ReactNode; foot?: ReactNode; i: number }) {
  const spot = useSpotlight<HTMLDivElement>();
  return (
    <div ref={spot} className="glass spot flex min-h-[132px] flex-col p-5" style={{ ["--r" as string]: "var(--r-card)", ["--i" as string]: i }}>
      <p className="text-[11.5px] font-medium tracking-[0.04em] text-fg-3">{label}</p>
      <div className="mt-auto pt-4">{children}</div>
      {foot && <div className="mt-2 text-[11.5px] text-fg-4">{foot}</div>}
    </div>
  );
}

export function StatTiles() {
  const snap = useBossStore((s) => s.snap);
  const today = snap?.today?.delivered ?? 0;
  const total = snap?.counts?.delivered ?? 0;
  const rejected = snap?.walk?.rejectedCount ?? 0;
  const walk = snap?.walk;
  const pct = Math.min(1, today / DAILY_CAP);

  return (
    <div className="stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Tile label="今日已投" i={0} foot={<>按惯例 {DAILY_CAP} 份收工 · BOSS 上限 150/天</>}>
        <div className="flex items-end gap-2">
          <span className="display-num text-[44px] text-fg">
            <NumberTicker value={today} />
          </span>
          <span className="tnum pb-1.5 text-[14px] text-fg-4">/ {DAILY_CAP}</span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-fill-3">
          <div className="h-full rounded-full bg-fg" style={{ width: `${pct * 100}%`, transition: "width 900ms var(--ease-out-quint)" }} />
        </div>
      </Tile>

      <Tile
        label="累计投递"
        i={1}
        foot={
          snap?.counts && (snap.counts.failed || snap.counts.blocked)
            ? `失败 ${snap.counts.failed} · 被上限拦下 ${snap.counts.blocked}`
            : "全部回读确认「送达」"
        }
      >
        <span className="display-num text-[44px] text-fg">
          <NumberTicker value={total} />
        </span>
      </Tile>

      <Tile label="已判不投" i={2} foot="判过的不会再出现，不重复审">
        <span className="display-num text-[44px] text-fg">
          <NumberTicker value={rejected} />
        </span>
      </Tile>

      <Tile
        label="当前位置"
        i={3}
        foot={walk?.recommendExhausted ? "推荐页已翻完 · 关键词搜索已解锁" : "推荐页优先：翻完才能搜关键词"}
      >
        <p className="truncate text-[22px] font-semibold tracking-[-0.02em] text-fg">
          {walk?.keyword ? `「${walk.keyword}」` : "推荐页"}
        </p>
        <p className="tnum mt-1 text-[12.5px] text-fg-3">
          游标第 {walk?.idx ?? 0} 张{walk?.kwExhausted ? " · 已翻到底" : ""}
        </p>
      </Tile>
    </div>
  );
}
