/* ============================================================================
 * AI 简历顾问面板
 *
 *   点纸上的段落 → 面板滑出并挂上「选区标签」→ 说不满 → 出 2-3 个候选 → 应用
 *   不选段落直接聊 → 自由对话；聊到的新经历可一键存进经历库
 *
 * 交互细节（9-16 定稿）：
 *   - Enter 发送 / Shift+Enter 换行（输入法组字时的回车不算）
 *   - 对话上下文跨选区保留
 *   - 思考话术：分阶段 + 随机轮换，每秒一句，让等待有「持续在推进」的感觉
 * ========================================================================== */

import { useEffect, useMemo, useRef, useState } from "react";

import { SECTIONS } from "../../data/sections";
import { chatFull, LlmError } from "../../lib/llm";
import { useExperienceStore } from "../../store/useExperienceStore";
import { useResumeStore } from "../../store/useResumeStore";
import { useSelectionStore } from "../../store/useSelectionStore";
import { IconBook, IconCheck, IconChevronRight, IconSend, IconSpark, IconX } from "../icons";
import { Button, IconButton } from "../kit/Button";
import { ShimmerText } from "../kit/misc";
import { toast } from "../kit/Toast";
import { usePresence } from "../kit/usePresence";
import { MdText } from "../MdText";
import { AI_W, EDGE, TOP } from "./layout";
import { entrySelector, flashApplied } from "./paperLink";

interface Candidate {
  text?: string;
  reason?: string;
}

interface ExtractedExp {
  company: string;
  project: string;
  summary: string;
}

interface Msg {
  role: "user" | "assistant";
  text: string;
  candidates?: Candidate[];
  appliedIndex?: number;
  error?: boolean;
  /** 自由聊里挖掘到的经历（可一键存入经历库） */
  exp?: ExtractedExp;
  expSaved?: boolean;
  /** 模型的深度思考过程（可展开查看） */
  reasoning?: string;
  /** 发问时挂着的那条要点（应用候选时写回这里） */
  target?: { sectionKey: string; entryId: string; bulletIndex: number; original: string };
}

/* ---------- 思考话术：分阶段 + 随机轮换（每秒一条，不重复） ---------- */

const THINKING_PHASES: { until: number; lines: string[] }[] = [
  { until: 5, lines: ["正在理解你的想法", "在读你选的这段", "分析你的反馈", "拆解一下需求", "想想从哪入手"] },
  { until: 12, lines: ["正在翻你的经历库", "回忆相关素材", "查找可引用的经历", "联想类似的表达", "对照简历口径"] },
  {
    until: 22,
    lines: ["正在起草候选", "换一个角度试试", "尝试更犀利的写法", "调整一下结构", "考虑换个动词开头", "量化结果往前放"],
  },
  { until: 40, lines: ["正在打磨措辞", "最后润色", "检查口径规范", "快好了", "马上完成", "做最后检查"] },
];

function useThinkingLine(thinking: boolean) {
  const [line, setLine] = useState(THINKING_PHASES[0].lines[0]);
  const lastRef = useRef("");

  useEffect(() => {
    if (!thinking) return;
    const start = Date.now();
    setLine(THINKING_PHASES[0].lines[0]);
    lastRef.current = "";
    const timer = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const phase = THINKING_PHASES.find((p) => elapsed < p.until) ?? THINKING_PHASES[THINKING_PHASES.length - 1];
      const pool = phase.lines.filter((l) => l !== lastRef.current);
      const next = pool[Math.floor(Math.random() * pool.length)];
      lastRef.current = next;
      setLine(next);
    }, 1000);
    return () => clearInterval(timer);
  }, [thinking]);

  return line;
}

/* ---------- Prompt ---------- */

const FACTS = `【事实红线 —— 最高优先级，违反即废稿】
- 严禁编造用户没提供过的任何信息：数字（星数/用户量/百分比/营收）、奖项、排名、公司名、时间、成果
- 改写 = 重组用户给出的原文素材，只能换说法，不能换事实
- 素材里没有的数据：留出「——」占位并在 reason 里提示用户补充，绝不允许编一个
- 不确定的信息一律不用：宁可平淡，绝不造假`;

