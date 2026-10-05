#!/usr/bin/env node
/* ============================================================================
 * 打包本机执行器：runner/ + 投递技能脚本 → <输出目录>/runner/
 *   boss-runner.zip   执行器 + skill/scripts（安装命令下载它）
 *   install.sh        一键安装脚本（站点地址已填好）
 *
 * 用法：node scripts/pack-runner.mjs [输出目录，默认 dist]
 *   BOSS_SKILL_DIR   投递技能目录，默认项目根下的 boss-zhipin-assistant-egolite
 *   SITE_URL         站点地址，默认 https://resume.kongbei.xyz
 *
 * 只打包脚本，不打包任何投递记录 / 画像（boss-data、user_profile.json 都不进包）。
 * ========================================================================== */

import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.resolve(root, process.argv[2] ?? "dist", "runner");
const skillDir = path.resolve(root, process.env.BOSS_SKILL_DIR || "boss-zhipin-assistant-egolite");
const site = (process.env.SITE_URL || "https://resume.kongbei.xyz").replace(/\/+$/, "");

if (!existsSync(path.join(skillDir, "scripts", "_live_driver.py"))) {
  console.warn(`[pack-runner] 没找到投递技能脚本（${skillDir}），跳过打包`);
  process.exit(0);
}

const stage = mkdtempSync(path.join(tmpdir(), "boss-runner-"));
try {
  for (const f of ["boss_runner.py", "start.command", "README.txt"]) {
    copyFileSync(path.join(root, "runner", f), path.join(stage, f));
  }
  chmodSync(path.join(stage, "start.command"), 0o755);

  const scriptsOut = path.join(stage, "skill", "scripts");
  mkdirSync(scriptsOut, { recursive: true });
  const scripts = readdirSync(path.join(skillDir, "scripts")).filter((f) => f.endsWith(".py"));
  for (const f of scripts) copyFileSync(path.join(skillDir, "scripts", f), path.join(scriptsOut, f));

  mkdirSync(outDir, { recursive: true });
  const zip = path.join(outDir, "boss-runner.zip");
  rmSync(zip, { force: true });
  execFileSync("zip", ["-qrX", zip, "."], { cwd: stage });

  const install = readFileSync(path.join(root, "runner", "install.sh"), "utf8").replaceAll("__SITE__", site);
  writeFileSync(path.join(outDir, "install.sh"), install, { mode: 0o755 });

  console.log(`[pack-runner] ${path.relative(root, zip)}（${scripts.length} 个技能脚本）+ install.sh → ${site}`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
