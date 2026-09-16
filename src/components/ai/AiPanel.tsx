/* ============================================================================
 * AI 工作面板（右侧浮动）
 *
 * 状态机：
 *   selection 有值 → 【改进模式】点选了简历的某块，对话即改进指令
 *   selection 空   → 【倾听模式】听用户聊经历，挖掘后建议写入
 *
 * 动效：
 *   - 滑出/收回：transform + opacity，280ms 苹果曲线
 *   - thinking：选区高斯模糊（由 PreviewPanel 联动）+ 面板内文字呼吸轮播
 *   - 应用成功：候选卡变绿 + "已应用"徽标
 * ========================================================================== */

import { useEffect, useRef, useState } from "react";
import { chat, LlmError } from "../../lib/llm";
import { useSelectionStore } from "../../store/useSelectionStore";
import { useResumeStore } from "../../store/useResumeStore";
import { SECTION_MAP, type SectionKey } from "../../data/sections";

interface Candidate {
  text?: string;
  reason?: string;
}

interface Msg {
  role: "user" | "assistant";
  text: string;
  candidates?: Candidate[];
  appliedIndex?: number;
  error?: boolean;
}

const THINKING_STEPS = ["正在思考…", "正在回忆你的经历库…", "找到了几种改法…", "正在打磨文案…", "快好了…"];

const SYSTEM_PROMPT = `你是一位顶级简历优化专家，帮用户改进简历的一个片段。

【简历口径规范（必须遵守）】
- 结论收尾：每条要点的结论/成果放在句尾，用「——」连接
- 厉害但不晦涩：术语配人话，量化数字让外行秒懂
- 成果导向：动词开头（搭建/设计/开发/主导），不写"负责"
- 一句话一条信息，不啰嗦

【输出要求】
只返回 JSON，不要任何其他文字，格式：
{
  "candidates": [
    { "text": "改进后的完整内容", "reason": "一句话说明为什么这么改" },
    { "text": "...", "reason": "..." }
  ]
}
给 2-3 个风格不同的候选。`;

