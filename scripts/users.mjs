#!/usr/bin/env node
/* ============================================================================
 * 账号命令行（线上版 resume.kongbei.xyz）
 *
 *   pnpm users list               看所有账号和剩余额度
 *   pnpm users promote 邮箱        设为站长：能进「用户」页给人加额度、能取 /owner/ 私人简历、AI 不限额度
 *   pnpm users demote 邮箱         取消站长
 *
 * 日常加额度、停用、重置密码都在网页「用户」页里做，这里只管「谁是站长」——
 * 网页上不开放这个操作。
 *
 * 数据库连接读环境变量或 .env.local 里的 KV_REST_API_URL / KV_REST_API_TOKEN
 * （Vercel 的 Upstash 集成注入的那一对，用 vercel env pull 取回）。
 * ========================================================================== */

import { readFileSync } from "node:fs";

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* 没有这个文件 */
  }
}
loadEnvFile(".env.local");

const URL = (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "").replace(/\/+$/, "");
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
if (!URL || !TOKEN) {
  console.error("找不到数据库连接：先跑 vercel env pull，或在 .env.local 里写 KV_REST_API_URL / KV_REST_API_TOKEN");
  process.exit(1);
}

async function redis(...cmd) {
  const res = await fetch(URL, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd) });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

const hash = (raw) => Object.fromEntries((raw ?? []).flatMap((v, i, a) => (i % 2 ? [] : [[v, a[i + 1]]])));
const wan = (n) => (Math.abs(n) >= 10_000 ? `${(n / 10_000).toFixed(1)} 万` : String(n));

/** 和 server/accounts.ts 的 normalizeEmail 保持一致 */
function normalizeEmail(email) {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  let user = local.split("+")[0];
  let host = domain === "googlemail.com" ? "gmail.com" : domain;
  if (host === "gmail.com") user = user.replace(/\./g, "");
  return `${user}@${host}`;
}

async function byEmail(email) {
  const id = await redis("GET", `uemail:${normalizeEmail(email)}`);
  if (!id) {
    console.error(`没有用「${email}」注册的账号：先在网站上注册`);
    process.exit(1);
  }
  return id;
}

const [cmd, arg] = process.argv.slice(2);

if (cmd === "list" || !cmd) {
  const ids = await redis("ZREVRANGE", "users", 0, -1);
  if (!ids.length) console.log("还没有账号");
  for (const id of ids) {
    const u = hash(await redis("HGETALL", `u:${id}`));
    const tags = [u.role === "owner" ? "站长" : "", u.disabled === "1" ? "已停用" : "", u.llm ? "自带密钥" : ""].filter(Boolean);
    console.log(
      `${u.email.padEnd(28)} ${(u.nick || "").padEnd(12)} 剩 ${wan(Number(u.quota)).padStart(9)}  已用 ${wan(Number(u.used)).padStart(9)}  ${tags.join(" · ")}`,
    );
  }
} else if (cmd === "promote" || cmd === "demote") {
  if (!arg) {
    console.error(`用法：pnpm users ${cmd} 邮箱`);
    process.exit(1);
  }
  const id = await byEmail(arg);
  await redis("HSET", `u:${id}`, "role", cmd === "promote" ? "owner" : "user");
  console.log(cmd === "promote" ? `「${arg}」现在是站长了，刷新网页就能看到「用户」页` : `「${arg}」不再是站长`);
} else {
  console.error("用法：pnpm users list | promote 邮箱 | demote 邮箱");
  process.exit(1);
}