const RULES = `${FACTS}

【简历口径规范】
- 结论收尾：要点结尾用「——」接量化结果
- 厉害但不晦涩：术语配人话，数字让外行秒懂
- 成果导向：动词开头，不写"负责"`;

/* 【回复纪律】金字塔原则：第一句给答案，粗体给重心，行动建议收口 */
const STYLE = `【回复纪律 —— 最高优先级】
- 先结论后细节：第一句直接给答案/判断，禁止铺垫（"好的""这是个好问题"一律不要）
- 默认 3 句话以内；确需展开时 ≤5 点、每点 ≤2 行
- 用 **粗体** 标出每段的重心词，用户扫一眼就知道重点
- 结尾用一个行动建议收口（如"要我把第 2 条改掉吗？"），推动下一步`;

/* 自由聊的示例提示（点击填入输入框） */
const SUGGESTIONS = ["我在蓝禾还做过一个直播巡检系统…", "帮我判断这份简历适合投什么岗", "有段经历没写进简历，想补上"];

const SYSTEM_IMPROVE = `你是一位顶级简历顾问。

${STYLE}

${RULES}

【意图判断 —— 先判断再输出】
1. 探讨类（"有哪些方向""怎么样""你觉得"）：
   → ≤5 点分析，每点一行粗体重心 + 一行说明，结尾问"要改哪条？"
2. 修改类（"改""重写""压缩""换个说法"）：
   → 只返回 JSON：
   { "candidates": [ { "text": "改后内容", "reason": "≤15 字理由" } ] }
   2-3 个候选，风格要有差异。`;

const SYSTEM_CHAT = `你是用户的简历顾问：帮他打磨简历、沉淀经历。

${STYLE}

${RULES}

【场景应对】
- 用户聊经历 → 提炼后附一行 <<EXP:公司|项目|摘要>>（没有新经历不加）
- 用户问怎么改 → 给方向（≤3 点），再问"要点选那段试试吗？"
- 用户说"改一下"但没选中内容 → 提示"点一下简历上的那段，我马上改"
- 用户问投递/定位 → 直接给判断 + 一句理由`;

/** 可折叠的思考过程 */
function ReasoningBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="press flex items-center gap-1 rounded-full py-0.5 pr-2 text-[11px] text-fg-4 hover:text-fg-2"
      >
        <IconChevronRight className={`h-3 w-3 transition-transform duration-300 ${open ? "rotate-90" : ""}`} />
        深度思考 · {text.length} 字
      </button>
      <div className="disclose" data-open={open}>
        <div>
          <p className="thin-scroll mt-1.5 max-h-56 overflow-y-auto whitespace-pre-wrap border-l border-hairline-2 pl-3 text-[11px] leading-[1.8] text-fg-4">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

function selectionLabel(sel: { level: string; entryLabel?: string; sectionLabel: string; bulletIndex?: number }) {
  if (sel.level === "bullet") return `${sel.entryLabel || sel.sectionLabel} · 第 ${(sel.bulletIndex ?? 0) + 1} 条`;
  if (sel.level === "entry") return `${sel.entryLabel || sel.sectionLabel} · 整段`;
  return `${sel.sectionLabel} · 整块`;
}

