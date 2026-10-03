/* ============================================================================
 * BOSS 投递服务 · 前端接口层（对应 server/bossBridge.ts）
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
  error?: string;
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

export interface BossSnapshot {
  available: boolean;
  reason?: string;
  version: string;
  busy: { action: string; since: number } | null;
  external: ExternalInfo;
  unchanged?: boolean;
  skillDir?: string;
  profile?: BossProfile;
  walk?: WalkInfo;
  delivered?: DeliveredRec[];
  counts?: { delivered: number; failed: number; blocked: number };
  today?: { date: string; delivered: number };
  activity?: ActivityRec[];
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

export interface RunOut {
  ok: boolean;
  code: number | null;
  ms: number;
  result: Record<string, unknown> | null;
  lazy: { grew?: boolean; before?: number; after?: number } | null;
  notes: string[];
  stderr: string;
  timedOut: boolean;
}

export type BossAction = "walk" | "next" | "more" | "exhaust" | "reset" | "open" | "deliver" | "reject" | "env";

export class BossError extends Error {
  readonly kind: "offline" | "busy" | "external" | "bad";
  constructor(kind: BossError["kind"], message: string) {
    super(message);
    this.name = "BossError";
    this.kind = kind;
  }
}

const BASE = "/api/boss";

export const HAS_BRIDGE: boolean = __HAS_BOSS_BRIDGE__;

export async function fetchState(version?: string): Promise<BossSnapshot> {
  if (!HAS_BRIDGE) throw new BossError("offline", "投递服务只在本机运行（pnpm dev）时可用");
  let res: Response;
  try {
    res = await fetch(`${BASE}/state${version ? `?v=${encodeURIComponent(version)}` : ""}`, { cache: "no-store" });
  } catch {
    throw new BossError("offline", "连不上本机服务");
  }
  if (!res.ok) throw new BossError("offline", `本机服务返回 ${res.status}`);
  return (await res.json()) as BossSnapshot;
}

export async function saveProfile(patch: Partial<BossProfile>): Promise<BossProfile> {
  const res = await fetch(`${BASE}/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = (await res.json().catch(() => ({}))) as { profile?: BossProfile; error?: string };
  if (!res.ok || !data.profile) throw new BossError("bad", data.error ?? `保存失败（HTTP ${res.status}）`);
  return data.profile;
}

export async function runAction(action: BossAction, params: Record<string, unknown> = {}): Promise<RunOut> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...params }),
    });
  } catch {
    throw new BossError("offline", "连不上本机服务");
  }
  const data = (await res.json().catch(() => ({}))) as RunOut & { error?: string };
  if (res.status === 409) throw new BossError("busy", "上一步还在执行，稍等一下");
  if (res.status === 423) throw new BossError("external", data.error ?? "另一个会话正在操作 BOSS 浏览器");
  if (!res.ok) throw new BossError("bad", data.error ?? `执行失败（HTTP ${res.status}）`);
  return data;
}

export const REPORT_URL = `${BASE}/report`;
