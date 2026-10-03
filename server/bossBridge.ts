/* ============================================================================
 * BOSS 直聘投递服务 · 本机桥接（Vite 开发服务器插件）
 *
 * 把 boss-zhipin-assistant-egolite（Python + ego-browser）封装成几个同源接口，
 * 网页「投递」视图通过它读数据、下指令。浏览器操作仍然 100% 由技能脚本完成，
 * 这里只负责：起子进程、串行化、解析输出、记活动日志。
 *
 *   GET  /api/boss/state?v=版本   画像 / 游标 / 已投递 / 活动日志（版本没变只回 unchanged）
 *   PUT  /api/boss/profile        改 user_profile.json（白名单字段，原子写）
 *   POST /api/boss/run            执行一步：walk / next / more / exhaust / reset / open / deliver / reject / env
 *   GET  /api/boss/report         生成并返回「投递汇总.html」
 *
 * 安全约定：
 *   - 只在开发服务器上挂载（默认只监听 localhost），线上静态部署没有这些接口
 *   - 子进程用参数数组启动，不经过 shell；jobId 白名单正则校验
 *   - 同一时刻只跑一个浏览器动作（技能只有一个标签页）
 *   - 检测到别的会话（比如智能体在终端里跑）近期在操作浏览器，默认拒绝，避免两边抢同一个标签页
 * ========================================================================== */

import { execFile, spawn } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

type Action = "walk" | "next" | "more" | "exhaust" | "reset" | "open" | "deliver" | "reject" | "env";

const BROWSER_ACTIONS = new Set<Action>(["walk", "next", "more", "exhaust", "open", "deliver", "env"]);

const TIMEOUT_MS: Record<Action, number> = {
  walk: 150_000,
  next: 120_000,
  more: 150_000,
  exhaust: 900_000,
  reset: 15_000,
  open: 60_000,
  deliver: 150_000,
  reject: 15_000,
  env: 150_000,
};

/** BOSS 的 encryptJobId：字母数字加少量符号 */
const JID_RE = /^[A-Za-z0-9_~-]{8,80}$/;

/** 外部会话判定窗口：这么久之内 Ego 空间被别人碰过，就认为有人在用 */
const EXTERNAL_WINDOW_MS = 75_000;

const PROFILE_KEYS = new Set([
  "target_city",
  "target_cities",
  "city_code",
  "min_salary_k",
  "max_salary_k",
  "role_summary",
  "prefer",
  "avoid",
  "judge_rules",
  "experience",
  "accept_note",
]);

interface BridgeOptions {
  /** 技能目录（含 scripts/ 与 user_profile.json） */
  skillDir: string;
  python?: string;
}

interface RunResult {
  ok: boolean;
  code: number | null;
  ms: number;
  result: unknown;
  lazy: unknown;
  notes: string[];
  stderr: string;
  timedOut: boolean;
}

/* ------------------------------ 小工具 ------------------------------ */

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 256 * 1024) throw new Error("请求体过大");
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function mtime(file: string): Promise<number> {
  try {
    return (await fs.stat(file)).mtimeMs;
  } catch {
    return 0;
  }
}

/** 单行参数：去换行、截断，避免把奇怪的东西传给脚本 */
function arg(v: unknown, max = 60): string {
  return String(v ?? "")
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .slice(0, max);
}

function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 从脚本输出里捞结构化结果：最后一行 JSON 是结果，LAZY 行是懒加载进度 */
function parseOutput(stdout: string) {
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let result: unknown = null;
  let lazy: unknown = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (result == null && l.startsWith("{")) {
      try {
        result = JSON.parse(l);
      } catch {
        /* 不是完整 JSON，跳过 */
      }
    }
    if (lazy == null && l.startsWith("LAZY ")) {
      try {
        lazy = JSON.parse(l.slice(5));
      } catch {
        /* 忽略 */
      }
    }
  }
  const notes = lines.filter((l) => !l.startsWith("{") && !l.startsWith("LAZY ")).slice(-12);
  return { result, lazy, notes };
}

/* ------------------------------ 插件 ------------------------------ */

