/* ============================================================================
 * 账号与 AI 额度（存在 Upstash Redis，见 server/db.ts）
 *
 *   u:<id>             账号（hash）：邮箱、称呼、密码哈希、个人密钥、额度…
 *   uemail:<归一邮箱>   → id     注册时 SET NX 占位：一个邮箱只能注册一次
 *   vc:<归一邮箱>       注册验证码（hash：哈希 + 试错次数，10 分钟过期）
 *   vc:cool:<归一邮箱>  发码冷却（60 秒）
 *   ukey:<密钥指纹>     → id     本机执行器、安装命令拿个人密钥认人
 *   users              所有账号（zset，按注册时间）
 *   grants:<id>        额度变动记录（list，最新在前，留 200 条）
 *   cfg                站点设置（hash）：新用户赠送多少 token
 *
 * 额度按真实 token 计：每次调用 AI 后按模型返回的 usage.total_tokens 扣。
 * 调用前只看「还有没有剩」，所以并发时可能略微透支成负数，界面按 0 显示。
 * 站长不扣额度；用自己模型密钥的人也不扣，只记一笔用量做参考。
 * ========================================================================== */

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

import { pipeline, redis, toHash, type Cmd } from "./db.js";

export type Role = "owner" | "user";

export interface Account {
  id: string;
  /** 登录用的邮箱（保留注册时的写法；查重用归一化后的，见 normalizeEmail） */
  email: string;
  /** 称呼：站长靠它认出是谁（比如微信名） */
  nick: string;
  role: Role;
  /** 剩余 token */
  quota: number;
  /** 用站长的模型累计消耗的 token */
  used: number;
  /** 用自己的模型密钥累计消耗的 token（只做参考） */
  byokUsed: number;
  calls: number;
  created: number;
  /** 最近一次调用 AI 的时间，0 = 从没用过 */
  last: number;
  disabled: boolean;
  /** 会话版本：改密码、停用时 +1，旧 cookie 全部失效 */
  sv: number;
  /** 站长写的备注 */
  note: string;
  /** 个人密钥：本机执行器和安装命令用（相当于以前的邀请码） */
  key: string;
  /** 密码的 scrypt 哈希 */
  pw: string;
  /** 自己的模型密钥（加密后的），空 = 用站长的 */
  llm: string;
}

export interface Grant {
  t: number;
  delta: number;
  note: string;
  by: string;
}

export interface SiteConfig {
  /** 新用户注册时赠送的 token：够改完一份简历 */
  signupTokens: number;
}

export const DEFAULT_SIGNUP_TOKENS = 300_000;

const K = {
  user: (id: string) => `u:${id}`,
  email: (email: string) => `uemail:${normalizeEmail(email)}`,
  code: (email: string) => `vc:${normalizeEmail(email)}`,
  cool: (email: string) => `vc:cool:${normalizeEmail(email)}`,
  key: (key: string) => `ukey:${createHash("sha256").update(key).digest("base64url")}`,
  users: "users",
  grants: (id: string) => `grants:${id}`,
  cfg: "cfg",
};

/* ------------------------------ 校验 ------------------------------ */

/* 常见的一次性邮箱：挡不住所有，但能挡掉最顺手的那几个 */
const DISPOSABLE = new Set([
  "mailinator.com", "10minutemail.com", "guerrillamail.com", "sharklasers.com", "yopmail.com",
  "temp-mail.org", "tempmail.com", "trashmail.com", "getnada.com", "maildrop.cc", "dispostable.com",
  "linshiyouxiang.net", "bccto.me", "chacuo.net", "027168.com", "mailnesia.com", "moakt.com",
]);

export function checkEmail(email: string): string | null {
  if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "邮箱格式不对";
  if (DISPOSABLE.has(email.split("@")[1].toLowerCase())) return "不支持临时邮箱，换一个常用邮箱";
  return null;
}

/**
 * 查重用的邮箱：小写、去掉 +后缀；Gmail 再去掉点。
 * 这样 a.b+1@gmail.com 和 ab@gmail.com 算同一个邮箱，不能各注册一次。
 */
export function normalizeEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  let user = local.split("+")[0];
  let host = domain;
  if (host === "googlemail.com") host = "gmail.com";
  if (host === "gmail.com") user = user.replace(/\./g, "");
  return `${user}@${host}`;
}

export function checkPassword(pw: string): string | null {
  if (pw.length < 6) return "密码至少 6 位";
  if (pw.length > 72) return "密码太长了";
  return null;
}

