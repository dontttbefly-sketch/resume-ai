#!/usr/bin/env node
/* ============================================================================
 * 用 CDP 实测「导出 PDF 到底是几页、每页边距多少」
 *
 * 为什么不用 `Chrome --headless --print-to-pdf`：本机实测会卡死几分钟没输出。
 * 为什么不用 Emulation.setEmulatedMedia({media:"print"})：它只改媒体查询、
 * 不做真实分页，量不出页数。
 *
 * 用法：
 *   node scripts/measure-print.mjs [输出路径] [页面URL]
 * 默认：输出 /tmp/resume-print.pdf，页面 http://localhost:5173
 * ========================================================================== */

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = process.argv[2] ?? "/tmp/resume-print.pdf";
const URL = process.argv[3] ?? "http://localhost:5173";
// 加 --full 时先点一下工具栏的「载入完整版」再测量（用来验证版本切换没坏）
const CLICK_FULL = process.argv.includes("--full");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;

const profile = mkdtempSync(join(tmpdir(), "cdp-print-"));
let chrome;

/** 轮询等待 CDP HTTP 端点可用 */
async function waitForEndpoint(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* 还没起来 */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("等不到 Chrome 的 CDP 端点");
}

/** 极简 CDP 客户端：发一条命令、等它的响应 */
function makeClient(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? "")})`));
      else resolve(msg.result);
    }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
}

const MEASURE_EXPR = `(async () => {
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 300));
  const content = document.querySelector('.paper-content');
  const paper = document.querySelector('.resume-paper');
  const sections = [...document.querySelectorAll('.resume-paper section')].map(s => ({
    label: (s.querySelector('h2')?.innerText ?? '(抬头)').trim(),
    h: Math.round(s.getBoundingClientRect().height),
  }));
  const heads = [...document.querySelectorAll('.resume-paper header')].map(h => Math.round(h.getBoundingClientRect().height));
  const img = document.querySelector('.resume-paper header img');
  const lis = [...document.querySelectorAll('.resume-paper li')];
  const lisH = lis.reduce((a, li) => a + li.getBoundingClientRect().height, 0);
  const cs = getComputedStyle(content);
  const meta = document.querySelector('.resume-paper header p.tnum');
  const metaInfo = meta
    ? {
        text: meta.innerText,
        w: Math.round(meta.getBoundingClientRect().width),
        h: Math.round(meta.getBoundingClientRect().height),
        lines: Math.round(meta.getBoundingClientRect().height / parseFloat(getComputedStyle(meta).lineHeight)),
      }
    : null;
  return JSON.stringify({
    contentH: Math.round(content.getBoundingClientRect().height),
    paperH: Math.round(paper.getBoundingClientRect().height),
    headerH: heads[0] ?? 0,
    avatarH: img ? Math.round(img.getBoundingClientRect().height) : 0,
    liCount: lis.length,
    liTotalH: Math.round(lisH),
    bodyFont: cs.fontSize + ' / ' + cs.lineHeight,
    meta: metaInfo,
    sections,
  });
})()`;

try {
  chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1440,2000",
      URL,
    ],
    { stdio: "ignore" },
  );

  const target = await waitForEndpoint();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const send = makeClient(ws);
  await send("Page.enable");
  await send("Runtime.enable");

  // 等页面加载完（SPA，等 load 事件就够）
  await send("Page.navigate", { url: URL });
  await new Promise((r) => setTimeout(r, 2500));

  if (CLICK_FULL) {
    // window.confirm 会卡死自动化，先覆写成「永远确定」
    await send("Runtime.evaluate", {
      expression: `(() => {
        window.confirm = () => true;
        const btn = [...document.querySelectorAll("button")].find(b => b.innerText.includes("载入完整版"));
        if (!btn) return "没找到按钮";
        btn.click();
        return "已点击";
      })()`,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 1200));
  }

  const measured = await send("Runtime.evaluate", {
    expression: MEASURE_EXPR,
    awaitPromise: true,
    returnByValue: true,
  });

  if (measured.exceptionDetails) {
    throw new Error("页面内测量失败：" + JSON.stringify(measured.exceptionDetails));
  }

  const info = JSON.parse(measured.result.value);
  console.log("=== 屏幕上的测量结果 ===");
  console.log(`内容总高 ${info.contentH}px，纸张高 ${info.paperH}px`);
  console.log(`单页内容安全区 = 1016.6px（297mm - 2×14mm）`);
  console.log(`预计占页数 ≈ ${Math.ceil(info.contentH / 1016.6)}`);
  console.log(
    `抬头 ${info.headerH}px（照片 ${info.avatarH}px）｜正文 ${info.bodyFont}` +
      `｜要点 ${info.liCount} 条共 ${info.liTotalH}px`,
  );
  if (info.meta) {
    console.log(`联系方式行：宽 ${info.meta.w}px，占 ${info.meta.lines} 行`);
    console.log(`  ${info.meta.text}`);
  }
  console.log("--- 各模块高度 ---");
  for (const s of info.sections) console.log(`  ${String(s.h).padStart(5)}px  ${s.label}`);

  const pdf = await send("Page.printToPDF", {
    printBackground: true,
    preferCSSPageSize: true,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
  });

  writeFileSync(OUT, Buffer.from(pdf.data, "base64"));
  console.log(`\n已写出 PDF：${OUT}`);
} finally {
  if (chrome) chrome.kill("SIGKILL");
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* 忽略 */
  }
}
