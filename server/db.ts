/* ============================================================================
 * 数据库：Upstash Redis（Vercel Marketplace 开通，免费档）
 *
 * 直接走 Upstash 的 REST 接口，不引 SDK：middleware 和函数里都能用，一条命令
 * 就是一个 JSON 数组，比如 ["HGETALL", "u:abc"]。
 * 环境变量由 Vercel 集成自动注入（KV_REST_API_URL / KV_REST_API_TOKEN），
 * 自己接 Upstash 的话用 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 也行。
 * ========================================================================== */

export type Cmd = (string | number)[];

function conn(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

export function dbConfigured(): boolean {
  return conn() != null;
}

async function post(path: string, body: unknown): Promise<unknown> {
  const c = conn();
  if (!c) throw new Error("没有配置数据库（KV_REST_API_URL / KV_REST_API_TOKEN）");
  const res = await fetch(c.url + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok && !Array.isArray(data)) {
    throw new Error(`数据库请求失败（HTTP ${res.status}）：${(data as { error?: string } | null)?.error ?? ""}`);
  }
  return data;
}

/** 执行一条命令 */
export async function redis<T = unknown>(...cmd: Cmd): Promise<T> {
  const data = (await post("", cmd.map(String))) as { result?: T; error?: string };
  if (data?.error) throw new Error(data.error);
  return data.result as T;
}

/** 一次发多条命令（不是事务，只省往返） */
export async function pipeline(cmds: Cmd[]): Promise<unknown[]> {
  if (!cmds.length) return [];
  const data = (await post("/pipeline", cmds.map((c) => c.map(String)))) as { result?: unknown; error?: string }[];
  return data.map((r) => {
    if (r?.error) throw new Error(r.error);
    return r?.result;
  });
}

/** HGETALL 返回的是 [k1, v1, k2, v2…]，转成对象 */
export function toHash(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i + 1 < raw.length; i += 2) out[String(raw[i])] = String(raw[i + 1]);
  return out;
}
