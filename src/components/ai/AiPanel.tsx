/* ============================================================================
 * AI 面板（双模式）
 *
 *   compact（局部编辑）：点简历段落触发 → 矮面板，改进当前选区
 *   full（AI 聊天）：点顶栏 ✦AI → 高面板，自由对话（简历 / 经历库相关）
 *
 * 交互细节（9-16 定稿）：
 *   - Enter 发送 / Shift+Enter 换行
 *   - 对话上下文跨选区保留
 *   - 思考话术：分阶段 + 随机轮换，每秒一句，让等待有「持续在推进」的感觉
 *   - compact 可「转自由聊」（解除选区关联 → full）
 * ========================================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import { chat, LlmError } from "../../lib/llm";
import { useSelectionStore } from "../../store/useSelectionStore";
import { useResumeStore } from "../../store/useResumeStore";
import { useExperienceStore } from "../../store/useExperienceStore";
import { SECTION_MAP } from "../../data/sections";

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
}

/* ---------- 思考话术：分阶段 + 随机轮换（每秒一条，不重复） ---------- */

const THINKING_PHASES: { until: number; lines: string[] }[] = [
  {
    until: 5,
    lines: [
      "正在理解你的想法…",
      "在读你选的这段…",
      "分析你的反馈…",
      "拆解一下需求…",
      "想想从哪入手…",
    ],
  },
  {
    until: 12,
    lines: [
      "正在翻你的经历库…",
      "回忆相关素材…",
      "查找可引用的经历…",
      "联想类似的表达…",
      "对照简历口径…",
    ],
  },
  {
    until: 22,
    lines: [
      "正在起草候选…",
      "换一个角度试试…",
      "尝试更犀利的写法…",
      "调整一下结构…",
      "考虑换个动词开头…",
      "量化结果往前放…",
    ],
  },
  {
    until: 40,
    lines: [
      "正在打磨措辞…",
      "最后润色…",
      "检查口径规范…",
      "快好了…",
      "马上完成…",
      "做最后检查…",
    ],
  },
];

