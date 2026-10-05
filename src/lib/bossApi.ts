/* ============================================================================
 * BOSS 投递 · 网页 ↔ 本机执行器（runner/boss_runner.py）
 *
 * 执行器跑在用户自己的 Mac 上，只监听 127.0.0.1。网页直接从浏览器连过去：
 *   - /hello 不要配对码，用来判断「执行器开没开」
 *   - 其余接口都带 X-Runner-Token（终端里显示的 8 位配对码）
 * 第一次连接时 Chrome 会询问是否允许访问本机，点允许即可。
 * ========================================================================== */

export interface BossProfile {
  target_city?: string;
  target_cities?: string[];
  city_code?: string;
  min_salary_k?: number;
  max_salary_k?: number;
  role_summary?: string;
  prefer?: string[];
  avoid?: string[];
  judge_rules?: string[];
  /** 关键词计划：按顺序翻，"推荐页" 代表推荐页 */
  keyword_plan?: string[];
  experience?: string;
  [key: string]: unknown;
}

export interface DeliveredRec {
  jobId: string;
  title: string;
  company: string;
  salary: string;
  industry: string;
  direction?: string;
  deliveredAt?: string;
  result?: string;
}

export interface ActivityRec {
  ts: string;
  action: "deliver" | "reject";
  jobId: string;
  ok: boolean;
  title?: string;
  company?: string;
  salary?: string;
  city?: string;
  industry?: string;
  direction?: string;
  reason?: string;
  by?: "auto" | "manual" | "rule";
  flags?: { timeout?: boolean; dailyLimit?: boolean; notFound?: boolean; anomaly?: boolean };
  error?: string | null;
}

export interface ExternalInfo {
  active: boolean;
  reason: string;
  at: number;
}

export interface WalkInfo {
  keyword: string;
  idx: number;
  lastJid: string;
  recommendExhausted: boolean;
  kwExhausted: boolean;
  rejectedCount: number;
}

/** 推荐页 / 搜索页上一张卡的「表面」 */
export interface Surface {
  jobId: string;
  title: string;
  salary: string;
  city: string;
  industry: string;
  company?: string;
  scale?: string;
  stage?: string;
  experience?: string;
  degree?: string;
}

export interface Verdict {
  deliver: boolean;
  reason: string;
  direction: string;
  confidence: number | null;
  /** 判不投时的原因类别（方向不符 / 薪资超上限 …） */
  category?: string;
  /** rule = 机械规则判定（薪资上限），ai = 模型判定 */
  source: "rule" | "ai";
  ms: number;
}

export type Phase =
  | "idle"
  | "walking"
  | "scrolling"
  | "opening"
  | "judging"
  | "awaiting"
  | "delivering"
  | "rejecting"
  | "exhausting"
  | "checking";

export interface LiveCard {
  surface: Surface;
  position: number;
  visibleTotal: number;
  autoSkipped: number;
  outcome?: "delivered" | "rejected" | "failed" | "vanished";
  outcomeNote?: string;
}

export interface ListEnd {
  keyword: string;
  kwExhausted: boolean;
  recommendExhausted: boolean;
  blocked?: string;
}

export interface Notice {
  tone: "info" | "warn" | "error";
  text: string;
}

export interface EnvItem {
  name: string;
  ok: boolean;
  detail: string;
}

export interface AutoState {
  running: boolean;
  /** 每天投到这么多份就停（最多 148） */
  dailyTarget: number;
  /** 逐张确认：每张判完等网页上点投或跳 */
  confirm: boolean;
  /** 正在等你决定当前这张 */
  awaiting: boolean;
  /** 这次开始以来投出的份数 */
  done: number;
  stopReason: string;
  stopping: boolean;
}

/** 执行器里的实时状态（当前这张卡、判岗结论、自动投递进度） */
export interface LiveState {
  phase: Phase;
  card: LiveCard | null;
  jd: string;
  jdOk: boolean;
  verdict: Verdict | null;
  judgeError: string;
  listEnd: ListEnd | null;
  notice: Notice | null;
  env: EnvItem[] | null;
  auto: AutoState;
  busy: string | null;
  seq: number;
}

