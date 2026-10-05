#!/usr/bin/env node
/* ============================================================================
 * 生成站长专属的简历数据：<输出目录>/owner/resume.json
 *
 * 线上版是公开版构建（不带 src/data/private/），站长自己的简历另外放在这里，
 * 由 middleware.ts 只放行给站长账号（role = owner，pnpm users promote 设置），其他人访问一律 404。
 * 前端登录后取这份数据，站长打开就是自己的真实简历。
 *
 * 证件照 / 二维码（public/private/ 下的文件）直接内嵌成 data URL，
 * 这样线上不需要再放任何私人图片文件。
 *
 * 用法：node scripts/build-owner-data.mjs [输出目录，默认 dist]
 * 本机没有 src/data/private/ 时什么也不做（别人 clone 仓库照样能构建）。
 * ========================================================================== */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.resolve(root, process.argv[2] ?? "dist", "owner");

if (!existsSync(path.join(root, "src/data/private/myResume.ts"))) {
  console.warn("[owner-data] 本机没有私人简历（src/data/private/），跳过");
  process.exit(0);
}

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };

/** "/private/avatar.png" → data URL；其他值原样返回 */
function inlineImage(value) {
  if (typeof value !== "string" || !value.startsWith("/private/")) return value;
  const file = path.join(root, "public", value);
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!existsSync(file) || !mime) return "";
  return `data:${mime};base64,${readFileSync(file).toString("base64")}`;
}

function inlineResume(resume) {
  if (!resume) return null;
  for (const entries of Object.values(resume.sections)) {
    for (const entry of entries) {
      for (const [k, v] of Object.entries(entry.values)) entry.values[k] = inlineImage(v);
    }
  }
  return resume;
}

// 借 Vite 的模块解析在 Node 里执行 privateResume.ts（它用 import.meta.glob 读私人文件）
const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, watch: null },
});

try {
  const mod = await server.ssrLoadModule("/src/data/privateResume.ts");
  const data = {
    mine: inlineResume(mod.buildMyResume()),
    full: inlineResume(mod.buildFullResume()),
    aiDev: inlineResume(mod.buildAiDevResume()),
    // 站长在投递控制台里看到的启动命令：用项目里技能目录的投递数据
    runnerCommand: `cd "${root}" && pnpm runner`,
    builtAt: new Date().toISOString(),
  };
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, "resume.json");
  writeFileSync(file, JSON.stringify(data));
  const kb = Math.round(readFileSync(file).length / 1024);
  console.log(`[owner-data] ${path.relative(root, file)}（${kb} KB：一页版${data.full ? " / 完整版" : ""}${data.aiDev ? " / AI 开发版" : ""}）`);
} finally {
  await server.close();
}
