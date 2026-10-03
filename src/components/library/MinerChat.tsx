/* ============================================================================
 * 经历挖掘：和 AI 聊工作经历，一次一个问题，挖量化结果与技术细节
 * 聊完点「提炼入库」，整段对话会被压成一条结构化经历
 * ========================================================================== */

import { useEffect, useRef, useState } from "react";

import { chat, LlmError, type ChatMessage } from "../../lib/llm";
import { useExperienceStore } from "../../store/useExperienceStore";
import { IconBook, IconSend, IconSpark } from "../icons";
import { Button } from "../kit/Button";
import { ShimmerText } from "../kit/misc";
import { toast } from "../kit/Toast";

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
  "只输出一个 JSON 对象，不要任何解释或多余文字，格式：",
  '{"company":"公司名或项目归属","project":"项目/岗位名","summary":"一段简历化的描述，包含背景、技术动作、量化结果"}',
  "summary 用中文，控制在 80 字内，突出量化数字。严禁编造对话里没出现过的数字和事实。",
].join("\n");

export function MinerChat({ onExtracted }: { onExtracted: (id: string) => void }) {
  const items = useExperienceStore((s) => s.items);
  const addItem = useExperienceStore((s) => s.addItem);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"" | "chat" | "extract">("");
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const librarySummary = items.map((i) => `- ${i.company}｜${i.project}：${i.summary}`).join("\n");

  async function send() {
    const content = input.trim();
    if (!content || busy) return;
    setInput("");
    setError("");
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setBusy("chat");
    try {
      const reply = await chat([{ role: "system", content: minerSystem(librarySummary) }, ...next], { temperature: 0.6 });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof LlmError ? err.message : "调用失败，请重试");
    } finally {
      setBusy("");
    }
  }

  async function extract() {
    if (messages.length < 2 || busy) return;
    setBusy("extract");
    setError("");
    try {
      const dialog = messages.map((m) => `${m.role === "user" ? "用户" : "AI"}：${m.content}`).join("\n");
      const raw = await chat(
        [
          { role: "system", content: EXTRACT_SYSTEM },
          { role: "user", content: dialog },
        ],
        { temperature: 0.2 },
      );
      const json = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(json.slice(json.indexOf("{"), json.lastIndexOf("}") + 1)) as {
        company?: string;
        project?: string;
        summary?: string;
      };
      if (!parsed.summary) throw new Error("提炼结果缺 summary");
      const id = addItem({ company: parsed.company || "未标注", project: parsed.project || "未标注", summary: parsed.summary });
      onExtracted(id);
      toast("已提炼入库", "success");
    } catch {
      setError("提炼失败，再试一次（或手动在左边新增一条）");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="glass flex h-[calc(100vh-124px)] min-h-[480px] flex-col overflow-hidden lg:sticky lg:top-[92px]" style={{ ["--r" as string]: "var(--r-panel)" }}>
      <div className="flex shrink-0 items-center gap-2.5 px-5 pb-3 pt-5">
        <span className="solid flex h-8 w-8 items-center justify-center rounded-full">
          <IconSpark className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-fg">经历挖掘</p>
          <p className="text-[11.5px] text-fg-4">像朋友聊天一样，一次只问一个问题</p>
        </div>
        <Button
          size="sm"
          pill
          variant={messages.length >= 2 ? "primary" : "secondary"}
          disabled={messages.length < 2 || !!busy}
          onClick={() => void extract()}
          icon={<IconBook className="h-3.5 w-3.5" />}
        >
          {busy === "extract" ? "提炼中…" : "提炼入库"}
        </Button>
      </div>

      <div ref={listRef} className="thin-scroll fade-y min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
        {messages.length === 0 && (
          <div className="anim-rise flex min-h-full flex-col justify-center pb-10">
            <p className="text-[22px] font-semibold leading-[1.3] tracking-[-0.025em] text-fg">
              聊一段你做过的事，
              <br />
              我来追问细节。
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-fg-3">
              做了什么、怎么做的、结果是多少。聊完点右上角「提炼入库」，它会变成左边的一张经历卡，之后 AI 写简历只从这里取事实。
            </p>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="anim-rise flex justify-end">
              <p className="solid max-w-[86%] whitespace-pre-wrap rounded-[18px] rounded-br-[6px] px-3.5 py-2 text-[13px] leading-relaxed">
                {m.content}
              </p>
            </div>
          ) : (
            <p key={i} className="anim-rise whitespace-pre-wrap text-[13px] leading-[1.75] text-fg-2">
              {m.content}
            </p>
          ),
        )}
        {busy === "chat" && (
          <div className="flex items-center gap-2.5">
            <span className="breathe h-2 w-2 rounded-full bg-fg" />
            <ShimmerText className="text-[13px] font-medium">在想下一个问题…</ShimmerText>
          </div>
        )}
        {error && <p className="anim-fade text-[12.5px] text-danger">{error}</p>}
      </div>

      <div className="shrink-0 px-3 pb-3">
        <div className="well flex items-end gap-2 p-1.5" style={{ borderRadius: 20 }}>
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="说说你的经历，或回答我的问题…"
            className="thin-scroll max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2.5 text-[13px] leading-[1.55] text-fg outline-none placeholder:text-fg-4"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!!busy || !input.trim()}
            aria-label="发送"
            className="solid press flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-25"
          >
            <IconSend className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
