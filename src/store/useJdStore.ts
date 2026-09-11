/* ============================================================================
 * 岗位匹配状态
 *
 * 与简历数据分开存（localStorage 用不同的 key），避免两边互相覆盖。
 * 简历是「我有什么」，JD 是「对方要什么」，生命周期完全不同。
 * ========================================================================== */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { analyzeJd, type JdAnalysis } from "../lib/jdMatch";
import { chat, LlmError, type LlmErrorKind } from "../lib/llm";
import { buildPhraseMessages, parsePhrases, type Phrase } from "../lib/prompts";
import { flattenResume } from "../lib/resumeText";
import { useExperienceStore } from "./useExperienceStore";
import { useResumeStore } from "./useResumeStore";

const STORAGE_KEY = "resume-ai/jd";
const STORAGE_VERSION = 1;

export type JdStatus = "idle" | "analyzing" | "generating" | "ready";

export interface JdError {
  kind: LlmErrorKind;
  message: string;
  detail: string;
}

interface JdState {
  jdText: string;
  analysis: JdAnalysis | null;
  phrases: Phrase[];
  status: JdStatus;
  error: JdError | null;

  setJdText: (text: string) => void;
  analyze: () => void;
  generatePhrases: () => Promise<void>;
  clearJd: () => void;
  resetPhrases: () => void;
  dismissError: () => void;
}

const EMPTY = {
  jdText: "",
  analysis: null,
  phrases: [],
  status: "idle" as JdStatus,
  error: null,
};

export const useJdStore = create<JdState>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      setJdText: (text) => set({ jdText: text }),

      analyze: () => {
        const jdText = get().jdText;
        if (!jdText.trim()) {
          set({ analysis: null, phrases: [], status: "idle" });
          return;
        }

        const { sections, visibility } = useResumeStore.getState();
        const flat = flattenResume(sections, visibility);
        const analysis = analyzeJd(jdText, flat);

        set({ analysis, phrases: [], error: null, status: "ready" });
      },

      generatePhrases: async () => {
        const { jdText, analysis } = get();
        if (!analysis || !jdText.trim()) return;

        set({ status: "generating", error: null });

        try {
          const { sections, visibility } = useResumeStore.getState();
          const flat = flattenResume(sections, visibility);
          const library = useExperienceStore
            .getState()
            .items.map((i) => `- ${i.company}｜${i.project}：${i.summary}`)
            .join("\n");
          const messages = buildPhraseMessages(flat, jdText, analysis, library);
          const raw = await chat(messages);
          const phrases = parsePhrases(raw);

          if (!phrases.length) {
            throw new LlmError("bad-response", "话术解析失败，模型返回的格式不符合预期", raw.slice(0, 300));
          }

          set({ phrases, status: "ready" });
        } catch (err) {
          const e =
            err instanceof LlmError
              ? err
              : new LlmError("unknown", err instanceof Error ? err.message : String(err));
          set({
            status: "ready",
            error: { kind: e.kind, message: e.message, detail: e.detail },
          });
        }
      },

      clearJd: () => set({ ...EMPTY }),

      resetPhrases: () => set({ phrases: [], error: null }),

      dismissError: () => set({ error: null }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),

      // 只留「有内容」的字段，临时状态（status / error）不落盘
      partialize: (state) => ({
        jdText: state.jdText,
        analysis: state.analysis,
        phrases: state.phrases,
      }),
    },
  ),
);