export function bossBridge({ skillDir, python = "python3" }: BridgeOptions): Plugin {
  const workDir = path.join(skillDir, "boss-data");
  const files = {
    progress: path.join(workDir, "stream_progress.json"),
    walk: path.join(workDir, "walk_state.json"),
    profile: path.join(skillDir, "user_profile.json"),
    log: path.join(workDir, "web_activity.jsonl"),
    report: path.join(workDir, "投递汇总.html"),
    space: path.join(os.homedir(), ".boss-egolite", "space.json"),
  };

  let busy: { action: Action; since: number } | null = null;
  /** 我们自己最近一次动作结束的时间：用来区分「空间被谁碰过」 */
  let lastOwnEnd = 0;

  const env = {
    ...process.env,
    BOSS_WORK_DIR: workDir,
    PYTHONUNBUFFERED: "1",
    PYTHONIOENCODING: "utf-8",
    // 从图形界面启动时 PATH 可能很短，补上 ego-browser / Homebrew 的常见位置
    PATH: [path.join(os.homedir(), ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin", process.env.PATH ?? ""].join(":"),
  };

  function runPython(args: string[], timeoutMs: number): Promise<RunResult> {
    return new Promise((resolve) => {
      const started = Date.now();
      const child = spawn(python, args, { cwd: workDir, env });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const cap = (s: string, add: string) => (s.length > 400_000 ? s : s + add);
      child.stdout.on("data", (d: Buffer) => (stdout = cap(stdout, d.toString("utf8"))));
      child.stderr.on("data", (d: Buffer) => (stderr = cap(stderr, d.toString("utf8"))));
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 3000);
      }, timeoutMs);
      const finish = (code: number | null) => {
        clearTimeout(timer);
        const parsed = parseOutput(stdout);
        resolve({
          ok: code === 0 && !timedOut,
          code,
          ms: Date.now() - started,
          ...parsed,
          stderr: stderr.split(/\r?\n/).filter(Boolean).slice(-8).join("\n"),
          timedOut,
        });
      };
      child.on("error", (e) => {
        stderr += String(e);
        finish(-1);
      });
      child.on("close", finish);
    });
  }

  /** 是否有别的会话在动浏览器：进程在跑，或 Ego 空间文件最近被别人写过 */
  async function externalActivity(): Promise<{ active: boolean; reason: string; at: number }> {
    if (!busy) {
      const running = await new Promise<boolean>((resolve) => {
        execFile("pgrep", ["-f", "_live_driver\\.py|phase_stream\\.py|env_check\\.py"], (err, out) =>
          resolve(!err && out.trim().length > 0),
        );
      });
      if (running) return { active: true, reason: "检测到终端里正在运行投递脚本", at: Date.now() };
    }
    const spaceAt = await mtime(files.space);
    if (spaceAt > lastOwnEnd + 2000 && Date.now() - spaceAt < EXTERNAL_WINDOW_MS && !busy) {
      return { active: true, reason: "另一个会话刚刚操作过 BOSS 浏览器", at: spaceAt };
    }
    return { active: false, reason: "", at: spaceAt };
  }

  async function appendLog(entry: Record<string, unknown>) {
    try {
      await fs.appendFile(files.log, JSON.stringify(entry) + "\n", "utf8");
    } catch {
      /* 日志写不进去不影响主流程 */
    }
  }

  async function readLog(limit = 160): Promise<Record<string, unknown>[]> {
    try {
      const text = await fs.readFile(files.log, "utf8");
      const lines = text.trim().split("\n").slice(-limit);
      return lines.flatMap((l) => {
        try {
          return [JSON.parse(l) as Record<string, unknown>];
        } catch {
          return [];
        }
      });
    } catch {
      return [];
    }
  }

  /* ---------------------------- 路由 ---------------------------- */

  async function handleState(req: IncomingMessage, res: ServerResponse) {
    if (!existsSync(skillDir)) {
      send(res, 200, { available: false, reason: `没找到投递技能目录：${skillDir}` });
      return;
    }
    const url = new URL(req.url ?? "/", "http://x");
    const times = await Promise.all([files.progress, files.walk, files.profile, files.log].map(mtime));
    const version = times.map((t) => Math.round(t)).join("-");
    const external = await externalActivity();
    const base = { available: true, version, busy, external };

    if (url.searchParams.get("v") === version) {
      send(res, 200, { ...base, unchanged: true });
      return;
    }

    const progress = await readJson<{ delivered?: Record<string, unknown>[]; failed?: unknown[]; blocked?: unknown[] }>(
      files.progress,
      {},
    );
    const walk = await readJson<Record<string, unknown>>(files.walk, {});
    const profile = await readJson<Record<string, unknown>>(files.profile, {});
    const delivered = progress.delivered ?? [];
    const today = localDate();

    send(res, 200, {
      ...base,
      skillDir: path.relative(process.cwd(), skillDir) || skillDir,
      profile,
      walk: {
        keyword: walk.keyword ?? "",
        idx: walk.idx ?? 0,
        lastJid: walk.last_jid ?? "",
        recommendExhausted: Boolean(walk.recommend_exhausted),
        kwExhausted: Boolean(walk.kw_exhausted),
        rejectedCount: Array.isArray(walk.rejected_jids) ? walk.rejected_jids.length : 0,
      },
      delivered,
      counts: {
        delivered: delivered.length,
        failed: progress.failed?.length ?? 0,
        blocked: progress.blocked?.length ?? 0,
      },
      today: {
        date: today,
        delivered: delivered.filter((d) => String(d.deliveredAt ?? "").startsWith(today)).length,
      },
      activity: await readLog(),
    });
  }

  async function handleProfile(req: IncomingMessage, res: ServerResponse) {
    const patch = await readBody(req);
    const current = await readJson<Record<string, unknown>>(files.profile, {});
    const next: Record<string, unknown> = { ...current };
    for (const [k, v] of Object.entries(patch)) {
      if (!PROFILE_KEYS.has(k)) continue;
      if (["prefer", "avoid", "judge_rules", "target_cities"].includes(k)) {
        if (!Array.isArray(v)) continue;
        next[k] = v.map((x) => String(x).trim()).filter(Boolean).slice(0, 60);
      } else if (k === "min_salary_k" || k === "max_salary_k") {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0 && n < 1000) next[k] = Math.round(n);
      } else {
        next[k] = String(v ?? "").slice(0, 2000);
      }
    }
    // 主城市与城市列表保持一致：脚本两边都读
    const cities = next.target_cities as string[] | undefined;
    if (Array.isArray(cities) && cities.length) next.target_city = cities[0];
    const tmp = `${files.profile}.tmp-${process.pid}`;
    await fs.writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
    await fs.rename(tmp, files.profile);
    send(res, 200, { ok: true, profile: next });
  }

  async function handleRun(req: IncomingMessage, res: ServerResponse) {
    const body = await readBody(req);
    const action = String(body.action ?? "") as Action;
    if (!(action in TIMEOUT_MS)) {
      send(res, 400, { error: `未知动作：${action}` });
      return;
    }
    if (busy) {
      send(res, 409, { error: "上一步还在执行", busy });
      return;
    }
    const jid = arg(body.jobId, 80);
    if (["open", "deliver", "reject"].includes(action) && !JID_RE.test(jid)) {
      send(res, 400, { error: "jobId 不合法" });
      return;
    }
    if (BROWSER_ACTIONS.has(action) && !body.force) {
      const ext = await externalActivity();
      if (ext.active) {
        send(res, 423, { error: ext.reason, external: ext });
        return;
      }
    }

    let args: string[];
    const driver = path.join(skillDir, "scripts", "_live_driver.py");
    switch (action) {
      case "walk": {
        // 关键词不能以 - 开头，否则会被脚本当成 --next 之类的子命令
        const kw = arg(body.keyword, 30).replace(/^-+/, "");
        args = kw ? [driver, "walk", kw] : [driver, "walk"];
        break;
      }
      case "next":
        args = [driver, "walk", "--next"];
        break;
      case "more":
        args = [driver, "walk", "--more"];
        break;
      case "exhaust":
        args = [driver, "walk", "--exhaust"];
        break;
      case "reset":
        args = [driver, "walk", "--reset"];
        break;
      case "open":
        args = [driver, "open", jid];
        break;
      case "deliver":
        args = [driver, "deliver", jid, arg(body.company), arg(body.salary, 30), arg(body.industry, 30), arg(body.direction, 30)];
        break;
      case "reject":
        args = [driver, "reject", jid];
        break;
      case "env":
        args = [path.join(skillDir, "scripts", "env_check.py")];
        break;
    }

    busy = { action, since: Date.now() };
    let out: RunResult;
    try {
      out = await runPython(args, TIMEOUT_MS[action]);
    } finally {
      busy = null;
      lastOwnEnd = Date.now();
    }

    if (action === "deliver" || action === "reject") {
      const r = (out.result ?? {}) as Record<string, unknown>;
      const note = (body.note ?? {}) as Record<string, unknown>;
      await appendLog({
        ts: new Date().toISOString(),
        action,
        jobId: jid,
        ok: action === "reject" ? out.ok : Boolean(r.delivered_ok),
        title: arg(note.title, 80),
        company: arg(note.company ?? body.company, 60),
        salary: arg(note.salary ?? body.salary, 30),
        city: arg(note.city, 30),
        industry: arg(note.industry ?? body.industry, 30),
        direction: arg(body.direction, 30),
        reason: arg(note.reason, 200),
        by: note.by === "auto" ? "auto" : note.by === "rule" ? "rule" : "manual",
        flags: {
          timeout: Boolean(r.timeout),
          dailyLimit: Boolean(r.daily_limit),
          notFound: Boolean(r.not_found),
          anomaly: Boolean(r.anomaly),
        },
        error: out.ok ? undefined : out.stderr.split("\n").pop(),
      });
    }

    send(res, 200, out);
  }

  async function handleReport(res: ServerResponse) {
    const out = await runPython(
      [path.join(skillDir, "scripts", "phase_stream.py"), "--mode", "report", "--workdir", workDir],
      60_000,
    );
    if (!existsSync(files.report)) {
      send(res, 500, { error: "汇报页生成失败", detail: out.stderr || out.notes.join("\n") });
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(await fs.readFile(files.report));
  }

  return {
    name: "boss-bridge",
    configureServer(server) {
      server.middlewares.use("/api/boss", (req, res) => {
        void (async () => {
          try {
            const route = (req.url ?? "/").split("?")[0];
            if (req.method === "GET" && route === "/state") return await handleState(req, res);
            if (req.method === "PUT" && route === "/profile") return await handleProfile(req, res);
            if (req.method === "POST" && route === "/run") return await handleRun(req, res);
            if (req.method === "GET" && route === "/report") return await handleReport(res);
            send(res, 404, { error: "没有这个接口" });
          } catch (err) {
            send(res, 500, { error: err instanceof Error ? err.message : String(err) });
          }
        })();
      });
    },
  };
}