function useThinkingLine(thinking: boolean) {
  const [line, setLine] = useState(THINKING_PHASES[0].lines[0]);
  const lastRef = useRef("");
  const startRef = useRef(0);

  useEffect(() => {
    if (!thinking) return;
    startRef.current = Date.now();
    setLine(THINKING_PHASES[0].lines[0]);
    lastRef.current = "";

    const timer = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const phase =
        THINKING_PHASES.find((p) => elapsed < p.until) ?? THINKING_PHASES[THINKING_PHASES.length - 1];
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

const RULES = `【简历口径规范（必须遵守）】
- 结论收尾：每条要点的结论/成果放在句尾，用「——」连接
- 厉害但不晦涩：术语配人话，量化数字让外行秒懂
- 成果导向：动词开头（搭建/设计/开发/主导），不写"负责"
- 一句话一条信息，不啰嗦`;

/* 自由聊的示例提示（点击填入输入框） */
const SUGGESTIONS = [
  "我在蓝禾还做过一个直播巡检系统…",
  "帮我判断这份简历适合投什么岗",
  "有段经历没写进简历，想补上",
];

const SYSTEM_IMPROVE = `你是一位顶级简历优化专家，帮用户改进简历的一个片段。

${RULES}

【输出要求】
只返回 JSON，不要任何其他文字：
{
  "candidates": [
    { "text": "改进后的完整内容", "reason": "一句话说明为什么这么改" },
    { "text": "...", "reason": "..." }
  ]
}
给 2-3 个风格不同的候选。`;

const SYSTEM_CHAT = `你是用户的简历顾问，帮他把简历做好、挖掘他的经历。

${RULES}

用户会跟你聊简历的想法、他的经历、求职方向。自然地对话：
- 回复简洁，不说套话，直接给有用的内容
- 普通文本回复即可，不需要 JSON

【经历沉淀】如果用户这段话透露了一段值得写进简历的具体经历（有公司/项目/成果），
请在回复的最后**另起一行**附上这一行标记（没有新经历就不要加）：
<<EXP:公司名|项目名|一句话摘要>>`;

export function AiPanel() {
  const panelMode = useSelectionStore((s) => s.panelMode);
  const selection = useSelectionStore((s) => s.selection);
  const thinking = useSelectionStore((s) => s.thinking);
  const setThinking = useSelectionStore((s) => s.setThinking);
  const detach = useSelectionStore((s) => s.detach);
  const close = useSelectionStore((s) => s.close);

  const setBullet = useResumeStore((s) => s.setBullet);
  const sections = useResumeStore((s) => s.sections);
  const addExperience = useExperienceStore((s) => s.addItem);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const thinkingLine = useThinkingLine(thinking);

  const compact = panelMode === "compact";

  /* Esc 关闭 */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [close]);

  /* 消息滚动到底 */
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  /* ---------- 锚点：compact 面板垂直对齐到被选中的段落（像批注贴在旁边） ---------- */
  const [anchorTop, setAnchorTop] = useState<number | null>(null);

  useEffect(() => {
    if (!compact || !selection) {
      setAnchorTop(null);
      return;
    }
    const PANEL_H = Math.min(Math.round(window.innerHeight * 0.62), 520);
    let scrolled = false;
    const place = (r: DOMRect) =>
      setAnchorTop(Math.round(Math.max(60, Math.min(r.top - 12, window.innerHeight - PANEL_H - 16))));
    const calc = () => {
      const el = document.querySelector(".block-selected");
      if (!el) return;
      const r = el.getBoundingClientRect();
      /* 段落不在视口内 → 先居中滚动，让用户看到它，再定位面板 */
      if (!scrolled && (r.top < 60 || r.bottom > window.innerHeight - 60)) {
        scrolled = true;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        window.setTimeout(() => {
          const r2 = el.getBoundingClientRect();
          place(r2);
        }, 450);
        return;
      }
      place(r);
    };
    calc();
    /* 选区渲染晚一拍（PreviewPanel 的 effect 才加类），再算一次 */
    const t = window.setTimeout(calc, 80);
    window.addEventListener("scroll", calc, true);
    window.addEventListener("resize", calc);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("scroll", calc, true);
      window.removeEventListener("resize", calc);
    };
  }, [compact, selection, thinking]);

  const placeholder = useMemo(() => {
    if (thinking) return "AI 正在思考…";
    if (selection && compact) return "说说哪里不满意…";
    return "聊聊简历、经历…";
  }, [thinking, selection, compact]);

  if (!panelMode) return null;

  const contextLabel = selection
    ? selection.level === "bullet"
      ? `${selection.entryLabel} · 第 ${(selection.bulletIndex ?? 0) + 1} 条`
      : selection.level === "entry"
        ? `${selection.entryLabel}（整段）`
        : selection.sectionLabel
    : "自由对话";

  async function submit() {
    const feedback = input.trim();
    if (!feedback || thinking) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: feedback }]);
    setThinking(true);

    const isImprove = !!selection && compact;
    try {
      let userContent: string;
      if (isImprove && selection) {
        const secLabel =
          (SECTION_MAP as Record<string, { label: string }>)[selection.sectionKey]?.label ?? selection.sectionKey;
        if (selection.level === "bullet") {
          userContent = `【模块】${secLabel}\n【条目】${selection.entryLabel}\n【当前这条内容】${selection.bulletText}\n\n【用户反馈】${feedback}`;
        } else if (selection.level === "entry") {
          const entry = sections[selection.sectionKey]?.find((e) => e.id === selection.entryId);
          const bullets = (entry?.values.bullets as string[] | undefined) ?? [];
          userContent = `【模块】${secLabel}\n【条目】${selection.entryLabel}\n【当前全部要点】\n${bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}\n\n【用户反馈】${feedback}`;
        } else {
          userContent = `【模块】${secLabel}（用户想改进整个模块）\n【用户反馈】${feedback}\n\n请给整块改进的候选。`;
        }
      } else {
        userContent = feedback;
      }

      const reply = await chat(
        [
          { role: "system", content: isImprove ? SYSTEM_IMPROVE : SYSTEM_CHAT },
          { role: "user", content: userContent },
        ],
        { temperature: isImprove ? 0.8 : 0.7 },
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
            ? { role: "assistant", text: "", candidates }
            : { role: "assistant", text: reply.trim() || "（空回复）" },
        ]);
      } else {
        /* 自由聊：解析可能附带的新经历标记 <<EXP:公司|项目|摘要>> */
        const expMatch = reply.match(/<<EXP:(.+?)>>/);
        let exp: ExtractedExp | undefined;
        let clean = reply;
        if (expMatch) {
          const parts = expMatch[1].split("|").map((x) => x.trim());
          if (parts[0]) {
            exp = { company: parts[0] ?? "", project: parts[1] ?? "", summary: parts[2] ?? "" };
          }
          clean = reply.replace(/<<EXP:.*?>>/g, "").trim();
        }
        setMessages((prev) => [...prev, { role: "assistant", text: clean, exp }]);
      }
    } catch (err) {
      const msg = err instanceof LlmError ? err.message : err instanceof Error ? err.message : "调用失败";
      setMessages((prev) => [...prev, { role: "assistant", text: `⚠️ ${msg}`, error: true }]);
    } finally {
      setThinking(false);
    }
  }

  function applyCandidate(idx: number, text: string) {
    if (!selection) return;
    if (selection.level === "bullet") {
      setBullet(selection.sectionKey as never, selection.entryId!, "bullets", selection.bulletIndex!, text);
    } else if (selection.level === "entry") {
      const lines = text.split("\n").map((l) => l.replace(/^\d+[.、]\s*/, "").trim()).filter(Boolean);
      lines.forEach((line, i) => {
        setBullet(selection.sectionKey as never, selection.entryId!, "bullets", i, line);
      });
    }
    setMessages((prev) =>
      prev.map((mm, i) => (i === prev.length - 1 ? { ...mm, appliedIndex: idx } : mm)),
    );
  }

  return (
    <aside
      className={
        "ai-panel no-print fixed right-4 z-40 flex w-[380px] flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/[0.93] shadow-[0_2px_8px_rgba(15,23,42,0.06),0_12px_40px_rgba(15,23,42,0.14)] backdrop-blur-2xl transition-[top] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] animate-[ai-slide-in_280ms_cubic-bezier(0.32,0.72,0,1)] " +
        (compact ? "" : "top-14 bottom-4")
      }
      style={
        compact
          ? {
              top: anchorTop ?? 80,
              height: "min(62vh, 520px)",
            }
          : undefined
      }
    >
      {/* 头部：上下文 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-[11px] text-white shadow-sm">
          ✦
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-slate-700">
            {selection && compact ? "改进这段" : "AI 简历顾问"}
          </p>
          <p className="truncate text-[10.5px] text-slate-400">{contextLabel}</p>
        </div>
        {selection && compact && (
          <button
            type="button"
            onClick={detach}
            className="rounded-full px-2 py-0.5 text-[10.5px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            title="不聊这段了，转自由对话"
          >
            转自由聊
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 active:scale-90"
          title="关闭（Esc）"
        >
          ✕
        </button>
      </div>

      {/* 消息流 */}
      <div ref={listRef} className="thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !thinking && (
          selection && compact ? (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
              <span className="text-[12px] leading-relaxed text-slate-400">
                说说哪里不满意，比如「太啰嗦」「换个角度」「更有冲击力」
              </span>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-1 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-sky-400 text-[18px] text-white shadow-[0_4px_16px_rgba(99,102,241,0.35)]">
                ✦
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-slate-700">跟我聊聊，让我更懂你</p>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400">
                  你说的每段经历我都会沉淀进
                  <span className="font-medium text-violet-500">经历库</span>
                  ，写简历时自动引用
                  <br />
                  —— 聊得越多，我越能写出像你的简历
                </p>
              </div>
              <div className="mt-0.5 flex w-full max-w-[290px] flex-col gap-1.5">
                {SUGGESTIONS.map((sg) => (
                  <button
                    key={sg}
                    type="button"
                    onClick={() => setInput(sg)}
                    className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-left text-[11.5px] text-slate-500 transition-all duration-150 hover:border-violet-300 hover:bg-violet-50/70 hover:text-violet-600 active:scale-[0.98]"
                  >
                    {sg}
                  </button>
                ))}
              </div>
            </div>
          )
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-800 px-3.5 py-2 text-[12.5px] leading-relaxed text-white shadow-sm">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={i} className="space-y-2">
              {m.text && (
                <p
                  className={
                    "whitespace-pre-wrap rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2 text-[12.5px] leading-relaxed " +
                    (m.error ? "text-rose-500" : "text-slate-700")
                  }
                >
                  {m.text}
                </p>
              )}
              {/* 挖掘到的经历 → 确认后存入经历库 */}
              {m.exp && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50/70 px-3.5 py-2.5">
                  <p className="text-[10.5px] font-medium text-violet-500">✦ 检测到一段新经历</p>
                  <p className="mt-1 text-[12.5px] font-semibold text-slate-800">
                    {m.exp.company}
                    {m.exp.project ? ` · ${m.exp.project}` : ""}
                  </p>
                  {m.exp.summary && (
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">{m.exp.summary}</p>
                  )}
                  {m.expSaved ? (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-[10.5px] font-medium text-violet-600">
                      ✓ 已存入经历库
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        addExperience({ company: m.exp!.company, project: m.exp!.project, summary: m.exp!.summary });
                        setMessages((prev) => prev.map((mm, i) => (i === messages.indexOf(m) ? { ...mm, expSaved: true } : mm)));
                      }}
                      className="mt-2 rounded-full bg-gradient-to-r from-violet-500 to-sky-400 px-3 py-1 text-[11px] font-medium text-white shadow-sm transition-all hover:brightness-110 active:scale-95"
                    >
                      存入经历库
                    </button>
                  )}
                </div>
              )}
              {m.candidates?.map((c, ci) => (
                <div
                  key={ci}
                  className={
                    "group rounded-2xl border px-3.5 py-2.5 transition-all duration-200 " +
                    (m.appliedIndex === ci
                      ? "border-emerald-300 bg-emerald-50/80"
                      : "border-slate-200 bg-white/90 hover:border-sky-300 hover:shadow-[0_2px_12px_rgba(14,165,233,0.1)]")
                  }
                >
                  {selection?.level === "bullet" && selection.bulletText && (
                    <p className="mb-1.5 line-through decoration-slate-300 text-[11px] leading-relaxed text-slate-400">
                      {selection.bulletText.slice(0, 50)}
                      {selection.bulletText.length > 50 ? "…" : ""}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-800">{c.text}</p>
                  {c.reason && (
                    <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-[10.5px] leading-relaxed text-slate-400">
                      {c.reason}
                    </p>
                  )}
                  {m.appliedIndex === ci ? (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10.5px] font-medium text-emerald-600">
                      ✓ 已应用
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={m.appliedIndex != null}
                      onClick={() => applyCandidate(ci, c.text ?? "")}
                      className="mt-2 rounded-full bg-slate-800 px-3 py-1 text-[11px] font-medium text-white opacity-0 transition-all duration-150 hover:bg-slate-700 group-hover:opacity-100 active:scale-95 disabled:opacity-30"
                    >
                      应用
                    </button>
                  )}
                </div>
              ))}
            </div>
          ),
        )}

        {/* 思考中：分阶段随机话术，每秒轮换 */}
        {thinking && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-slate-100 px-3.5 py-2.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
            </span>
            <span key={thinkingLine} className="animate-[thinking-fade_400ms_ease-out] text-[12px] text-slate-500">
              {thinkingLine}
            </span>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="shrink-0 border-t border-slate-100 p-2.5">
        <div className="flex items-end gap-2 rounded-2xl bg-white p-1.5 shadow-inner ring-1 ring-slate-200/70 transition-shadow focus-within:ring-2 focus-within:ring-sky-300/60">
          <textarea
            value={input}
            rows={compact ? 2 : 3}
            placeholder={placeholder}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-32 min-h-[52px] flex-1 resize-none bg-transparent px-2 py-2 text-[12.5px] leading-relaxed text-slate-700 outline-none placeholder:text-slate-300"
          />
          <button
            type="button"
            onClick={submit}
            disabled={thinking || !input.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-400 text-white shadow-md transition-all duration-150 hover:brightness-110 active:scale-90 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
            title="发送（Enter）"
          >
            ↑
          </button>
        </div>
        <p className="mt-1 text-center text-[9.5px] text-slate-300">Enter 发送 · Shift+Enter 换行</p>
      </div>
    </aside>
  );
}
