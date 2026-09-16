/* ============================================================================
 * 模型调用通道
 *
 * 两种部署形态，同一个接口：
 *   - 本地开发：打到同源 /api/llm，由 Vite 开发服务器转发并注入 Authorization
 *   - 线上部署（GitHub Pages 等纯静态托管）：直接调部署好的 Worker
 *     （见 worker/），Worker 保管 API key 并校验邀请码
 *
 * 邀请码存在 localStorage，随请求头 X-Invite-Code 发送；Worker 返回 401 时
 * 前端弹输入框让用户填写。API key 永远不进前端构建产物。
 * ========================================================================== */

export type LlmErrorKind =
  | "no-key"
  | "needs-invite"
  | "auth"
  | "rate-limit"
  | "timeout"
  | "network"
  | "server"
  | "bad-response"
  | "unknown";

/** 默认的线上代理。自部署者可用 VITE_LLM_PROXY_URL 覆盖成自己的 Worker 地址。 */
const DEFAULT_REMOTE_ENDPOINT = "https://resume-ai-llm.xiaodai-accounting.workers.dev/api/llm";

const ENDPOINT: string =
  import.meta.env.VITE_LLM_PROXY_URL ?? (import.meta.env.DEV ? "/api/llm" : DEFAULT_REMOTE_ENDPOINT);

const INVITE_KEY = "resume-ai/invite-code";

export function getInviteCode(): string {
  try {
    return localStorage.getItem(INVITE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setInviteCode(code: string): void {
  try {
    localStorage.setItem(INVITE_KEY, code.trim());
  } catch {
    /* 隐私模式存不进去就只在本次会话生效 */
  }
}

export class LlmError extends Error {
  readonly kind: LlmErrorKind;
  readonly detail: string;

  constructor(kind: LlmErrorKind, message: string, detail = "") {
    super(message);
    this.name = "LlmError";
    this.kind = kind;
    this.detail = detail;
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// M3 会先思考再作答，实测一次话术生成要 23~47 秒；再给代理层的自动重试
// 留出余量，所以放到 3 分钟。
const TIMEOUT_MS = 180_000;
const TIMEOUT_SECONDS = TIMEOUT_MS / 1000;

/** 是否已经具备调用条件：本地有 key，或走远程 Worker（key 在服务端） */
export function hasLlmKey(): boolean {
  if (import.meta.env.DEV) return __HAS_LLM_KEY__;
  return true;
}

interface RawResponse {
  choices?: {
    message?: {
      content?: string;
      /** MiniMax reasoning_split: true 时，思考过程放这里 */
      reasoning_details?: string | { text?: string }[];
    };
    text?: string;
    finish_reason?: string;
  }[];
  reply?: string;
  output_text?: string;
  base_resp?: { status_code?: number; status_msg?: string };
}

/**
 * MiniMax M2 这类推理模型会把思考过程用 <think> 包起来一起塞在 content 里。
 * 必须剥掉，否则解析 JSON 时会拿到一堆思考文字。
 * 被 max_tokens 截断时可能只有开标签没有闭标签，那种残段也一并清掉。
 */
export function stripThinking(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "")
    .replace(/<think(?:ing)?>[\s\S]*$/i, "")
    .trim();
}

function extractContent(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const d = data as RawResponse;

  const choice = d.choices?.[0];
  if (choice) {
    const content = choice.message?.content;
    if (typeof content === "string" && content.trim()) return stripThinking(content);
    if (typeof choice.text === "string" && choice.text.trim()) return stripThinking(choice.text);
  }
  if (typeof d.reply === "string" && d.reply.trim()) return stripThinking(d.reply);
  if (typeof d.output_text === "string" && d.output_text.trim()) return stripThinking(d.output_text);

  return "";
}

/** 提取思考过程（reasoning_details） */
function extractReasoning(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const d = data as RawResponse;
  const rd = d.choices?.[0]?.message?.reasoning_details;
  if (typeof rd === "string") return rd.trim();
  if (Array.isArray(rd)) {
    return rd.map((x) => (typeof x === "string" ? x : x?.text ?? "")).join("").trim();
  }
  return "";
}

/** 把供应商的报错信息尽量读出来，便于定位问题 */
function readApiError(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const d = data as RawResponse & { error?: { message?: string } };
  if (d.error?.message) return d.error.message;
  if (d.base_resp?.status_msg) return d.base_resp.status_msg;
  return "";
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

async function doChat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<{ content: string; reasoning: string }> {
  if (!hasLlmKey()) {
    throw new LlmError(
      "no-key",
      "还没有配置模型 API key",
      "在项目根目录新建 .env.local，写入 MINIMAX_API_KEY=你的key，然后重启服务。",
    );
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const invite = getInviteCode();
    if (invite) headers["X-Invite-Code"] = invite;

    res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages,
        temperature: opts.temperature ?? 0.7,
        // 推理模型的思考过程也计入 completion_tokens，而且长度不受控。
        // M3 实测一次话术生成要烧掉 3.5k~8k token，额度给足才不会让思考
        // 把预算烧光（那样 content 会直接变成空字符串）。
        max_tokens: opts.maxTokens ?? 16000,
        stream: false,
        // 把思考挪到 reasoning_details 字段，content 里只留正式答案。
        // MiniMax M2.x/M3 都支持；其他厂商会忽略未知字段，没有副作用。
        reasoning_split: true,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new LlmError("timeout", "模型响应超时，稍后重试", `超过 ${TIMEOUT_SECONDS} 秒没有返回。`);
    }
    throw new LlmError("network", "连不上模型服务", String(err));
  } finally {
    window.clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text.slice(0, 400);
    try {
      detail = readApiError(JSON.parse(text)) || detail;
    } catch {
      /* 不是 JSON，保留原始文本 */
    }

    if (res.status === 401 || res.status === 403) {
      // 远程 Worker 的 401 = 邀请码无效；本地 dev 代理的 401 = key 问题。
      // 用 detail 内容区分不靠谱，直接按部署形态判断。
      if (!import.meta.env.DEV) {
        throw new LlmError("needs-invite", "邀请码无效", detail);
      }
      throw new LlmError("auth", "API key 无效或没有权限", detail);
    }
    if (res.status === 429) {
      throw new LlmError("rate-limit", "调用太频繁或额度用完了", detail);
    }
    if (res.status >= 500) {
      throw new LlmError("server", "模型服务出错", detail);
    }
    throw new LlmError("unknown", `请求失败（HTTP ${res.status}）`, detail);
  }

  const data: unknown = await res.json().catch(() => null);
  const content = extractContent(data);
  const reasoning = extractReasoning(data);
  if (!content) {
    const finishReason = (data as RawResponse | null)?.choices?.[0]?.finish_reason;
    const truncated = finishReason === "length";

    throw new LlmError(
      "bad-response",
      truncated ? "模型思考过长，答案被截断了" : "模型没有返回内容",
      truncated
        ? "再点一次「重新生成」通常就好了。如果反复出现，可以只粘贴岗位描述里的「任职要求」部分，把输入缩短一些。"
        : JSON.stringify(data).slice(0, 400),
    );
  }
  return { content, reasoning };
}

/** 兼容旧调用：只返回正文 */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  return (await doChat(messages, opts)).content;
}

/** 完整返回：正文 + 思考过程（reasoning_split 分离出来的深度思考） */
export async function chatFull(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<{ content: string; reasoning: string }> {
  return doChat(messages, opts);
}
