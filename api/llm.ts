/* ============================================================================
 * Vercel 上的模型代理：POST /api/llm
 *
 * 与本地开发时 vite.config.ts 里的 llm-proxy 行为一致：前端只请求同源地址，
 * 这里注入 Authorization 再转发。站长的 API key 只存在 Vercel 的环境变量里
 * （MINIMAX_API_KEY，Sensitive），永远不进前端产物。
 *
 * 按账号计费（server/accounts.ts）：
 *   - 用站长的模型：调用前看额度还有没有剩，调用后按 usage.total_tokens 扣
 *   - 用户填了自己的模型密钥：转发到他的接口，不扣额度，只记用量
 *   - 站长自己：不限额度
 * 模型名、max_tokens 由这里说了算，客户端只能传对话内容和温度。
 * ========================================================================== */

import { charge, openLlm, type Account } from "../server/accounts.js";
import { fail, json } from "../server/http.js";
import { currentAccount } from "../server/siteAuth.js";

const MAX_TOKENS = 16_000;

const RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

function errorCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  if (typeof e?.code === "string") return e.code;
  if (typeof e?.cause?.code === "string") return e.cause.code;
  return undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 走代理链路时偶发连接被重置，退避重试即可恢复（同 vite.config.ts） */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, init);
      if (attempt < MAX_ATTEMPTS && (res.status >= 500 || res.status === 429)) {
        await res.text().catch(() => "");
        await sleep(RETRY_BASE_DELAY_MS * 3 ** (attempt - 1));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      const code = errorCode(err);
      if (attempt < MAX_ATTEMPTS && code && RETRYABLE_CODES.has(code)) {
        await sleep(RETRY_BASE_DELAY_MS * 3 ** (attempt - 1));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

interface Target {
  url: string;
  apiKey: string;
  model: string;
  own: boolean;
}

function pickTarget(acc: Account): Target | Response {
  if (acc.llm) {
    const own = openLlm(acc.llm);
    if (!own) return fail(400, "你保存的模型密钥读不出来了，在头像菜单里重新填一次", "byok");
    return { url: own.baseUrl.replace(/\/+$/, ""), apiKey: own.apiKey, model: own.model, own: true };
  }
  const apiKey = process.env.MINIMAX_API_KEY ?? "";
  if (!apiKey) return fail(500, "服务端没有配置 MINIMAX_API_KEY", "upstream");
  if (acc.role !== "owner" && acc.quota <= 0) {
    return fail(402, "AI 额度用完了：找站长加额度，或在头像菜单里填自己的模型密钥", "quota");
  }
  return {
    url: (process.env.MINIMAX_BASE_URL ?? "https://api.minimaxi.com/v1").replace(/\/+$/, ""),
    apiKey,
    model: process.env.MINIMAX_MODEL ?? "MiniMax-M3",
    own: false,
  };
}

/** 只转发认识的字段；模型和 max_tokens 由服务端定 */
function buildPayload(body: Record<string, unknown>, t: Target): Record<string, unknown> | null {
  if (!Array.isArray(body.messages) || !body.messages.length) return null;
  const payload: Record<string, unknown> = {
    model: t.model,
    messages: body.messages,
    max_tokens: Math.min(Math.max(Math.round(Number(body.max_tokens) || MAX_TOKENS), 1), MAX_TOKENS),
    stream: false,
  };
  if (typeof body.temperature === "number") payload.temperature = Math.min(Math.max(body.temperature, 0), 1.5);
  if (typeof body.top_p === "number") payload.top_p = body.top_p;
  // MiniMax 专有字段：别的厂商（比如 OpenAI）遇到不认识的参数会直接报 400
  if (body.reasoning_split && /minimax/i.test(t.url)) payload.reasoning_split = true;
  return payload;
}

function upstreamMessage(text: string): string {
  try {
    const d = JSON.parse(text) as { error?: { message?: string }; base_resp?: { status_msg?: string } };
    return d.error?.message ?? d.base_resp?.status_msg ?? text.slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}

/** 上游报错翻译成用户看得懂的话：分清是「你的密钥」还是「站长的密钥」出了问题 */
function upstreamError(status: number, text: string, own: boolean): Response {
  const detail = upstreamMessage(text);
  const err = (s: number, message: string, code: string) => json(s, { error: { message, code, detail } });
  if (own) {
    if (status === 401 || status === 403) return err(400, "你填的模型密钥无效或没有权限", "byok");
    if (status === 402) return err(400, "你的模型账户余额不足", "byok");
    if (status === 404) return err(400, "你填的接口地址或模型名不对", "byok");
    if (status === 400) return err(400, "你的模型服务拒绝了这次请求", "byok");
  } else {
    if (status === 401 || status === 403) return err(502, "站长的模型密钥出问题了，请联系站长", "upstream");
    if (status === 402) return err(502, "站长的模型账户欠费了，请联系站长", "upstream");
  }
  if (status === 429) return err(429, "模型服务限流了，稍等一会儿再试", "rate-limit");
  return err(status >= 500 ? 502 : status, `模型服务出错（HTTP ${status}）`, "upstream");
}

/** 模型没返回 usage 时粗估：中文大约一个字一个 token */
function estimateTokens(payload: Record<string, unknown>, text: string): number {
  return Math.ceil((JSON.stringify(payload.messages).length + text.length) * 0.8);
}

export async function POST(request: Request): Promise<Response> {
  const acc = await currentAccount(request);
  if (!acc) return fail(401, "登录已失效：刷新页面重新登录", "auth");

  const target = pickTarget(acc);
  if (target instanceof Response) return target;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail(400, "请求体不是合法 JSON", "bad-request");
  }
  const payload = buildPayload(body ?? {}, target);
  if (!payload) return fail(400, "缺少 messages", "bad-request");

  let upstream: Response;
  try {
    upstream = await fetchWithRetry(`${target.url}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${target.apiKey}` },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return json(502, {
      error: {
        message: target.own ? "连不上你填的模型接口" : "转发到模型服务失败",
        code: target.own ? "byok" : "upstream",
        detail: err instanceof Error ? err.message : String(err),
      },
    });
  }

  const text = await upstream.text();
  if (!upstream.ok) return upstreamError(upstream.status, text, target.own);

  // 记账：失败只记日志，不影响把结果交给用户
  const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  try {
    const data = JSON.parse(text) as {
      usage?: { total_tokens?: number };
      choices?: { message?: { content?: string } }[];
      base_resp?: { status_code?: number };
    };
    const failed = (data.base_resp?.status_code ?? 0) !== 0 || !data.choices?.length;
    const tokens = Number(data.usage?.total_tokens) || (failed ? 0 : estimateTokens(payload, text));
    if (tokens > 0) {
      const left = await charge(acc, tokens, target.own);
      if (!target.own && acc.role !== "owner") headers["X-Ai-Quota"] = String(left);
    }
  } catch (err) {
    console.error("[llm] 记账失败", acc.id, err);
  }
  return new Response(text, { status: 200, headers });
}
