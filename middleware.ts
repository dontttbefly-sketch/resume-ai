/* ============================================================================
 * 线上版的门禁（Vercel Routing Middleware）：账号登录
 *
 * 拿到链接的人都能用邮箱注册（发验证码，一个邮箱只能注册一次）；
 * 注册送一笔试用 AI 额度，用完找站长加（见 api/admin.ts）。
 * 每个请求（页面、静态资源、/api/*、执行器安装包）都要能认出是谁：
 *   - 浏览器：登录 / 注册 → 签名 cookie（30 天），见 server/siteAuth.ts
 *   - 本机执行器 / 安装命令：请求头 X-Invite-Code 带个人密钥
 * 认不出 → 页面请求返回登录页，接口请求返回 401。在缓存之前执行，静态文件也绕不过。
 *
 * 打开页面、下载执行器、取站长数据时会查库核对账号（停用、改过密码的旧会话进不来）；
 * 静态资源只验 cookie 签名；/api/* 由各接口自己查库。
 *
 * 站长专属：/owner/ 下是站长的私人简历（scripts/build-owner-data.mjs 生成），
 * 只放行站长账号（role = owner，用 pnpm users promote 设置），其他人一律 404。
 *
 * 失败即关闭：SESSION_SECRET 或数据库没配，所有人都进不来；发信没配，注册不了。
 * 本地 pnpm dev 和 GitHub Pages 都不经过这个文件。
 * ========================================================================== */

import { next } from "@vercel/functions";

import {
  checkEmail,
  checkPassword,
  consumeCode,
  createAccount,
  findByEmail,
  issueCode,
  verifyPassword,
} from "./server/accounts.js";
import { dbConfigured, redis } from "./server/db.js";
import { clientIp, json, NO_STORE, readJson, str } from "./server/http.js";
import { loginPage } from "./server/loginPage.js";
import { mailConfigured, sendCode } from "./server/mail.js";
import { CLEAR_COOKIE, currentAccount, personalKey, readSession, sessionCookie } from "./server/siteAuth.js";

export const config = {
  matcher: "/(.*)",
  runtime: "nodejs",
};

/* ------------------------------ 限速 ------------------------------
   计数存在数据库里，跨实例有效 */

async function tooMany(bucket: string, ip: string, max: number, windowSec: number): Promise<boolean> {
  const key = `rl:${bucket}:${ip}`;
  const n = Number(await redis("INCR", key));
  if (n === 1) await redis("EXPIRE", key, windowSec);
  return n > max;
}

function ready(): boolean {
  return dbConfigured() && !!process.env.SESSION_SECRET;
}

/* ------------------------------ 登录 / 注册 ------------------------------ */

async function login(req: Request): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "只接受 POST" });
  if (!ready()) return json(503, { error: "账号服务还没配置好" });
  if (await tooMany("login", clientIp(req), 20, 600)) return json(429, { error: "试太多次了，10 分钟后再来" });

  const body = await readJson(req);
  const email = str(body.email, 100);
  const password = typeof body.password === "string" ? body.password : "";
  const acc = email ? await findByEmail(email) : null;
  if (!acc || !(await verifyPassword(password, acc.pw))) return json(401, { error: "邮箱或密码不对" });
  if (acc.disabled) return json(403, { error: "这个账号已停用，有问题找站长" });
  return json(200, { ok: true, email: acc.email, key: acc.key }, { "Set-Cookie": sessionCookie(acc) });
}

