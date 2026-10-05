/* ============================================================================
 * 我的账号：GET /api/me（额度、个人密钥、自带模型）· POST /api/me（改设置）
 *
 *   { action: "set-llm", baseUrl, model, apiKey }  填自己的模型密钥（先试调一次，能用才存）
 *   { action: "clear-llm" }                        改回用站长的模型（扣额度）
 *   { action: "password", old, next }              改密码（其他设备的登录随之失效）
 * ========================================================================== */

import {
  checkBaseUrl,
  checkPassword,
  openLlm,
  sealLlm,
  setFields,
  setPassword,
  verifyPassword,
  type Account,
  type OwnLlm,
} from "../server/accounts.js";
import { fail, json, readJson, str } from "../server/http.js";
import { currentAccount, sessionCookie } from "../server/siteAuth.js";

function view(acc: Account) {
  const own = openLlm(acc.llm);
  return {
    id: acc.id,
    email: acc.email,
    nick: acc.nick,
    role: acc.role,
    quota: acc.quota,
    used: acc.used,
    byokUsed: acc.byokUsed,
    calls: acc.calls,
    created: acc.created,
    key: acc.key,
    ownLlm: own ? { baseUrl: own.baseUrl, model: own.model, keyTail: own.apiKey.slice(-4) } : null,
  };
}

/** 存之前试调一次：地址、模型名、密钥有一个不对就当场告诉用户 */
async function probe(cfg: OwnLlm): Promise<string | null> {
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: "user", content: "你好" }], max_tokens: 16, stream: false }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) return null;
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) return "密钥无效或没有权限";
    if (res.status === 402) return "这个模型账户余额不足";
    if (res.status === 404) return "接口地址或模型名不对";
    return `模型服务返回 HTTP ${res.status}：${text.slice(0, 160)}`;
  } catch (err) {
    return `连不上这个接口：${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function GET(request: Request): Promise<Response> {
  const acc = await currentAccount(request);
  if (!acc) return fail(401, "登录已失效：刷新页面重新登录", "auth");
  return json(200, view(acc));
}

export async function POST(request: Request): Promise<Response> {
  const acc = await currentAccount(request);
  if (!acc) return fail(401, "登录已失效：刷新页面重新登录", "auth");
  const body = await readJson(request);

  switch (body.action) {
    case "set-llm": {
      const cfg: OwnLlm = { baseUrl: str(body.baseUrl, 300), model: str(body.model, 120), apiKey: str(body.apiKey, 400) };
      if (!cfg.model || !cfg.apiKey) return fail(400, "模型名和密钥都要填");
      const bad = checkBaseUrl(cfg.baseUrl) ?? (await probe(cfg));
      if (bad) return fail(400, bad, "byok");
      const llm = sealLlm(cfg);
      await setFields(acc.id, { llm });
      return json(200, view({ ...acc, llm }));
    }
    case "clear-llm": {
      await setFields(acc.id, { llm: "" });
      return json(200, view({ ...acc, llm: "" }));
    }
    case "password": {
      const old = typeof body.old === "string" ? body.old : "";
      const next = typeof body.next === "string" ? body.next : "";
      if (!(await verifyPassword(old, acc.pw))) return fail(400, "原密码不对");
      const bad = checkPassword(next);
      if (bad) return fail(400, bad);
      const sv = await setPassword(acc.id, next);
      // 当前这台设备换发新 cookie，保持登录
      return json(200, { ok: true }, { "Set-Cookie": sessionCookie({ id: acc.id, sv }) });
    }
    default:
      return fail(400, "不认识的操作");
  }
}
