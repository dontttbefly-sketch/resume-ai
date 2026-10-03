/* ============================================================================
 * 当前这一张：卡片表面 → JD 正文 → AI 结论 → 投 / 跳
 *
 * 一次只看得见一张（与技能的「单卡游标制」一致），从机制上杜绝跳序。
 * ========================================================================== */

import { useState } from "react";

import { switchView } from "../../lib/transitions";
import { useBossStore, type Phase } from "../../store/useBossStore";
import { useJdStore } from "../../store/useJdStore";
import { useUiStore } from "../../store/useUiStore";
import {
  IconCheck,
  IconChevronRight,
  IconPlane,
  IconRefresh,
  IconSearch,
  IconSkip,
  IconSpark,
  IconTarget,
  IconWarn,
  IconX,
} from "../icons";
import { Button, IconButton } from "../kit/Button";
import { EmptyState, ShimmerText, Spinner } from "../kit/misc";
import { useSpotlight } from "../kit/useSpotlight";

const PHASE_TEXT: Partial<Record<Phase, string>> = {
  walking: "正在找下一张卡",
  scrolling: "正在滚动加载更多岗位",
  opening: "正在打开 JD",
  judging: "AI 正在读 JD",
  delivering: "正在投递，等「送达」回读",
  rejecting: "正在记录跳过",
  exhausting: "正在把推荐页滚到底",
  checking: "正在检测环境",
};

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="chip chip-outline">{children}</span>;
}

function JdSkeleton() {
  return (
    <div className="space-y-2.5 p-5">
      {[92, 100, 84, 96, 70, 88, 60].map((w, i) => (
        <div key={i} className="h-2.5 rounded-full bg-fill-2" style={{ width: `${w}%`, opacity: 1 - i * 0.09 }} />
      ))}
    </div>
  );
}

