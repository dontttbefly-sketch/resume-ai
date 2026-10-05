/* ============================================================================
 * BOSS 投递 · 网页端状态（看进度、改设置、点开始）
 *
 * 真正干活的是本机执行器（runner/boss_runner.py）：点「开始」后它在终端里
 * 自动走「下一张 → 读 JD → AI 判 → 投 / 跳」，按关键词计划换词，投到每天
 * 目标就停。这里只做三件事：
 *   1. 连接：执行器开没开 → 有没有配对 → 已连接
 *   2. 同步：每 1.2 秒拉一次实时状态；本机文件（投递记录等）变了才拉全量
 *   3. 遥控：开始 / 暂停 / 逐张确认 / 每天目标 / 设置
 *
 * 关掉网页不影响执行器继续跑；重新打开会自动接上当前进度。
 * ========================================================================== */

import { create } from "zustand";

import {
  fetchState,
  hello,
  inviteCode,
  pairCode,
  pushConfig,
  RunnerError,
  saveProfile as apiSaveProfile,
  sendAction,
  setPairCode,
  type AutoState,
  type BossProfile,
  type EnvItem,
  type ExternalInfo,
  type ListEnd,
  type LiveCard,
  type Notice,
  type Phase,
  type PlanInfo,
  type RunnerData,
  type Verdict,
} from "../lib/bossApi";
import { flattenResume, renderForModel } from "../lib/resumeText";
import { useResumeStore } from "./useResumeStore";

export const DAILY_CAP = 148;
const POLL_ONLINE_MS = 1200;
const POLL_OFFLINE_MS = 3000;

export type Conn = "checking" | "offline" | "unpaired" | "online";

interface BossState {
  conn: Conn;
  runner: { version: string; demo: boolean } | null;
  inviteConfigured: boolean;
  /** 本机文件数据 + 外部会话 / 忙碌状态 */
  snap: (RunnerData & { external: ExternalInfo; busy: string | null }) | null;
  dataVersion: string;
  plan: PlanInfo | null;

  /* 执行器实时状态（镜像） */
  card: LiveCard | null;
  jd: string;
  jdOk: boolean;
  verdict: Verdict | null;
  judgeError: string;
  phase: Phase;
  listEnd: ListEnd | null;
  notice: Notice | null;
  env: EnvItem[] | null;
  auto: AutoState;

  /** 网页这边的提示（比如「上一步还在执行」），优先于执行器的提示显示 */
  localNotice: Notice | null;

  refresh: () => Promise<void>;
  startPolling: () => () => void;
  pair: (code: string) => Promise<boolean>;
  unpair: () => void;

  start: () => Promise<void>;
  pause: () => Promise<void>;
  setConfirm: (on: boolean) => Promise<void>;
  setDailyTarget: (n: number) => Promise<void>;
  /** 逐张确认时的决定（或没在跑时手动处理当前这张） */
  deliver: () => Promise<void>;
  skip: () => Promise<void>;
  exhaustRecommend: () => Promise<void>;
  checkEnv: () => Promise<void>;
  saveProfile: (patch: Partial<BossProfile>) => Promise<boolean>;
  dismissNotice: () => void;
}

function resumeBrief(): string {
  const { sections, visibility } = useResumeStore.getState();
  return renderForModel(flattenResume(sections, visibility)).slice(0, 1100);
}

const IDLE_AUTO: AutoState = {
  running: false,
  dailyTarget: 50,
  confirm: false,
  awaiting: false,
  done: 0,
  stopReason: "",
  stopping: false,
};

