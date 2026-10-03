/* ============================================================================
 * BOSS 投递 · 状态机
 *
 *   同步：每 4 秒向本机服务拉一次快照（版本号没变只回 unchanged，几十字节）
 *   单步：下一张 → 读 JD → AI 判 → 投递 / 跳过
 *         手动模式最后一步由你点；自动模式把单步串成循环
 *
 * 护栏（与技能红线一致，不放松任何一条）：
 *   - 一次只处理一张卡，严格按列表顺序（游标在脚本里，网页不跳序）
 *   - 投递超时 ≠ 已投递：停下提示，不补记录
 *   - 未知弹窗 / 页面异常 / 日上限：整批停手，交给人
 *   - 今日已投到 148（BOSS 上限 150/天）自动收工
 *   - 别的会话正在操作浏览器时，网页只看不动
 * ========================================================================== */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  BossError,
  fetchState,
  runAction,
  saveProfile as apiSaveProfile,
  type BossProfile,
  type BossSnapshot,
  type RunOut,
  type Surface,
} from "../lib/bossApi";
import { judgeJob, ruleVerdict, type Verdict } from "../lib/bossJudge";
import { LlmError } from "../lib/llm";
import { flattenResume, renderForModel } from "../lib/resumeText";
import { useResumeStore } from "./useResumeStore";

export const DAILY_CAP = 148;
const POLL_MS = 4000;

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

export type StartSource = { kind: "resume" } | { kind: "recommend" } | { kind: "keyword"; keyword: string };

interface BossState {
  conn: "unknown" | "online" | "offline";
  offlineReason: string;
  snap: BossSnapshot | null;

  card: LiveCard | null;
  jd: string;
  jdOk: boolean;
  verdict: Verdict | null;
  judgeError: string;
  phase: Phase;
  listEnd: ListEnd | null;
  notice: Notice | null;
  env: EnvItem[] | null;

  mode: "manual" | "auto";
  target: number;
  auto: { running: boolean; done: number; stopReason: string; stopping: boolean };

