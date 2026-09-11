/* ============================================================================
 * 经历问答面板
 *
 * 左边：和 AI 聊天，一步步挖工作经历（一次一个问题，聚焦量化结果与技术细节）
 * 右边：经历库 —— 已挖出的结构化条目，可一键把当前对话提炼入库
 * ========================================================================== */

import { useEffect, useRef, useState } from "react";

import { chat, LlmError, type ChatMessage } from "../../lib/llm";
import { useExperienceStore } from "../../store/useExperienceStore";
import { Btn } from "../ui";

/** 挖经历的引导词：轻松、一次一问、挖量化结果与技术细节 */
function minerSystem(librarySummary: string): string {
  return [
    "你是「经历挖掘助手」，帮用户梳理工作经历，用于写简历。",
    "目标：一步步挖出每段经历里的 ①具体做了什么（技术细节）②怎么做的 ③量化结果 ④对目标职位有用的技能点。",
    "规则：一次只问一个具体问题，不要一次抛一堆；语气轻松自然像朋友聊天；用户答完后先简短肯定，再追问下一个细节；优先追问还没挖到量化数字的经历。",
    "",
    "已经挖到的经历（不要再重复问，追问这些没覆盖到的细节即可）：",
    librarySummary || "（还没有）",
  ].join("\n");
}

const EXTRACT_SYSTEM = [
  "你是简历经历提炼助手。把下面这段关于工作经历的对话，提炼成一条结构化经历。",
  '只输出一个 JSON 对象，不要任何解释或多余文字，格式：',
  '{"company":"公司名或项目归属","project":"项目/岗位名","summary":"一段简历化的描述，包含背景、技术动作、量化结果"}',
  "summary 用中文，控制在 80 字内，突出量化数字。",
].join("\n");

export function ExperiencePanel() {
  const items = useExperienceStore((s) => s.items);
  const addItem = useExperienceStore((s) => s.addItem);
  const removeItem = useExperienceStore((s) => s.removeItem);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const librarySummary = items
    .map((i) => `- ${i.company}｜${i.project}：${i.summary}`)
    .join("\n");

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");

    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setBusy(true);
    setNotice(null);

    try {
      const reply = await chat([
        { role: "system", content: minerSystem(librarySummary) },
        ...next,
      ]);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      const msg = err instanceof LlmError ? err.message : "调用失败，请重试";
      setNotice(msg);
    } finally {
      setBusy(false);
    }
  }

  async function extractToLibrary() {
    if (messages.length < 2 || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const dialog = messages.map((m) => `${m.role === "user" ? "用户" : "AI"}：${m.content}`).join("\n");
      const raw = await chat([
        { role: "system", content: EXTRACT_SYSTEM },
        { role: "user", content: dialog },
      ]);
      const json = raw.replace(/```json|```/g, "").trim();
      const start = json.indexOf("{");
      const end = json.lastIndexOf("}");
      const parsed = JSON.parse(json.slice(start, end + 1)) as {
        company?: string;
        project?: string;
        summary?: string;
      };
      if (!parsed.summary) throw new Error("提炼结果缺 summary");
      addItem({
        company: parsed.company ?? "未标注",
        project: parsed.project ?? "未标注",
        summary: parsed.summary,
      });
      setNotice("已提炼入库 ✓");
    } catch (err) {
      setNotice("提炼失败，再试一次（或手动把内容写进右侧库）");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* 左侧：聊天区 */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-slate-200">
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="mx-auto mt-16 max-w-sm text-center text-[13px] leading-relaxed text-slate-400">
              <p className="mb-2 text-[15px] font-semibold text-slate-600">聊聊你的工作经历</p>
              我会像朋友一样问你问题，一步步挖出对简历有用的细节（做了什么、怎么做的、有什么数字）。聊完点右侧「提炼入库」。
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-sm bg-brand text-white"
                    : "rounded-bl-sm bg-white text-slate-700 shadow-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-2.5 text-[13px] text-slate-400 shadow-sm">
                思考中…
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white p-3">
          {notice && <p className="mb-2 text-[12px] text-amber-600">{notice}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="说说你的经历，或回答我的问题…（Enter 发送，Shift+Enter 换行）"
              rows={2}
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
            />
            <Btn variant="primary" disabled={busy || !input.trim()} onClick={() => void send()}>
              发送
            </Btn>
          </div>
        </div>
      </div>

      {/* 右侧：经历库 */}
      <div className="flex w-[360px] shrink-0 flex-col border-l border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[13.5px] font-semibold text-slate-700">经历库</p>
            <p className="text-[11px] text-slate-400">写简历时高优先级参考</p>
          </div>
          <Btn variant="outline" disabled={messages.length < 2 || busy} onClick={() => void extractToLibrary()}>
            提炼入库
          </Btn>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
          {items.length === 0 && (
            <p className="px-1 pt-8 text-center text-[12px] leading-relaxed text-slate-400">
              还没有经历。左边聊完点「提炼入库」，经历会结构化沉淀在这里。
            </p>
          )}
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-slate-700">{item.project}</p>
                  <p className="truncate text-[11px] text-slate-400">{item.company}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="shrink-0 rounded px-1 text-[11px] text-slate-300 transition hover:text-rose-500"
                >
                  删除
                </button>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-slate-600">{item.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