/** 执行器本机文件里的数据（投递记录、游标、画像、活动日志） */
export interface RunnerData {
  profile: BossProfile;
  walk: WalkInfo;
  delivered: DeliveredRec[];
  counts: { delivered: number; failed: number; blocked: number };
  today: { date: string; delivered: number };
  /** 今天的漏斗（执行器经手的部分） */
  funnel: { seen: number; filtered: number; opened: number; aiYes: number; aiNo: number; ruleNo: number; delivered: number; skipped: number };
  skipReasons: { label: string; count: number }[];
  activity: ActivityRec[];
}

/** 关键词计划的进度："" 代表推荐页 */
export interface PlanInfo {
  sources: string[];
  current: string;
  next: string | null;
}

export interface StateResponse {
  dataVersion: string;
  live: LiveState;
  external: ExternalInfo;
  config: { inviteConfigured: boolean; demo: boolean };
  plan: PlanInfo;
  /** 只有本机文件变了才带 */
  data?: RunnerData;
}

/* ------------------------------ 连接参数 ------------------------------ */

const URL_KEY = "resume-ai/runner-url";
const CODE_KEY = "resume-ai/runner-code";
export const DEFAULT_RUNNER_URL = "http://127.0.0.1:47321";

function ls(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function runnerUrl(): string {
  return ls(URL_KEY) || DEFAULT_RUNNER_URL;
}

export function pairCode(): string {
  return ls(CODE_KEY);
}

export function setPairCode(code: string): void {
  try {
    if (code) localStorage.setItem(CODE_KEY, code.replace(/\D/g, ""));
    else localStorage.removeItem(CODE_KEY);
  } catch {
    /* 隐私模式：只在本次会话生效 */
  }
}

/** 登录页存下的个人密钥（执行器判岗、安装命令都要用；键名沿用邀请码时代） */
export function inviteCode(): string {
  return ls("resume-ai/invite-code");
}

/* ------------------------------ 请求 ------------------------------ */

export class RunnerError extends Error {
  readonly kind: "offline" | "unpaired" | "busy" | "rejected" | "bad";
  constructor(kind: RunnerError["kind"], message: string) {
    super(message);
    this.name = "RunnerError";
    this.kind = kind;
  }
}

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(runnerUrl() + path, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "X-Runner-Token": pairCode(), ...(init.headers ?? {}) },
    });
  } catch {
    throw new RunnerError("offline", "连不上本机执行器");
  } finally {
    window.clearTimeout(timer);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401) throw new RunnerError("unpaired", data.error ?? "配对码不对");
  if (res.status === 409) throw new RunnerError("busy", data.error ?? "上一步还在执行，稍等");
  if (res.status === 422) throw new RunnerError("rejected", data.error ?? "执行器拒绝了这个操作");
  if (!res.ok) throw new RunnerError("bad", data.error ?? `执行器返回 ${res.status}`);
  return data;
}

/** 执行器开着吗（不需要配对码）；没开返回 null */
export async function hello(): Promise<{ version: string; demo: boolean } | null> {
  try {
    const res = await fetch(`${runnerUrl()}/hello`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const d = (await res.json()) as { app?: string; version: string; demo: boolean };
    return d.app === "boss-runner" ? d : null;
  } catch {
    return null;
  }
}

export function fetchState(dataVersion?: string): Promise<StateResponse> {
  // 网页不显示终端日志：ls 给一个大数，执行器就不把日志带回来
  return call<StateResponse>(`/state?dv=${encodeURIComponent(dataVersion ?? "")}&ls=999999999`);
}

export function sendAction(type: string, payload: Record<string, unknown> = {}): Promise<{ ok: boolean }> {
  return call("/action", { method: "POST", body: JSON.stringify({ type, ...payload }) });
}

export async function saveProfile(patch: Partial<BossProfile>): Promise<BossProfile> {
  const d = await call<{ profile: BossProfile }>("/profile", { method: "PUT", body: JSON.stringify(patch) });
  return d.profile;
}

export function pushConfig(cfg: { inviteCode?: string; llmEndpoint?: string; resumeBrief?: string }): Promise<unknown> {
  return call("/config", { method: "PUT", body: JSON.stringify(cfg) });
}

export function reportUrl(): string {
  return `${runnerUrl()}/report?t=${encodeURIComponent(pairCode())}`;
}

/** 一键安装命令（带上个人密钥；安装包和脚本都在门禁后面，凭个人密钥下载） */
export function installCommand(code: string): string {
  const site = window.location.origin;
  const c = code || "你的个人密钥";
  return `curl -fsSL -H "X-Invite-Code: ${c}" ${site}/runner/install.sh | bash -s -- ${c}`;
}
