/* ============================================================================
 * 用户管理（只有站长能调）：GET /api/admin · POST /api/admin
 *
 *   GET                       全部账号 + 站点设置
 *   GET ?grants=<id>          某人的额度变动记录
 *   POST { action: "grant", id, delta, note }       加 / 减额度（token，可为负）
 *   POST { action: "disable", id, disabled }        停用 / 恢复（停用后立刻登不进、调不了 AI）
 *   POST { action: "reset-password", id }           重置成临时密码，返回给站长转告
 *   POST { action: "note", id, note }               站长备注
 *   POST { action: "config", signupTokens }         新用户赠送多少 token
 * ========================================================================== */

import {
  bumpSession,
  getAccount,
  getConfig,
  grant,
  listAccounts,
  listGrants,
  setConfig,
  setFields,
  setPassword,
  tempPassword,
  type Account,
} from "../server/accounts.js";
import { fail, json, readJson, str } from "../server/http.js";
import { currentAccount } from "../server/siteAuth.js";

function view(acc: Account) {
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
    last: acc.last,
    disabled: acc.disabled,
    note: acc.note,
    ownLlm: !!acc.llm,
  };
}

async function owner(request: Request): Promise<Account | Response> {
  const acc = await currentAccount(request);
  if (!acc) return fail(401, "登录已失效：刷新页面重新登录", "auth");
  if (acc.role !== "owner") return fail(403, "只有站长能管理用户", "forbidden");
  return acc;
}

export async function GET(request: Request): Promise<Response> {
  const me = await owner(request);
  if (me instanceof Response) return me;

  const id = new URL(request.url).searchParams.get("grants");
  if (id) return json(200, { grants: await listGrants(id) });

  const [users, config] = await Promise.all([listAccounts(), getConfig()]);
  return json(200, { users: users.map(view), config });
}

const MAX_TOKENS_PER_OP = 1_000_000_000;

export async function POST(request: Request): Promise<Response> {
  const me = await owner(request);
  if (me instanceof Response) return me;
  const body = await readJson(request);

  if (body.action === "config") {
    const n = Math.round(Number(body.signupTokens));
    if (!Number.isFinite(n) || n < 0 || n > MAX_TOKENS_PER_OP) return fail(400, "赠送额度要是 0 或正整数");
    await setConfig({ signupTokens: n });
    return json(200, { config: await getConfig() });
  }

  const id = str(body.id, 40);
  const target = id ? await getAccount(id) : null;
  if (!target) return fail(404, "没有这个用户");

  switch (body.action) {
    case "grant": {
      const delta = Math.round(Number(body.delta));
      if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > MAX_TOKENS_PER_OP) return fail(400, "额度要是非零整数");
      await grant(target.id, delta, str(body.note, 60), me.nick || me.email);
      break;
    }
    case "disable": {
      if (target.id === me.id) return fail(400, "不能停用自己");
      await setFields(target.id, { disabled: body.disabled ? 1 : 0 });
      await bumpSession(target.id);
      break;
    }
    case "reset-password": {
      const password = tempPassword();
      await setPassword(target.id, password);
      return json(200, { user: view((await getAccount(target.id))!), password });
    }
    case "note": {
      await setFields(target.id, { note: str(body.note, 120) });
      break;
    }
    default:
      return fail(400, "不认识的操作");
  }
  return json(200, { user: view((await getAccount(target.id))!) });
}
