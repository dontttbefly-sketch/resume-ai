/* ============================================================================
 * Vercel 上的模型代理：POST /api/llm
 *
 * 与本地开发时 vite.config.ts 里的 llm-proxy 行为一致：前端只请求同源地址，
 * 这里注入 Authorization 再转发。API key 只存在 Vercel 的环境变量里
 * （MINIMAX_API_KEY，Sensitive），永远不进前端产物。
 *
 * 整个站点在 middleware.ts 的门禁后面，所以这里不再校验邀请码。
 * ========================================================================== */

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

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

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

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.MINIMAX_API_KEY ?? "";
  const baseUrl = (process.env.MINIMAX_BASE_URL ?? "https://api.minimaxi.com/v1").replace(/\/+$/, "");
  const model = process.env.MINIMAX_MODEL ?? "MiniMax-M3";

  if (!apiKey) return json(500, { error: { message: "服务端没有配置 MINIMAX_API_KEY" } });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: { message: "请求体不是合法 JSON" } });
  }

  try {
    const upstream = await fetchWithRetry(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ ...body, model: body.model ?? model }),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return json(502, {
      error: { message: "转发到模型服务失败", detail: err instanceof Error ? err.message : String(err) },
    });
  }
}