export function AiPanel() {
  const aiOpen = useSelectionStore((s) => s.aiOpen);
  const setAiOpen = useSelectionStore((s) => s.setAiOpen);
  const selection = useSelectionStore((s) => s.selection);
  const thinking = useSelectionStore((s) => s.thinking);
  const setThinking = useSelectionStore((s) => s.setThinking);

  const setBullet = useResumeStore((s) => s.setBullet);
  const sections = useResumeStore((s) => s.sections);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  /* Esc 关闭 */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAiOpen(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [setAiOpen]);

  /* thinking 时文字轮播 */
  useEffect(() => {
    if (!thinking) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, THINKING_STEPS.length - 1)), 6000);
    return () => clearInterval(t);
  }, [thinking]);

  /* 消息滚动到底 */
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  /* 换选区 → 清空对话 */
  useEffect(() => {
    setMessages([]);
  }, [selection?.level, selection?.entryId, selection?.bulletIndex]);

  if (!aiOpen) return null;

  const contextLabel = selection
    ? selection.level === "bullet"
      ? `${selection.sectionLabel} · ${selection.entryLabel} · 第 ${(selection.bulletIndex ?? 0) + 1} 条`
      : selection.level === "entry"
        ? `${selection.sectionLabel} · ${selection.entryLabel}`
        : selection.sectionLabel
    : "";

  async function submit() {
    const feedback = input.trim();
    if (!feedback || thinking) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: feedback }]);
    setThinking(true);

    try {
      let userContent = "";
      if (selection) {
        const secLabel = (SECTION_MAP as Record<string, { label: string }>)[selection.sectionKey]?.label ?? selection.sectionKey;
        if (selection.level === "bullet") {
          userContent = `【模块】${secLabel}\n【条目】${selection.entryLabel}\n【当前这条内容】${selection.bulletText}\n\n【用户反馈】${feedback}`;
        } else if (selection.level === "entry") {
          const entry = sections[selection.sectionKey]?.find((e) => e.id === selection.entryId);
          const bullets = (entry?.values.bullets as string[] | undefined) ?? [];
          userContent = `【模块】${secLabel}\n【条目】${selection.entryLabel}\n【当前全部要点】\n${bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}\n\n【用户反馈】${feedback}`;
        } else {
          userContent = `【模块】${secLabel}（用户想改进整个模块）\n【用户反馈】${feedback}\n\n请给整块改进的建议候选（每个候选为一段完整的要点组合）。`;
        }
      } else {
        userContent = `用户正在聊自己的经历（无选中上下文）：${feedback}\n\n请认真倾听并回应；如果用户透露了值得写进简历的经历，帮他提炼并给出简历化的表述候选。`;
      }

      const reply = await chat(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        { temperature: 0.8 },
      );

      /* 宽松解析 JSON */
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
    } catch (err) {
      const msg =
        err instanceof LlmError ? err.message : err instanceof Error ? err.message : "调用失败";
      setMessages((prev) => [...prev, { role: "assistant", text: `⚠️ ${msg}`, error: true }]);
    } finally {
      setThinking(false);
    }
  }

  function applyCandidate(idx: number, text: string) {
    if (!selection) return;
    if (selection.level === "bullet") {
      setBullet(
        selection.sectionKey as SectionKey,
        selection.entryId!,
        "bullets",
        selection.bulletIndex!,
        text,
      );
    } else if (selection.level === "entry") {
      /* entry 级候选可能是一整段（按行拆为多条要点） */
      const lines = text.split("\n").map((l) => l.replace(/^\d+[.、]\s*/, "").trim()).filter(Boolean);
      const entry = sections[selection.sectionKey]?.find((e) => e.id === selection.entryId);
      const old = ((entry?.values.bullets as string[] | undefined) ?? []).slice();
      lines.forEach((line, i) => {
        if (i < old.length) setBullet(selection.sectionKey as SectionKey, selection.entryId!, "bullets", i, line);
      });
    }
    setMessages((prev) =>
      prev.map((mm, i) => (i === prev.length - 1 ? { ...mm, appliedIndex: idx } : mm)),
    );
  }

  return (
    <aside className="ai-panel no-print fixed bottom-4 right-4 top-16 z-40 flex w-[380px] flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/[0.92] shadow-[0_2px_8px_rgba(15,23,42,0.06),0_12px_40px_rgba(15,23,42,0.14)] backdrop-blur-2xl animate-[ai-slide-in_280ms_cubic-bezier(0.32,0.72,0,1)]">
      {/* 头部：上下文 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-[11px] text-white shadow-sm">
          ✦
        </span>
        <div className="min-w-0 flex-1">
          {selection ? (
            <>
              <p className="truncate text-[13px] font-semibold text-slate-700">改进这段内容</p>
              <p className="truncate text-[11px] text-slate-400">{contextLabel}</p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-slate-700">和 AI 聊聊</p>
              <p className="text-[11px] text-slate-400">说说你的经历，或对简历的想法</p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAiOpen(false)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 active:scale-90"
          title="关闭（Esc）"
        >
          ✕
        </button>
      </div>

      {/* 消息流 */}
      <div ref={listRef} className="thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !thinking && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="text-[13px] text-slate-400">
              {selection
                ? "说说哪里不满意，比如「太啰嗦」「不够有冲击力」「换个角度」"
                : "点击简历的任意段落开始改进，或直接和我聊"}
            </span>
          </div>
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
                    "rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2 text-[12.5px] leading-relaxed " +
                    (m.error ? "text-rose-500" : "text-slate-700")
                  }
                >
                  {m.text}
                </p>
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
                    <p className="mb-1.5 line-through decoration-slate-300 decoration-1 text-[11.5px] leading-relaxed text-slate-400">
                      {selection.bulletText.slice(0, 60)}
                      {selection.bulletText.length > 60 ? "…" : ""}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-800">
                    {c.text}
                  </p>
                  {c.reason && (
                    <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-[11px] leading-relaxed text-slate-400">
                      {c.reason}
                    </p>
                  )}
                  {m.appliedIndex === ci ? (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
                      ✓ 已应用
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={m.appliedIndex != null}
                      onClick={() => applyCandidate(ci, c.text ?? "")}
                      className="mt-2 rounded-full bg-slate-800 px-3.5 py-1.5 text-[11.5px] font-medium text-white opacity-0 transition-all duration-150 hover:bg-slate-700 group-hover:opacity-100 active:scale-95 disabled:opacity-30"
                    >
                      应用这个
                    </button>
                  )}
                </div>
              ))}
            </div>
          ),
        )}

        {thinking && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-slate-100 px-3.5 py-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
            </span>
            <span className="text-[12px] text-slate-500">{THINKING_STEPS[step]}</span>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="shrink-0 border-t border-slate-100 p-3">
        <div className="flex items-end gap-2 rounded-2xl bg-white/90 p-1.5 shadow-inner ring-1 ring-slate-200/70 focus-within:ring-2 focus-within:ring-sky-300/60">
          <textarea
            value={input}
            rows={2}
            placeholder={selection ? "说说哪里不满意…" : "聊聊你的经历…"}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[12.5px] leading-relaxed text-slate-700 outline-none placeholder:text-slate-300"
          />
          <button
            type="button"
            onClick={submit}
            disabled={thinking || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 text-white shadow-md transition-all duration-150 hover:brightness-110 active:scale-90 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
            title="发送（⌘↵）"
          >
            ↑
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-300">⌘ + Enter 发送</p>
      </div>
    </aside>
  );
}