  refresh: () => Promise<void>;
  startPolling: () => () => void;
  setMode: (m: "manual" | "auto") => void;
  setTarget: (n: number) => void;
  begin: (source: StartSource) => Promise<void>;
  next: () => Promise<void>;
  rejudge: () => Promise<void>;
  deliver: (by?: "manual" | "auto") => Promise<boolean>;
  skip: (by?: "manual" | "auto" | "rule", reason?: string) => Promise<void>;
  startAuto: () => void;
  stopAuto: (reason?: string) => void;
  exhaustRecommend: () => Promise<void>;
  checkEnv: () => Promise<void>;
  saveProfile: (patch: Partial<BossProfile>) => Promise<boolean>;
  dismissNotice: () => void;
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

function lastLine(s: string): string {
  return s.split("\n").filter(Boolean).pop() ?? "";
}

/** 把脚本的报错翻成人话 */
function explainFailure(out: RunOut): string {
  const err = `${out.stderr}\n${out.notes.join("\n")}`;
  if (out.timedOut) return "脚本执行超时（浏览器可能卡住了），去 Ego 浏览器看一眼";
  if (err.includes("未知弹窗")) return "出现未知弹窗，已整批停手：请到 Ego 浏览器里处理后再继续";
  if (err.includes("不感兴趣")) return "误触了「不感兴趣」弹窗，已整批停手：请到 Ego 浏览器里处理";
  if (err.includes("TaskSpace") || err.includes("ego-browser")) return "连不上 Ego 浏览器：确认 Ego Lite 已打开";
  return lastLine(out.stderr) || "脚本执行失败";
}

function errText(e: unknown): string {
  if (e instanceof BossError || e instanceof LlmError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

function resumeBrief(): string {
  const { sections, visibility } = useResumeStore.getState();
  return renderForModel(flattenResume(sections, visibility)).slice(0, 1100);
}

export const useBossStore = create<BossState>()(
  persist(
    (set, get) => {
      /* ---------------------------- 内部步骤 ---------------------------- */

      const running = () => get().auto.running;

      /** 呈现下一张卡（或列表到底 / 被规则拦截） */
      async function present(action: "walk" | "next" | "more", keyword?: string): Promise<"card" | "end" | "blocked"> {
        set({
          phase: action === "more" ? "scrolling" : "walking",
          verdict: null,
          jd: "",
          jdOk: false,
          judgeError: "",
          listEnd: null,
        });
        const out = await runAction(action, keyword ? { keyword } : {});
        const r = out.result;
        if (!r) {
          set({ phase: "idle" });
          throw new Error(explainFailure(out));
        }
        if (r.blocked) {
          set({
            card: null,
            phase: "idle",
            listEnd: { keyword: keyword ?? "", kwExhausted: false, recommendExhausted: false, blocked: String(r.reason ?? "被规则拦截") },
          });
          return "blocked";
        }
        if (r.view_exhausted) {
          set({
            card: null,
            phase: "idle",
            listEnd: {
              keyword: String(r.keyword ?? ""),
              kwExhausted: Boolean(r.kw_exhausted),
              recommendExhausted: Boolean(r.recommend_exhausted),
            },
          });
          return "end";
        }
        if (r.job) {
          set({
            card: {
              surface: r.job as Surface,
              position: Number(r.present ?? 0),
              visibleTotal: Number(r.visible_total ?? 0),
              autoSkipped: Array.isArray(r.auto_skipped_mech) ? r.auto_skipped_mech.length : 0,
            },
            phase: "idle",
          });
          return "card";
        }
        set({ phase: "idle" });
        throw new Error("脚本返回了无法识别的结果");
      }

      /** 读 JD + AI 判（命中机械规则时不读 JD、不调模型） */
      async function prepare(): Promise<void> {
        const card = get().card;
        if (!card || card.outcome) return;
        const profile = get().snap?.profile ?? {};
        const jobId = card.surface.jobId;

        const rule = ruleVerdict(card.surface, profile);
        if (rule) {
          set({ verdict: rule, phase: "awaiting" });
          return;
        }

        set({ phase: "opening" });
        const out = await runAction("open", { jobId });
        if (get().card?.surface.jobId !== jobId) return;
        const r = out.result ?? {};
        const detail = String(r.detail ?? "").trim();
        set({ jd: detail, jdOk: Boolean(r.panel_ok) && detail.length > 0 });
        if (!get().jdOk) {
          set({ phase: "awaiting", judgeError: "右侧面板没切到这张卡，JD 没读到（可以重试，或直接跳过）" });
          return;
        }

        set({ phase: "judging" });
        try {
          const v = await judgeJob(card.surface, detail, profile, resumeBrief());
          if (get().card?.surface.jobId === jobId) set({ verdict: v, phase: "awaiting" });
        } catch (e) {
          if (get().card?.surface.jobId === jobId) set({ judgeError: errText(e), phase: "awaiting" });
        }
      }

      async function guard(task: () => Promise<void>): Promise<void> {
        try {
          await task();
        } catch (e) {
          const text = errText(e);
          set({ phase: "idle", notice: { tone: e instanceof BossError && e.kind === "external" ? "warn" : "error", text } });
          if (running()) get().stopAuto(text);
        }
      }

      async function autoLoop(): Promise<void> {
        let dry = 0;
        while (running()) {
          const today = get().snap?.today?.delivered ?? 0;
          if (today >= DAILY_CAP) {
            get().stopAuto(`今日已投 ${today} 份，按惯例收工（BOSS 上限 150/天）`);
            return;
          }
          if (get().auto.done >= get().target) {
            get().stopAuto(`本轮目标 ${get().target} 份已完成`);
            return;
          }

          const card = get().card;
          if (!card || card.outcome) {
            const res = await present("next");
            if (!running()) return;
            if (res === "blocked") {
              get().stopAuto(get().listEnd?.blocked ?? "被规则拦截");
              return;
            }
            if (res === "end") {
              const le = get().listEnd!;
              if (le.kwExhausted) {
                get().stopAuto(le.keyword ? `关键词「${le.keyword}」已翻到底，换个关键词继续` : "这一页已翻到底");
                return;
              }
              const more = await present("more");
              if (!running()) return;
              if (more !== "card") {
                dry += 1;
                if (dry >= 2) {
                  get().stopAuto("滚动后没有新岗位了，换个关键词继续");
                  return;
                }
                continue;
              }
            }
            dry = 0;
          }

          if (!get().verdict && !get().judgeError) await prepare();
          if (!running()) return;

          const v = get().verdict;
          if (!v) {
            if (!get().jdOk) {
              // 面板没切过去：多半是卡片被列表重排挤掉了，不记判否，下一张
              const c = get().card;
              if (c) set({ card: { ...c, outcome: "vanished", outcomeNote: "面板没切到这张卡，已略过" } });
              continue;
            }
            get().stopAuto(`AI 判断失败：${get().judgeError}`);
            return;
          }

          if (v.deliver) await get().deliver("auto");
          else await get().skip(v.source === "rule" ? "rule" : "auto", v.reason);
          if (!running()) return;
          // 像人一样留一点间隔
          await sleep(900 + Math.random() * 1600);
        }
      }

      /* ---------------------------- 对外动作 ---------------------------- */

      return {
        conn: "unknown",
        offlineReason: "",
        snap: null,

        card: null,
        jd: "",
        jdOk: false,
        verdict: null,
        judgeError: "",
        phase: "idle",
        listEnd: null,
        notice: null,
        env: null,

        mode: "manual",
        target: 30,
        auto: { running: false, done: 0, stopReason: "", stopping: false },

        refresh: async () => {
          try {
            const prev = get().snap;
            const s = await fetchState(prev?.version);
            if (!s.available) {
              set({ conn: "offline", offlineReason: s.reason ?? "投递技能不可用", snap: null });
              return;
            }
            if (s.unchanged && prev) {
              set({ conn: "online", snap: { ...prev, busy: s.busy, external: s.external } });
            } else {
              set({ conn: "online", offlineReason: "", snap: s });
            }
          } catch (e) {
            set({ conn: "offline", offlineReason: errText(e) });
          }
        },

        startPolling: () => {
          void get().refresh();
          const id = window.setInterval(() => {
            if (document.visibilityState === "visible" || running()) void get().refresh();
          }, POLL_MS);
          return () => window.clearInterval(id);
        },

        setMode: (mode) => set({ mode }),
        setTarget: (n) => set({ target: Math.max(1, Math.min(DAILY_CAP, Math.round(n) || 1)) }),

        begin: (source) =>
          guard(async () => {
            set({ notice: null });
            const res =
              source.kind === "resume"
                ? await present("next")
                : source.kind === "recommend"
                  ? await present("walk")
                  : await present("walk", source.keyword);
            if (res === "card" && get().mode === "manual") await prepare();
          }),

        next: () =>
          guard(async () => {
            set({ notice: null });
            let res = await present("next");
            if (res === "end" && !get().listEnd?.kwExhausted) res = await present("more");
            if (res === "card") await prepare();
          }),

        rejudge: () =>
          guard(async () => {
            set({ verdict: null, judgeError: "" });
            await prepare();
          }),

        deliver: async (by = "manual") => {
          const { card, verdict } = get();
          if (!card || card.outcome) return false;
          const s = card.surface;
          set({ phase: "delivering", notice: null });
          let out: RunOut;
          try {
            out = await runAction("deliver", {
              jobId: s.jobId,
              company: s.company ?? "",
              salary: s.salary ?? "",
              industry: s.industry ?? "",
              direction: verdict?.direction ?? "",
              note: { title: s.title, company: s.company, salary: s.salary, city: s.city, industry: s.industry, reason: verdict?.reason, by },
            });
          } catch (e) {
            const text = errText(e);
            set({ phase: "awaiting", notice: { tone: "error", text } });
            if (running()) get().stopAuto(text);
            return false;
          }
          const r = out.result ?? {};
          if (r.delivered_ok) {
            set((st) => ({
              phase: "idle",
              card: st.card ? { ...st.card, outcome: "delivered" } : null,
              auto: by === "auto" ? { ...st.auto, done: st.auto.done + 1 } : st.auto,
            }));
            void get().refresh();
            return true;
          }

          let text: string;
          let fatal = true;
          if (r.daily_limit) text = "BOSS 提示今日沟通次数已达上限，今天先到这里";
          else if (r.not_found) {
            text = "这张卡已从列表消失（BOSS 列表会动态重排），已略过";
            fatal = false;
          } else if (r.anomaly) text = `页面异常：${String(r.anomaly)}。去 Ego 浏览器看一眼（可能是验证码或登录过期）`;
          else if (r.timeout)
            text = "投递超时：可能已达每日上限，或卡片被列表重排挤掉。超时不等于已投递，别手动补记录，稍后重试这一张。";
          else if (!out.ok) text = explainFailure(out);
          else text = String(r.reason ?? "投递没有成功");

          set((st) => ({
            phase: "idle",
            card: st.card ? { ...st.card, outcome: fatal ? "failed" : "vanished", outcomeNote: text } : null,
            notice: { tone: fatal ? "error" : "warn", text },
          }));
          if (fatal && running()) get().stopAuto(text);
          return false;
        },

        skip: async (by = "manual", reason) => {
          const { card, verdict } = get();
          if (!card || card.outcome) return;
          const s = card.surface;
          set({ phase: "rejecting" });
          try {
            await runAction("reject", {
              jobId: s.jobId,
              note: {
                title: s.title,
                company: s.company,
                salary: s.salary,
                city: s.city,
                industry: s.industry,
                reason: reason ?? (verdict && !verdict.deliver ? verdict.reason : "手动跳过"),
                by,
              },
            });
            set((st) => ({ phase: "idle", card: st.card ? { ...st.card, outcome: "rejected" } : null }));
            void get().refresh();
          } catch (e) {
            const text = errText(e);
            set({ phase: "awaiting", notice: { tone: "error", text } });
            if (running()) get().stopAuto(text);
          }
        },

        startAuto: () => {
          if (running()) return;
          const ext = get().snap?.external;
          if (ext?.active) {
            set({ notice: { tone: "warn", text: `${ext.reason}，等它停下再开自动投递` } });
            return;
          }
          set({ auto: { running: true, done: 0, stopReason: "", stopping: false }, notice: null, listEnd: null });
          void guard(autoLoop).finally(() => {
            set((st) => ({ auto: { ...st.auto, running: false, stopping: false } }));
          });
        },

        stopAuto: (reason) =>
          set((st) => ({
            auto: {
              ...st.auto,
              running: false,
              // 当前这一步（脚本子进程）会跑完再停
              stopping: st.phase !== "idle" && st.phase !== "awaiting",
              stopReason: reason ?? "已手动暂停",
            },
          })),

        exhaustRecommend: () =>
          guard(async () => {
            set({ phase: "exhausting", notice: { tone: "info", text: "正在把推荐页滚到底，可能要几分钟…" } });
            const out = await runAction("exhaust");
            set({ phase: "idle" });
            if (!out.result) throw new Error(explainFailure(out));
            set({ notice: { tone: "info", text: "推荐页已翻到底，关键词搜索已解锁" }, listEnd: null });
            void get().refresh();
          }),

        checkEnv: () =>
          guard(async () => {
            set({ phase: "checking", env: null });
            const out = await runAction("env");
            const items: EnvItem[] = [];
            for (const line of out.notes) {
              const m = line.match(/^(✅|❌)\s*([^:：]+)[:：]\s*(.*)$/);
              if (m) items.push({ ok: m[1] === "✅", name: m[2].trim(), detail: m[3].trim() });
            }
            set({ phase: "idle", env: items.length ? items : [{ ok: out.ok, name: "环境检测", detail: lastLine(out.stderr) || "完成" }] });
          }),

        saveProfile: async (patch) => {
          try {
            const profile = await apiSaveProfile(patch);
            set((st) => ({ snap: st.snap ? { ...st.snap, profile } : st.snap }));
            void get().refresh();
            return true;
          } catch (e) {
            set({ notice: { tone: "error", text: errText(e) } });
            return false;
          }
        },

        dismissNotice: () => set({ notice: null }),
      };
    },
    {
      name: "resume-ai/boss",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ mode: s.mode, target: s.target }),
    },
  ),
);