/** 注册第一步：往邮箱发 6 位验证码 */
async function sendRegisterCode(req: Request): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "只接受 POST" });
  if (!ready() || !mailConfigured()) return json(503, { error: "注册服务还没配置好" });

  const email = str((await readJson(req)).email, 100);
  const invalid = checkEmail(email);
  if (invalid) return json(400, { error: invalid });
  if (await findByEmail(email)) return json(409, { error: "这个邮箱已经注册过了，直接登录就行" });
  if (await tooMany("code", clientIp(req), 10, 3600)) return json(429, { error: "发验证码太频繁了，过一小时再来" });

  const code = await issueCode(email);
  if (code === "cooldown") return json(429, { error: "刚发过，1 分钟后再试" });
  try {
    await sendCode(email, code);
  } catch (err) {
    console.error("[mail]", err);
    return json(502, { error: "验证码没发出去，检查一下邮箱地址，或者稍后再试" });
  }
  return json(200, { ok: true });
}

async function register(req: Request): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "只接受 POST" });
  if (!ready()) return json(503, { error: "账号服务还没配置好" });

  const body = await readJson(req);
  const email = str(body.email, 100);
  const code = str(body.code, 12);
  const nick = str(body.nick, 24);
  const password = typeof body.password === "string" ? body.password : "";
  const invalid =
    checkEmail(email) ??
    (code ? null : "填邮箱里收到的验证码") ??
    (nick ? null : "填一个称呼，站长靠它认出你") ??
    checkPassword(password);
  if (invalid) return json(400, { error: invalid });
  if (await tooMany("register", clientIp(req), 5, 3600)) return json(429, { error: "注册太频繁了，过一小时再来" });
  if (!(await consumeCode(email, code))) return json(400, { error: "验证码不对或已过期，重新发一个" });

  const acc = await createAccount({ email, nick, password });
  if (acc === "taken") return json(409, { error: "这个邮箱已经注册过了，直接登录就行" });
  return json(200, { ok: true, email: acc.email, key: acc.key }, { "Set-Cookie": sessionCookie(acc) });
}

function logout(): Response {
  return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": CLEAR_COOKIE, ...NO_STORE } });
}

function showLogin(clearCookie: boolean): Response {
  return new Response(loginPage(), {
    status: 401,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...NO_STORE,
      ...(clearCookie ? { "Set-Cookie": CLEAR_COOKIE } : {}),
    },
  });
}

/** 浏览器打开页面（而不是加载脚本、图片） */
function isNavigation(req: Request, path: string): boolean {
  const mode = req.headers.get("sec-fetch-mode");
  if (mode) return mode === "navigate";
  return path === "/" || path.endsWith(".html") || !/\.[a-z0-9]+$/i.test(path);
}

/* ------------------------------ 门禁 ------------------------------ */

async function gate(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === "/__auth/login") return login(request);
  if (path === "/__auth/register") return register(request);
  if (path === "/__auth/code") return sendRegisterCode(request);
  if (path === "/__auth/logout") return logout();

  // 站长的私人简历：别人（包括其他登录用户）一律当作不存在
  if (path.startsWith("/owner/")) {
    const acc = await currentAccount(request);
    return acc?.role === "owner" ? next() : json(404, { error: "没有这个文件" });
  }

  // 接口：各接口自己查库认人、算额度，这里只挡掉完全没带凭证的
  if (path.startsWith("/api/")) {
    return readSession(request) || personalKey(request) ? next() : json(401, { error: { message: "需要登录", code: "auth" } });
  }

  // 执行器安装包：通常是终端里 curl 带个人密钥来取
  if (path.startsWith("/runner/")) {
    return (await currentAccount(request)) ? next() : json(401, { error: "需要个人密钥：回网页投递页复制安装命令" });
  }

  const session = readSession(request);
  if (!session) return showLogin(false);
  if (isNavigation(request, path)) {
    // 打开页面时核对一次账号：停用了、改过密码，旧 cookie 就进不来
    const acc = await currentAccount(request);
    if (!acc || acc.id !== session.id) return showLogin(true);
  }
  return next();
}

export default async function middleware(request: Request) {
  try {
    return await gate(request);
  } catch (err) {
    // 数据库抖一下别让全站 500：给个明确的提示
    console.error("[middleware]", err);
    return json(503, { error: "账号服务暂时不可用，稍后刷新重试" });
  }
}
