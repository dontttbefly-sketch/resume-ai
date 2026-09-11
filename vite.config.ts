import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/* ============================================================================
 * 带重试的上游请求
 *
 * 走代理/TUN 环境时，到模型服务的连接偶发被重置（ECONNRESET），实测约
 * 每 8 次出现 1 次，失败时耗时固定在 5 秒左右——像是中间设备主动断链，
 * 与请求本身无关。这类错误重试即可恢复，所以在这里做退避重试，
 * 让前端完全感知不到。
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 取出错误链里的系统错误码，用于判断是否值得重试 */
function errorCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  const direct = e?.code;
  const nested = e?.cause?.code;
  if (typeof direct === "string") return direct;
  if (typeof nested === "string") return nested;
  return undefined;
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, init);

      // 上游 5xx / 429 也当作可重试（但已经把响应读到手里，得先排空再重试）
      if (attempt < MAX_ATTEMPTS && (res.status >= 500 || res.status === 429)) {
        console.warn(`[llm-proxy] 上游返回 ${res.status}，第 ${attempt} 次尝试，准备重试`);
        await res.text().catch(() => "");
        await sleep(RETRY_BASE_DELAY_MS * 3 ** (attempt - 1));
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      const code = errorCode(err);

      if (attempt < MAX_ATTEMPTS && code && RETRYABLE_CODES.has(code)) {
        const wait = RETRY_BASE_DELAY_MS * 3 ** (attempt - 1);
        console.warn(`[llm-proxy] 连接被重置（${code}），第 ${attempt} 次尝试，${wait}ms 后重试`);
        await sleep(wait);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

/* ============================================================================
 * 模型接口代理
 *
 * 前端只请求同源的 /api/llm，由这里转发到 MiniMax 并注入 Authorization。
 * 这样 API key 只存在于开发服务器进程里，永远不会出现在前端代码或构建产物中。
 * ========================================================================== */

function llmProxy(apiKey: string, baseUrl: string, defaultModel: string): Plugin {
  return {
    name: "llm-proxy",
    configureServer(server) {
      server.middlewares.use("/api/llm", (req, res) => {
        void (async () => {
          res.setHeader("Content-Type", "application/json; charset=utf-8");

          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: { message: "只接受 POST" } }));
            return;
          }

          if (!apiKey) {
            res.statusCode = 500;
            res.end(
              JSON.stringify({
                error: {
                  message: "没有读到 API key，请在项目根目录的 .env.local 里设置 MINIMAX_API_KEY",
                },
              }),
            );
            return;
          }

          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const raw = Buffer.concat(chunks).toString("utf8");
            const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
            const payload = JSON.stringify({ ...body, model: body.model ?? defaultModel });

            const upstream = await fetchWithRetry(
              `${baseUrl}/chat/completions`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                },
                body: payload,
              },
            );

            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.end(text);
          } catch (err) {
            res.statusCode = 502;
            res.end(
              JSON.stringify({
                error: {
                  message: "转发到模型服务失败",
                  detail: err instanceof Error ? err.message : String(err),
                },
              }),
            );
          }
        })();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = env.MINIMAX_API_KEY ?? "";
  const baseUrl = (env.MINIMAX_BASE_URL ?? "https://api.minimaxi.com/v1").replace(/\/+$/, "");
  const model = env.MINIMAX_MODEL ?? "MiniMax-M3";

  return {
    plugins: [react(), tailwindcss(), llmProxy(apiKey, baseUrl, model)],
    define: {
      // 只把「有没有配 key」这个布尔值交给前端，key 本身不进前端
      __HAS_LLM_KEY__: JSON.stringify(apiKey.length > 0),
    },
    // GitHub Pages 项目页部署在子路径下（VITE_PAGES_BASE=/resume-ai/），
    // 本地开发不设就是 /
    base: process.env.VITE_PAGES_BASE || "/",
    server: {
      port: 5173,
      strictPort: true,
      open: false,
    },
    build: {
      outDir: "dist",
    },
  };
});