/* ------------------------------ 密码与密钥 ------------------------------ */

function scryptAsync(pw: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(pw, salt, 32, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  return `s1$${salt.toString("base64url")}$${(await scryptAsync(pw, salt)).toString("base64url")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [v, salt, hash] = stored.split("$");
  if (v !== "s1" || !salt || !hash) return false;
  const got = await scryptAsync(pw, Buffer.from(salt, "base64url"));
  const want = Buffer.from(hash, "base64url");
  return got.length === want.length && timingSafeEqual(got, want);
}

/** 临时密码：站长重置后发给用户（去掉容易看错的 0 o 1 l i） */
export function tempPassword(): string {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  return [...randomBytes(8)].map((b) => alphabet[b % alphabet.length]).join("");
}

const newId = () => randomBytes(6).toString("base64url");
const newKey = () => `rk-${randomBytes(18).toString("base64url")}`;

/* ------------------------------ 读 ------------------------------ */

const num = (v: string | undefined) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function parse(id: string, h: Record<string, string>): Account | null {
  if (!h.email) return null;
  return {
    id,
    email: h.email,
    nick: h.nick ?? "",
    role: h.role === "owner" ? "owner" : "user",
    quota: num(h.quota),
    used: num(h.used),
    byokUsed: num(h.byokUsed),
    calls: num(h.calls),
    created: num(h.created),
    last: num(h.last),
    disabled: h.disabled === "1",
    sv: num(h.sv),
    note: h.note ?? "",
    key: h.key ?? "",
    pw: h.pw ?? "",
    llm: h.llm ?? "",
  };
}

export async function getAccount(id: string): Promise<Account | null> {
  return parse(id, toHash(await redis("HGETALL", K.user(id))));
}

export async function findByEmail(email: string): Promise<Account | null> {
  const id = await redis<string | null>("GET", K.email(email));
  return id ? getAccount(id) : null;
}

export async function findByKey(key: string): Promise<Account | null> {
  const id = await redis<string | null>("GET", K.key(key));
  return id ? getAccount(id) : null;
}

export async function listAccounts(): Promise<Account[]> {
  const ids = await redis<string[]>("ZREVRANGE", K.users, 0, -1);
  const rows = await pipeline(ids.map((id) => ["HGETALL", K.user(id)]));
  return ids.map((id, i) => parse(id, toHash(rows[i]))).filter((a): a is Account => a != null);
}

export async function listGrants(id: string, limit = 50): Promise<Grant[]> {
  const raw = await redis<string[]>("LRANGE", K.grants(id), 0, limit - 1);
  return raw.flatMap((s) => {
    try {
      return [JSON.parse(s) as Grant];
    } catch {
      return [];
    }
  });
}

/* ------------------------------ 写 ------------------------------ */

function grantCmds(id: string, delta: number, note: string, by: string): Cmd[] {
  return [
    ["LPUSH", K.grants(id), JSON.stringify({ t: Date.now(), delta, note, by } satisfies Grant)],
    ["LTRIM", K.grants(id), 0, 199],
  ];
}

/** 注册。邮箱已经注册过返回 "taken" */
export async function createAccount(input: { email: string; nick: string; password: string }): Promise<Account | "taken"> {
  const pw = await hashPassword(input.password);
  const id = newId();
  if ((await redis("SET", K.email(input.email), id, "NX")) !== "OK") return "taken";

  const { signupTokens } = await getConfig();
  const now = Date.now();
  const key = newKey();
  await pipeline([
    // prettier-ignore
    ["HSET", K.user(id),
      "email", input.email.trim(), "nick", input.nick, "role", "user",
      "quota", signupTokens, "used", 0, "byokUsed", 0, "calls", 0,
      "created", now, "last", 0, "disabled", 0, "sv", 1, "note", "",
      "key", key, "pw", pw, "llm", ""],
    ["SET", K.key(key), id],
    ["ZADD", K.users, now, id],
    ...(signupTokens ? grantCmds(id, signupTokens, "注册赠送", "系统") : []),
  ]);
  return (await getAccount(id))!;
}

/** 加 / 减额度（delta 可为负），返回变动后的余额 */
export async function grant(id: string, delta: number, note: string, by: string): Promise<number> {
  const [after] = await pipeline([["HINCRBY", K.user(id), "quota", delta], ...grantCmds(id, delta, note, by)]);
  return Number(after);
}

/** 记一次 AI 调用的用量；返回扣完后的余额 */
export async function charge(acc: Account, tokens: number, ownKey: boolean): Promise<number> {
  const k = K.user(acc.id);
  const cmds: Cmd[] = [
    ["HINCRBY", k, "calls", 1],
    ["HSET", k, "last", Date.now()],
    ["HINCRBY", k, ownKey ? "byokUsed" : "used", tokens],
  ];
  const deduct = !ownKey && acc.role !== "owner";
  if (deduct) cmds.push(["HINCRBY", k, "quota", -tokens]);
  const res = await pipeline(cmds);
  return deduct ? Number(res[res.length - 1]) : acc.quota;
}

export async function setFields(id: string, fields: Record<string, string | number>): Promise<void> {
  const flat = Object.entries(fields).flat();
  if (flat.length) await redis("HSET", K.user(id), ...flat);
}

/** 改密码并让旧会话全部失效；返回新的会话版本 */
export async function setPassword(id: string, pw: string): Promise<number> {
  const hash = await hashPassword(pw);
  const [, sv] = await pipeline([
    ["HSET", K.user(id), "pw", hash],
    ["HINCRBY", K.user(id), "sv", 1],
  ]);
  return Number(sv);
}

export async function bumpSession(id: string): Promise<void> {
  await redis("HINCRBY", K.user(id), "sv", 1);
}

/* ------------------------------ 注册验证码 ------------------------------
   6 位数字，10 分钟内有效，最多试错 5 次；同一个邮箱 60 秒内只发一次 */

const sha = (s: string) => createHash("sha256").update(s).digest("base64url");

/** 生成验证码；还在冷却中返回 "cooldown" */
export async function issueCode(email: string): Promise<string | "cooldown"> {
  if ((await redis("SET", K.cool(email), 1, "EX", 60, "NX")) !== "OK") return "cooldown";
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await pipeline([
    ["DEL", K.code(email)],
    ["HSET", K.code(email), "h", sha(code), "n", 0],
    ["EXPIRE", K.code(email), 600],
  ]);
  return code;
}

/** 核对验证码：对了就作废（一码一用） */
export async function consumeCode(email: string, code: string): Promise<boolean> {
  const k = K.code(email);
  const h = toHash(await redis("HGETALL", k));
  if (!h.h) return false;
  const tries = Number(await redis("HINCRBY", k, "n", 1));
  if (tries > 5) {
    await redis("DEL", k);
    return false;
  }
  if (sha(code.trim()) !== h.h) return false;
  await redis("DEL", k);
  return true;
}

/* ------------------------------ 站点设置 ------------------------------ */

export async function getConfig(): Promise<SiteConfig> {
  const h = toHash(await redis("HGETALL", K.cfg));
  return { signupTokens: h.signupTokens === undefined ? DEFAULT_SIGNUP_TOKENS : num(h.signupTokens) };
}

export async function setConfig(cfg: SiteConfig): Promise<void> {
  await redis("HSET", K.cfg, "signupTokens", cfg.signupTokens);
}

/* ------------------------------ 自带模型密钥 ------------------------------
   用 SESSION_SECRET 派生的密钥做 AES-256-GCM 加密后入库。
   注意：换 SESSION_SECRET 会让已存的密钥全部解不开（用户重新填一次即可）。 */

export interface OwnLlm {
  baseUrl: string;
  model: string;
  apiKey: string;
}

function sealKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("没有配置 SESSION_SECRET");
  return createHash("sha256").update(`byok:${secret}`).digest();
}

export function sealLlm(cfg: OwnLlm): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealKey(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(cfg), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

export function openLlm(sealed: string): OwnLlm | null {
  if (!sealed) return null;
  try {
    const [iv, tag, ct] = sealed.split(".").map((s) => Buffer.from(s, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", sealKey(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8")) as OwnLlm;
  } catch {
    return null;
  }
}

/** 服务端会替用户去请求这个地址，只放行公网 https 域名 */
export function checkBaseUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "接口地址不是合法网址";
  }
  if (u.protocol !== "https:") return "接口地址要以 https:// 开头";
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.startsWith("[") ||
    /^\d+(\.\d+){3}$/.test(host) ||
    /\.(local|internal|localhost)$/.test(host) ||
    !host.includes(".")
  ) {
    return "接口地址要用公网域名";
  }
  return null;
}