function Verdict() {
  const verdict = useBossStore((s) => s.verdict);
  const judgeError = useBossStore((s) => s.judgeError);
  const phase = useBossStore((s) => s.phase);
  const rejudge = useBossStore((s) => s.rejudge);

  if (phase === "judging") {
    return (
      <div className="flex items-center gap-2.5 py-1">
        <span className="breathe h-2 w-2 rounded-full bg-fg" />
        <ShimmerText className="text-[13.5px] font-medium">AI 正在对照你的画像和规则读这份 JD…</ShimmerText>
      </div>
    );
  }
  if (judgeError) {
    return (
      <div className="flex items-start gap-2.5">
        <IconWarn className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        <p className="flex-1 text-[13px] leading-relaxed text-fg-2">{judgeError}</p>
        <Button size="xs" pill icon={<IconRefresh className="h-3.5 w-3.5" />} onClick={() => void rejudge()}>
          重试
        </Button>
      </div>
    );
  }
  if (!verdict) return null;

  return (
    <div className="anim-rise flex items-start gap-3.5">
      <span
        className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold ${
          verdict.deliver ? "solid" : "bg-transparent text-fg shadow-[inset_0_0_0_1.5px_var(--fg)]"
        }`}
      >
        {verdict.deliver ? <IconCheck className="h-4 w-4" /> : <IconX className="h-4 w-4" />}
        {verdict.deliver ? "建议投递" : "建议跳过"}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13.5px] leading-relaxed text-fg">{verdict.reason || "（模型没有给理由）"}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-fg-4">
          <span className="inline-flex items-center gap-1">
            {verdict.source === "rule" ? "规则判定" : <><IconSpark className="h-3 w-3" />AI 判定</>}
          </span>
          {verdict.direction && <span>方向 · {verdict.direction}</span>}
          {verdict.confidence != null && <span className="tnum">把握 {Math.round(verdict.confidence * 100)}%</span>}
          {verdict.ms > 0 && <span className="tnum">{(verdict.ms / 1000).toFixed(1)}s</span>}
        </p>
      </div>
      {verdict.source === "ai" && (
        <IconButton label="重新判断" size="sm" pill onClick={() => void rejudge()}>
          <IconRefresh className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  );
}

function ListEndState() {
  const listEnd = useBossStore((s) => s.listEnd)!;
  const next = useBossStore((s) => s.next);
  const begin = useBossStore((s) => s.begin);
  const exhaust = useBossStore((s) => s.exhaustRecommend);
  const [kw, setKw] = useState("");

  return (
    <EmptyState
      className="py-16"
      icon={listEnd.blocked ? <IconWarn className="h-6 w-6" /> : <IconCheck className="h-6 w-6" />}
      title={listEnd.blocked ? "推荐页还没翻完" : listEnd.kwExhausted ? "这一页翻到底了" : "当前可见的卡都过完了"}
      action={
        listEnd.blocked ? (
          <Button variant="primary" size="md" pill onClick={() => void exhaust()}>
            把推荐页翻到底（约 1–5 分钟）
          </Button>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {!listEnd.kwExhausted && (
              <Button variant="primary" size="md" pill onClick={() => void next()}>
                滚动加载更多
              </Button>
            )}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (kw.trim()) void begin({ kind: "keyword", keyword: kw.trim() });
              }}
            >
              <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="换个关键词，如 AI产品经理" className="field w-60 !py-2" />
              <Button type="submit" size="md" pill disabled={!kw.trim()} icon={<IconSearch className="h-4 w-4" />}>
                搜索
              </Button>
            </form>
          </div>
        )
      }
    >
      {listEnd.blocked
        ? "技能的硬规则：推荐页要先滚到最后一个岗位、逐张判完，才允许关键词搜索补充。"
        : listEnd.kwExhausted
          ? `关键词「${listEnd.keyword}」下的岗位都看过了。换一个关键词继续。`
          : "可以继续往下滚动加载，或者换一个关键词。"}
    </EmptyState>
  );
}

function StartState({ locked }: { locked: boolean }) {
  const begin = useBossStore((s) => s.begin);
  const walk = useBossStore((s) => s.snap?.walk);
  const [kw, setKw] = useState("");

  const options = [
    {
      title: "继续上次",
      desc: walk?.keyword ? `关键词「${walk.keyword}」· 游标第 ${walk.idx} 张` : `推荐页 · 游标第 ${walk?.idx ?? 0} 张`,
      onClick: () => void begin({ kind: "resume" }),
    },
    {
      title: "推荐页",
      desc: "平台按你的画像推的岗位，命中率最高，回到顶部从上往下看",
      onClick: () => void begin({ kind: "recommend" }),
    },
  ];

  return (
    <div className={`stagger flex flex-1 flex-col justify-center px-8 py-12 transition-opacity duration-300 ${locked ? "pointer-events-none opacity-45" : ""}`}>
      <p className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-fg" style={{ ["--i" as string]: 0 }}>
        从哪里开始？
      </p>
      <p className="mt-2 max-w-[520px] text-[13.5px] leading-relaxed text-fg-3" style={{ ["--i" as string]: 1 }}>
        一次只看一张卡：读 JD → AI 按你的画像和规则判断 → 你确认投或跳。已投过、判过的岗位会自动略过。
      </p>
      <div className="mt-7 grid gap-2.5 md:grid-cols-3" style={{ ["--i" as string]: 2 }}>
        {options.map((o) => (
          <button
            key={o.title}
            type="button"
            onClick={o.onClick}
            className="surface lift press group flex flex-col items-start p-4 text-left"
            style={{ ["--r" as string]: "var(--r-card)" }}
          >
            <span className="flex w-full items-center text-[14px] font-semibold text-fg">
              {o.title}
              <IconChevronRight className="ml-auto h-4 w-4 text-fg-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
            <span className="mt-1.5 text-[12px] leading-relaxed text-fg-3">{o.desc}</span>
          </button>
        ))}
        <form
          className="surface flex flex-col p-4"
          style={{ ["--r" as string]: "var(--r-card)" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (kw.trim()) void begin({ kind: "keyword", keyword: kw.trim() });
          }}
        >
          <span className="text-[14px] font-semibold text-fg">搜关键词</span>
          <div className="mt-2.5 flex items-center gap-1.5">
            <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="AI产品经理" className="field !py-1.5 !text-[12.5px]" />
            <IconButton label="搜索" type="submit" size="sm" disabled={!kw.trim()}>
              <IconSearch className="h-4 w-4" />
            </IconButton>
          </div>
          <span className="mt-2 text-[11px] text-fg-4">推荐页翻完后才可用</span>
        </form>
      </div>
    </div>
  );
}

export function LiveDeck({ locked }: { locked: boolean }) {
  const card = useBossStore((s) => s.card);
  const jd = useBossStore((s) => s.jd);
  const phase = useBossStore((s) => s.phase);
  const verdict = useBossStore((s) => s.verdict);
  const listEnd = useBossStore((s) => s.listEnd);
  const autoRunning = useBossStore((s) => s.auto.running);
  const deliver = useBossStore((s) => s.deliver);
  const skip = useBossStore((s) => s.skip);
  const next = useBossStore((s) => s.next);
  const spot = useSpotlight<HTMLElement>();

  /** 把这份 JD 送去「岗位 › 分析 JD」：看缺什么、生成打招呼话术 */
  const sendToMatch = () => {
    if (!card) return;
    const jdStore = useJdStore.getState();
    jdStore.setJdText(`${card.surface.title}\n\n${jd}`);
    jdStore.analyze();
    useUiStore.getState().setMatchTab("analyze");
    switchView("match");
  };

  const working = phase !== "idle" && phase !== "awaiting";
  const s = card?.surface;
  const disabled = locked || working || autoRunning;

  return (
    <section ref={spot} className="glass spot flex min-h-[560px] flex-col overflow-hidden" style={{ ["--r" as string]: "var(--r-panel)" }}>
      {/* 状态条 */}
      <div className="flex h-12 shrink-0 items-center gap-2.5 px-5 hair-b">
        <IconPlane className="h-4 w-4 text-fg-3" />
        <span className="text-[12.5px] font-medium text-fg-2">当前这一张</span>
        {card && (
          <span className="tnum text-[11.5px] text-fg-4">
            列表第 {card.position + 1} 张 · 本屏 {card.visibleTotal} 张
            {card.autoSkipped > 0 && ` · 已自动略过 ${card.autoSkipped} 张`}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-[12px] text-fg-3">
          {jd && !working && (
            <IconButton label="用这份 JD 做匹配分析 / 生成话术" size="xs" pill onClick={sendToMatch}>
              <IconTarget className="h-3.5 w-3.5" />
            </IconButton>
          )}
          {working && (
            <>
              <Spinner className="h-3.5 w-3.5" />
              <ShimmerText>{PHASE_TEXT[phase]}</ShimmerText>
            </>
          )}
          {!working && card?.outcome === "delivered" && (
            <span className="chip chip-solid anim-fade">
              <IconCheck className="h-3 w-3" />
              已投递
            </span>
          )}
          {!working && card?.outcome === "rejected" && <span className="chip anim-fade">已跳过</span>}
          {!working && (card?.outcome === "failed" || card?.outcome === "vanished") && (
            <span className="chip chip-outline anim-fade">{card.outcome === "failed" ? "没投出去" : "已略过"}</span>
          )}
        </span>
      </div>

      {!card && listEnd && <ListEndState />}
      {!card && !listEnd && (phase === "walking" || phase === "scrolling") && (
        <div className="flex flex-1 items-center justify-center">
          <ShimmerText className="text-[14px] font-medium">{PHASE_TEXT[phase]}…</ShimmerText>
        </div>
      )}
      {!card && !listEnd && phase !== "walking" && phase !== "scrolling" && <StartState locked={locked} />}

      {card && s && (
        <div key={s.jobId} className="anim-rise flex min-h-0 flex-1 flex-col">
          {/* 表面 */}
          <div className="px-6 pb-4 pt-5">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.025em] text-fg">{s.title}</h2>
                <p className="mt-1.5 truncate text-[13.5px] text-fg-2">
                  {s.company || "（公司名未取到）"}
                  {s.industry && <span className="text-fg-4"> · {s.industry}</span>}
                </p>
              </div>
              <p className="tnum shrink-0 text-[22px] font-semibold tracking-[-0.02em] text-fg">{s.salary || "面议"}</p>
            </div>
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {s.city && <Chip>{s.city}</Chip>}
              {s.experience && <Chip>{s.experience}</Chip>}
              {s.degree && <Chip>{s.degree}</Chip>}
              {s.scale && <Chip>{s.scale}</Chip>}
              {s.stage && <Chip>{s.stage}</Chip>}
            </div>
          </div>

          {/* JD */}
          <div className="mx-5 min-h-0 flex-1">
            <div className="well relative h-full max-h-[380px] min-h-[180px] overflow-hidden" style={{ borderRadius: 18 }}>
              {phase === "opening" ? (
                <JdSkeleton />
              ) : jd ? (
                <div className="thin-scroll fade-y h-full max-h-[380px] overflow-y-auto whitespace-pre-wrap px-5 py-4 text-[12.5px] leading-[1.8] text-fg-2">
                  {jd}
                </div>
              ) : (
                <div className="flex h-full min-h-[180px] items-center justify-center text-[12.5px] text-fg-4">
                  {verdict?.source === "rule" ? "规则已能判定，没有打开 JD" : "JD 还没打开"}
                </div>
              )}
            </div>
          </div>

          {/* 结论 + 动作 */}
          <div className="px-6 pb-5 pt-4">
            <div className="min-h-[44px]">
              <Verdict />
            </div>
            <div className="mt-4 flex items-center gap-2">
              {card.outcome ? (
                <>
                  {card.outcomeNote && <p className="mr-auto text-[12.5px] leading-relaxed text-fg-3">{card.outcomeNote}</p>}
                  <Button
                    variant="primary"
                    size="lg"
                    pill
                    className="ml-auto"
                    disabled={disabled}
                    onClick={() => void next()}
                    icon={<IconChevronRight className="h-4 w-4" />}
                  >
                    下一张
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="lg"
                    pill
                    disabled={disabled}
                    onClick={() => void skip("manual")}
                    icon={<IconSkip className="h-4 w-4" />}
                  >
                    跳过
                  </Button>
                  <span className="ml-auto" />
                  <Button
                    variant={verdict && !verdict.deliver ? "secondary" : "primary"}
                    size="lg"
                    pill
                    disabled={disabled}
                    onClick={() => void deliver("manual")}
                    icon={<IconPlane className="h-4 w-4" />}
                    className="min-w-[132px]"
                  >
                    投递
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
