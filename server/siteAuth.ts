/* ============================================================================
 * 会话：认出「这个请求是谁」（middleware.ts 与 api/ 下的接口共用）
 *
 *   浏览器：登录 / 注册后发一个签名 cookie（30 天），里面是账号 id 和会话版本
 *   本机执行器、安装命令：请求头 X-Invite-Code 带个人密钥
 *     （头名沿用邀请码时代，已经装好的执行器不用改）
 *
 * cookie 只验签名是「无状态」的，静态资源用这个就够；
 * 要动额度、看私人数据的地方用 currentAccount() 查库：账号停用、
 * 会话版本对不上（改过密码 / 被停用过）都当作没登录。
 *
 *   SESSION_SECRET  会话签名密钥（Vercel 环境变量，Sensitive）
 * ========================================================================== */

import { createHmac, timingSafeEqual } from "node:crypto";

import { findByKey, getAccount, type Account } from "./accounts.js";

export const SESSION_COOKIE = "ra_s";
export const SESSION_DAYS = 30;
const COOKIE_ATTRS = "Path=/; HttpOnly; Secure; SameSite=Lax";

export interface Session {
  id: string;
  sv: number;
}

function eq(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

function sign(payload: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "").update(payload).digest("base64url");
}

export function sessionCookie(acc: Pick<Account, "id" | "sv">): string {
  const payload = Buffer.from(
    JSON.stringify({ u: acc.id, v: acc.sv, e: Date.now() + SESSION_DAYS * 864e5 }),
  ).toString("base64url");
  return `${SESSION_COOKIE}=${payload}.${sign(payload)}; Max-Age=${SESSION_DAYS * 86400}; ${COOKIE_ATTRS}`;
}

export const CLEAR_COOKIE = `${SESSION_COOKIE}=; Max-Age=0; ${COOKIE_ATTRS}`;

function readCookie(req: Request, name: string): string {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return "";
}

/** 只验 cookie 签名和有效期，不查库 */
export function readSession(req: Request): Session | null {
  if (!process.env.SESSION_SECRET) return null;
  const [payload, sig] = readCookie(req, SESSION_COOKIE).split(".");
  if (!payload || !sig || !eq(sig, sign(payload))) return null;
  try {
    const { u, v, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u: unknown; v: unknown; e: unknown };
    if (typeof u !== "string" || typeof v !== "number" || typeof e !== "number" || e < Date.now()) return null;
    return { id: u, sv: v };
  } catch {
    return null;
  }
}

export function personalKey(req: Request): string {
  return req.headers.get("x-invite-code")?.trim() ?? "";
}

/** 查库认人：先看 cookie（核对会话版本），再看个人密钥；停用的账号一律不认 */
export async function currentAccount(req: Request): Promise<Account | null> {
  const s = readSession(req);
  if (s) {
    const acc = await getAccount(s.id);
    if (acc && !acc.disabled && acc.sv === s.sv) return acc;
  }
  const key = personalKey(req);
  if (key) {
    const acc = await findByKey(key);
    if (acc && !acc.disabled) return acc;
  }
  return null;
}