export const useBossStore = create<BossState>()((set, get) => {
  /** 把判岗要用的东西交给执行器：个人密钥、判岗接口、简历摘要 */
  const handshake = () =>
    pushConfig({
      inviteCode: inviteCode(),
      llmEndpoint: `${window.location.origin}/api/llm`,
      resumeBrief: resumeBrief(),
    }).catch(() => {});

  async function act(type: string, payload: Record<string, unknown> = {}): Promise<void> {
    set({ localNotice: null });
    try {
      await sendAction(type, payload);
    } catch (e) {
      if (e instanceof RunnerError) {
        if (e.kind === "offline") set({ conn: "offline" });
        else if (e.kind === "unpaired") set({ conn: "unpaired" });
        else if (e.kind !== "rejected") set({ localNotice: { tone: "warn", text: e.message } });
      }
    }
    await get().refresh();
  }

  return {
    conn: "checking",
    runner: null,
    inviteConfigured: false,
    snap: null,
    dataVersion: "",
    plan: null,

    card: null,
    jd: "",
    jdOk: false,
    verdict: null,
    judgeError: "",
    phase: "idle",
    listEnd: null,
    notice: null,
    env: null,
    auto: IDLE_AUTO,
    localNotice: null,

    refresh: async () => {
      const wasOnline = get().conn === "online";
      if (!wasOnline) {
        const h = await hello();
        if (!h) {
          set({ conn: "offline", runner: null });
          return;
        }
        set({ runner: h });
        if (!pairCode()) {
          set({ conn: "unpaired" });
          return;
        }
      }
      try {
        const s = await fetchState(get().snap ? get().dataVersion : "");
        const data = s.data ?? get().snap;
        const live = s.live;
        set({
          conn: "online",
          inviteConfigured: s.config.inviteConfigured,
          dataVersion: s.data ? s.dataVersion : get().dataVersion,
          snap: data ? { ...data, external: s.external, busy: live.busy } : null,
          plan: s.plan,
          card: live.card,
          jd: live.jd,
          jdOk: live.jdOk,
          verdict: live.verdict,
          judgeError: live.judgeError,
          phase: live.phase,
          listEnd: live.listEnd,
          notice: get().localNotice ?? live.notice,
          env: live.env,
          auto: live.auto,
        });
        if (!wasOnline) void handshake();
      } catch (e) {
        if (e instanceof RunnerError && e.kind === "unpaired") set({ conn: "unpaired" });
        else set({ conn: "offline" });
      }
    },

    startPolling: () => {
      let stopped = false;
      let timer = 0;
      const loop = async () => {
        if (stopped) return;
        if (document.visibilityState === "visible") await get().refresh();
        if (stopped) return;
        timer = window.setTimeout(loop, get().conn === "online" ? POLL_ONLINE_MS : POLL_OFFLINE_MS);
      };
      void loop();
      return () => {
        stopped = true;
        window.clearTimeout(timer);
      };
    },

    pair: async (code) => {
      setPairCode(code);
      set({ conn: "checking" });
      await get().refresh();
      return get().conn === "online";
    },

    unpair: () => {
      setPairCode("");
      set({ conn: "unpaired", snap: null, dataVersion: "" });
    },

    start: async () => {
      await handshake();
      await act("start");
    },
    pause: () => act("pause"),
    setConfirm: (on) => {
      set((st) => ({ auto: { ...st.auto, confirm: on } }));
      return act("set_confirm", { on });
    },
    setDailyTarget: (n) => {
      const target = Math.max(1, Math.min(DAILY_CAP, Math.round(n) || 1));
      set((st) => ({ auto: { ...st.auto, dailyTarget: target } }));
      return act("set_target", { target });
    },
    deliver: () => act("deliver"),
    skip: () => act("skip"),
    exhaustRecommend: () => act("exhaust"),
    checkEnv: () => act("env"),

    saveProfile: async (patch) => {
      try {
        const profile = await apiSaveProfile(patch);
        set((st) => ({ snap: st.snap ? { ...st.snap, profile } : st.snap }));
        void get().refresh();
        return true;
      } catch (e) {
        set({ localNotice: { tone: "error", text: e instanceof Error ? e.message : String(e) } });
        return false;
      }
    },

    dismissNotice: () => {
      set({ localNotice: null, notice: null });
      void sendAction("dismiss").catch(() => {});
    },
  };
});
