/* ============================================================================
 * 简历工作台 · AI 代理 Worker
 *
 * 职责（缺一不可，这就是它存在的原因）：
 *   1. 保管模型 API key —— key 只活在环境变量里，前端永远拿不到
 *   2. 校验邀请码 —— 邀请码也只在服务端，前端代码开源了也绕不过
 *   3. 限速 —— 防止邀请码被穷举或被刷爆额度
 *
 * 接口：POST /api/llm，与本地开发时 vite.config.ts 里的 llm-proxy 行为一致，
 * 前端只需换掉 base URL、多带一个 x-invite-code 头。
 *
 * 部署（见 worker/README.md）：
 *   wrangler secret put MINIMAX_API_KEY
 *   wrangler secret put INVITE_CODES        # 逗号分隔，如 "12345,67890"
 *   wrangler deploy
 * ========================================================================== */

export interface Env {
  MINIMAX_API_KEY: string;
  /** 模型服务地址，如 https://api.minimaxi.com/v1 */
  MINIMAX_BASE_URL?: string;
  /** 默认模型名 */
  MINIMAX_MODEL?: string;
  /** 逗号分隔的有效邀请码 */
  INVITE_CODES: string;
  /** 允许的跨域来源，逗号分隔；不填则不限制（有邀请码兜底） */
  ALLOWED_ORIGINS?: string;
  /** 每个邀请码每小时最多几次请求，默认 30 */
  RATE_LIMIT_PER_HOUR?: string;
}

/* ------------------------------ 限速 ------------------------------ */

/** 进程内滑动窗口。单实例内存隔离，防君子足够；真被分布式刷时额度自然会先烧完。 */
const hits = new Map<string, number[]>();
const SWEEP_EVERY_MS = 5 * 60 * 1000;
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  const cutoff = now - 60 * 60 * 1000;
  for (const [key, times] of hits) {
    const kept = times.filter((t) => t > cutoff);
    if (kept.length === 0) hits.delete(key);
    else hits.set(key, kept);
  }
}

function rateLimited(code: string, limit: number): boolean {
  const now = Date.now();
  sweep(now);
  const cutoff = now - 60 * 60 * 1000;
  const times = (hits.get(code) ?? []).filter((t) => t > cutoff);
  if (times.length >= limit) return true;
  times.push(now);
  hits.set(code, times);
  return false;
}

/* ------------------------------ 工具 ------------------------------ */

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // 显式配置了来源就精确匹配，否则放开（有邀请码这层门在，风险可控）
  const allowOrigin =
    allowed.length === 0
      ? origin ?? "*"
      : origin && allowed.includes(origin)
        ? origin
        : allowed[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Invite-Code",
    "Access-Control-Max-Age": "86400",
  };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

const fail = (message: string, detail = "") => ({ error: { message, detail } });

/* ------------------------------ 入口 ------------------------------ */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(env, request.headers.get("Origin"));

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (request.method !== "POST") {
      return json(405, fail("只接受 POST"), cors);
    }

    /* ---- 邀请码：第一道门，也是限速的分组依据 ---- */
    const code = (request.headers.get("X-Invite-Code") ?? "").trim();
    const validCodes = (env.INVITE_CODES ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (validCodes.length === 0) {
      return json(500, fail("服务端没有配置 INVITE_CODES，请联系部署者"), cors);
    }
    if (!code || !validCodes.includes(code)) {
      // 故意不区分「没填」和「填错」，不给穷举者反馈
      return json(401, fail("邀请码无效。向站长要一个正确的邀请码再试。"), cors);
    }

    const limit = Number(env.RATE_LIMIT_PER_HOUR ?? "30");
    if (Number.isFinite(limit) && limit > 0 && rateLimited(code, limit)) {
      return json(429, fail("这个邀请码一小时内用得太多了，休息一下再试。"), cors);
    }

    /* ---- 转发到模型服务 ---- */
    const apiKey = env.MINIMAX_API_KEY;
    if (!apiKey) {
      return json(500, fail("服务端没有配置 MINIMAX_API_KEY，请联系部署者"), cors);
    }

    const baseUrl = (env.MINIMAX_BASE_URL ?? "https://api.minimaxi.com/v1").replace(/\/+$/, "");
    const defaultModel = env.MINIMAX_MODEL ?? "MiniMax-M3";

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json(400, fail("请求体不是合法 JSON"), cors);
    }

    const payload = JSON.stringify({ ...body, model: body.model ?? defaultModel });

    let upstream: Response;
    try {
      upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: payload,
      });
    } catch (err) {
      return json(502, fail("转发到模型服务失败", err instanceof Error ? err.message : String(err)), cors);
    }

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
    });
  },
};