export function AiPanel() {
  const panelOpen = useSelectionStore((s) => s.panelOpen);
  const selections = useSelectionStore((s) => s.selections);
  const removeSelection = useSelectionStore((s) => s.remove);
  const thinking = useSelectionStore((s) => s.thinking);
  const setThinking = useSelectionStore((s) => s.setThinking);
  const close = useSelectionStore((s) => s.close);

  const setBullet = useResumeStore((s) => s.setBullet);
  const sections = useResumeStore((s) => s.sections);
  const addExperience = useExperienceStore((s) => s.addItem);
  const expItems = useExperienceStore((s) => s.items);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const thinkingLine = useThinkingLine(thinking);
  const { mounted, state } = usePresence(panelOpen, 200);

  /* Esc 关闭 */
  useEffect(() => {
    if (!panelOpen) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [panelOpen, close]);

  /* 打开时聚焦输入框 */
  useEffect(() => {
    if (panelOpen) window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 120);
  }, [panelOpen, selections.length]);

  /* 消息滚动到底 */
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  /* 输入框自动撑高 */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  /* 选区按简历文档顺序排列（而非点击顺序） */
  const sortedSelections = useMemo(() => {
    const secIdx = (k: string) => SECTIONS.findIndex((d) => d.key === k);
    const entryIdx = (sel: (typeof selections)[number]) => {
      const arr = sections[sel.sectionKey] ?? [];
      return sel.entryId ? arr.findIndex((e) => e.id === sel.entryId) : -1;
    };
    return [...selections].sort((a, b) => {
      const d = secIdx(a.sectionKey) - secIdx(b.sectionKey);
      if (d) return d;
      if (a.level === "section" || b.level === "section") return a.level === "section" ? -1 : 1;
      const e = entryIdx(a) - entryIdx(b);
      if (e) return e;
      return (a.bulletIndex ?? -1) - (b.bulletIndex ?? -1);
    });
  }, [selections, sections]);

  if (!mounted) return null;

  const placeholder = thinking ? "AI 正在思考…" : selections.length > 0 ? "说说对选中部分的想法…" : "聊聊简历、经历…";

  async function submit() {
    const feedback = input.trim();
    if (!feedback || thinking) return;
    setInput("");

    const isImprove = sortedSelections.length > 0;
    const bulletSel = sortedSelections.find((x) => x.level === "bullet");
    const target =
      bulletSel && bulletSel.entryId != null && bulletSel.bulletIndex != null
        ? {
            sectionKey: bulletSel.sectionKey,
            entryId: bulletSel.entryId,
            bulletIndex: bulletSel.bulletIndex,
            original: bulletSel.bulletText ?? "",
          }
        : undefined;

    setMessages((m) => [...m, { role: "user", text: feedback }]);
    setThinking(true);

    try {
      /* 经历库素材：模型手里有真料才不会编造 */
      const expBg = expItems
        .slice(0, 12)
        .map((it) => "- " + it.company + (it.project ? " · " + it.project : "") + "：" + it.summary)
        .join("\n");

      let userContent: string;
      if (isImprove) {
        const parts: string[] = [];
        for (const sel of sortedSelections) {
          if (sel.level === "bullet") {
            parts.push(`【${sel.entryLabel} · 第 ${(sel.bulletIndex ?? 0) + 1} 条】${sel.bulletText}`);
          } else if (sel.level === "entry") {
            const entry = sections[sel.sectionKey]?.find((e) => e.id === sel.entryId);
            const bullets = (entry?.values.bullets as string[] | undefined) ?? [];
            parts.push(`【${sel.entryLabel}（整段）】\n${bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}`);
          } else {
            parts.push(`【模块：${sel.sectionLabel}（整块）】`);
          }
        }
        userContent = `用户选中了以下简历内容：\n\n${parts.join("\n\n")}\n\n【用户反馈】${feedback}\n\n【经历库素材（改写时只能从这里取事实，没有的数据用「——」占位）】\n${expBg}`;
      } else {
        userContent = `【经历库素材】\n${expBg}\n\n【用户说】${feedback}`;
      }

      const { content: reply, reasoning } = await chatFull(
        [
          { role: "system", content: isImprove ? SYSTEM_IMPROVE : SYSTEM_CHAT },
          { role: "user", content: userContent },
        ],
        { temperature: isImprove ? 0.6 : 0.5 },
      );

      if (isImprove) {
        let candidates: Candidate[] = [];
        const m = reply.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            const parsed = JSON.parse(m[0]);
            if (Array.isArray(parsed.candidates)) candidates = parsed.candidates.slice(0, 4);
          } catch {
            /* 非结构化 → 当纯文本 */
          }
        }
        setMessages((prev) => [
          ...prev,
          candidates.length > 0
            ? { role: "assistant", text: "", candidates, reasoning, target }
            : { role: "assistant", text: reply.trim() || "（空回复）", reasoning },
        ]);
      } else {
        /* 自由聊：解析可能附带的新经历标记 <<EXP:公司|项目|摘要>> */
        const expMatch = reply.match(/<<EXP:(.+?)>>/);
        let exp: ExtractedExp | undefined;
        let clean = reply;
        if (expMatch) {
          const parts = expMatch[1].split("|").map((x) => x.trim());
          if (parts[0]) exp = { company: parts[0] ?? "", project: parts[1] ?? "", summary: parts[2] ?? "" };
          clean = reply.replace(/<<EXP:.*?>>/g, "").trim();
        }
        setMessages((prev) => [...prev, { role: "assistant", text: clean, exp, reasoning }]);
      }
    } catch (err) {
      const msg = err instanceof LlmError ? err.message : err instanceof Error ? err.message : "调用失败";
      setMessages((prev) => [...prev, { role: "assistant", text: msg, error: true }]);
    } finally {
      setThinking(false);
    }
  }

  function applyCandidate(msgIndex: number, idx: number, text: string) {
    const target = messages[msgIndex]?.target;
    if (!target) {
      toast("整段 / 整块的候选请手动粘贴到左侧对应条目");
      return;
    }
    setBullet(target.sectionKey as never, target.entryId, "bullets", target.bulletIndex, text);
    setMessages((prev) => prev.map((mm, i) => (i === msgIndex ? { ...mm, appliedIndex: idx } : mm)));
    window.setTimeout(() => flashApplied(`${entrySelector(target.entryId)} [data-bullet-index="${target.bulletIndex}"]`), 30);
    toast("已写回简历", "success");
  }

  const contextLabel =
    sortedSelections.length === 0
      ? "自由对话"
      : sortedSelections.length === 1
        ? selectionLabel(sortedSelections[0])
        : `已选 ${sortedSelections.length} 处`;

  return (
    <aside
      data-state={state}
      className="glass anim-panel no-print fixed z-40 flex flex-col overflow-hidden"
      style={{ right: EDGE, top: TOP, bottom: EDGE, width: AI_W }}
    >
      {/* 头部 */}
      <div className="flex shrink-0 items-center gap-2.5 px-4 pb-3 pt-4">
        <span className="solid flex h-8 w-8 items-center justify-center rounded-full">
          <IconSpark className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-fg">AI 简历顾问</p>
          <p className="truncate text-[11.5px] text-fg-4">{contextLabel}</p>
        </div>
        <IconButton label="关闭（Esc）" pill onClick={close}>
          <IconX className="h-4 w-4" />
        </IconButton>
      </div>

      {/* 消息流 */}
      <div ref={listRef} className="thin-scroll fade-y min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4 pt-2">
        {messages.length === 0 && !thinking && (
          <div className="stagger flex min-h-full flex-col justify-center gap-6 px-1 pb-8">
            <div style={{ ["--i" as string]: 0 }}>
              <p className="text-[22px] font-semibold leading-[1.25] tracking-[-0.025em] text-fg">
                点一下纸上的段落，
                <br />
                告诉我哪里不满意。
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-fg-3">
                也可以直接聊。你讲到的经历会沉淀进<span className="font-medium text-fg-2">经历库</span>，之后写简历、生成话术都会引用它，不会凭空编。
              </p>
            </div>
            <div className="flex flex-col gap-1.5" style={{ ["--i" as string]: 1 }}>
              {SUGGESTIONS.map((sg) => (
                <button
                  key={sg}
                  type="button"
                  onClick={() => {
                    setInput(sg);
                    inputRef.current?.focus();
                  }}
                  className="surface press group flex items-center gap-2 px-3.5 py-2.5 text-left text-[12.5px] text-fg-2 hover:text-fg"
                  style={{ ["--r" as string]: "14px" }}
                >
                  <span className="flex-1">{sg}</span>
                  <IconChevronRight className="h-3.5 w-3.5 text-fg-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="anim-rise flex justify-end">
              <p className="solid max-w-[86%] whitespace-pre-wrap rounded-[18px] rounded-br-[6px] px-3.5 py-2 text-[13px] leading-relaxed">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={i} className="anim-rise space-y-2.5">
              {m.reasoning && <ReasoningBlock text={m.reasoning} />}
              {m.text && (
                <div className={`text-[13px] leading-[1.75] ${m.error ? "text-danger" : "text-fg-2"}`}>
                  {m.error ? m.text : <MdText text={m.text} />}
                </div>
              )}

              {/* 挖掘到的经历 → 确认后存入经历库 */}
              {m.exp && (
                <div className="surface px-3.5 py-3" style={{ ["--r" as string]: "16px" }}>
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-fg-3">
                    <IconBook className="h-3.5 w-3.5" />
                    检测到一段新经历
                  </p>
                  <p className="mt-1.5 text-[13px] font-semibold text-fg">
                    {m.exp.company}
                    {m.exp.project ? ` · ${m.exp.project}` : ""}
                  </p>
                  {m.exp.summary && <p className="mt-1 text-[12px] leading-relaxed text-fg-3">{m.exp.summary}</p>}
                  <div className="mt-2.5">
                    {m.expSaved ? (
                      <span className="chip chip-sm">
                        <IconCheck className="h-3 w-3" />
                        已存入经历库
                      </span>
                    ) : (
                      <Button
                        size="xs"
                        variant="primary"
                        pill
                        onClick={() => {
                          addExperience({ company: m.exp!.company, project: m.exp!.project, summary: m.exp!.summary });
                          setMessages((prev) => prev.map((mm, mi) => (mi === i ? { ...mm, expSaved: true } : mm)));
                        }}
                      >
                        存入经历库
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {m.target && m.candidates && (
                <p className="line-clamp-2 border-l-2 border-hairline-2 pl-2.5 text-[11.5px] leading-relaxed text-fg-4 line-through decoration-[var(--fg-4)]">
                  {m.target.original}
                </p>
              )}

              {m.candidates?.map((c, ci) => {
                const applied = m.appliedIndex === ci;
                return (
                  <div
                    key={ci}
                    className={`surface group/cand px-3.5 py-3 transition-[background-color,box-shadow] duration-300 ${applied ? "surface-strong" : ""}`}
                    style={{ ["--r" as string]: "16px", animationDelay: `${ci * 60}ms` }}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="tnum mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-fill-2 text-[10.5px] font-semibold text-fg-3">
                        {ci + 1}
                      </span>
                      <p className="flex-1 whitespace-pre-wrap text-[13px] leading-[1.7] text-fg">{c.text}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-2 pl-[26px]">
                      {c.reason && <p className="min-w-0 flex-1 truncate text-[11px] text-fg-4">{c.reason}</p>}
                      {applied ? (
                        <span className="chip chip-sm chip-solid ml-auto">
                          <IconCheck className="h-3 w-3" />
                          已应用
                        </span>
                      ) : (
                        <Button
                          size="xs"
                          variant="primary"
                          pill
                          disabled={m.appliedIndex != null}
                          className="ml-auto opacity-0 transition-opacity duration-200 group-hover/cand:opacity-100 focus-visible:opacity-100"
                          onClick={() => applyCandidate(i, ci, c.text ?? "")}
                        >
                          应用
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ),
        )}

        {/* 思考中：呼吸点 + 扫光文字 */}
        {thinking && (
          <div className="anim-fade flex items-center gap-2.5 py-1">
            <span className="breathe h-2 w-2 rounded-full bg-fg" />
            <ShimmerText key={thinkingLine} className="anim-fade text-[13px] font-medium">
              {thinkingLine}…
            </ShimmerText>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="shrink-0 px-3 pb-3">
        {sortedSelections.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5 px-1">
            {sortedSelections.map((sel) => (
              <span key={sel.key} className="chip anim-fade max-w-full !pr-1">
                <span className="truncate">{selectionLabel(sel)}</span>
                <button
                  type="button"
                  onClick={() => removeSelection(sel.key)}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-fg-4 transition-colors hover:bg-fill-3 hover:text-fg"
                  aria-label="移除此选区"
                >
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div
          className="well flex items-end gap-2 p-1.5 transition-shadow duration-300 focus-within:shadow-[inset_0_0_0_1px_var(--fg-4),0_0_0_4px_var(--fill)]"
          style={{ borderRadius: 20 }}
        >
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            placeholder={placeholder}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                void submit();
              }
            }}
            className="thin-scroll max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2.5 text-[13px] leading-[1.55] text-fg outline-none placeholder:text-fg-4"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={thinking || !input.trim()}
            aria-label="发送（Enter）"
            className="solid press flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-25"
          >
            <IconSend className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10.5px] text-fg-4">Enter 发送 · Shift + Enter 换行</p>
      </div>
    </aside>
  );
}
