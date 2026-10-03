/* 打招呼话术：三个角度各一条，生成、复制、重新生成 */

import { useState } from "react";

import { getInviteCode, hasLlmKey, setInviteCode } from "../../lib/llm";
import { useJdStore } from "../../store/useJdStore";
import { IconCheck, IconCopy, IconKey, IconRefresh, IconSpark, IconWarn, IconX } from "../icons";
import { Button, IconButton } from "../kit/Button";
import { ShimmerText } from "../kit/misc";
import { toast } from "../kit/Toast";

async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Safari 在非 https 下拿不到 clipboard，退回旧接口
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  }
}

/** 邀请码输入门：填一次存本机，成功后自动重试刚才的操作 */
function InviteGate({ onSaved }: { onSaved: () => void }) {
  const [code, setCode] = useState(getInviteCode());
  return (
    <div className="surface px-5 py-4" style={{ ["--r" as string]: "var(--r-card)" }}>
      <p className="flex items-center gap-2 text-[13px] font-semibold text-fg">
        <IconKey className="h-4 w-4" />
        需要邀请码才能生成 AI 话术
      </p>
      <p className="mt-1 text-[12.5px] text-fg-3">向站长要一个邀请码，填一次存本机即可。</p>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!code.trim()) return;
          setInviteCode(code);
          onSaved();
        }}
      >
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="邀请码" className="field w-48 !py-2" />
        <Button type="submit" variant="primary" size="md" pill disabled={!code.trim()}>
          保存并重试
        </Button>
      </form>
    </div>
  );
}

function ErrorBanner() {
  const error = useJdStore((s) => s.error);
  const dismiss = useJdStore((s) => s.dismissError);
  const generatePhrases = useJdStore((s) => s.generatePhrases);
  if (!error) return null;

  if (error.kind === "needs-invite") {
    return (
      <InviteGate
        onSaved={() => {
          dismiss();
          void generatePhrases();
        }}
      />
    );
  }

  return (
    <div className="surface anim-rise flex items-start gap-3 px-4 py-3.5" style={{ ["--r" as string]: "16px" }}>
      {error.kind === "no-key" ? <IconKey className="mt-0.5 h-4 w-4 shrink-0 text-fg-3" /> : <IconWarn className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
      <div className="min-w-0 flex-1 text-[13px]">
        <p className="font-medium text-fg">{error.message}</p>
        {error.detail && <p className="mt-1 break-words text-fg-3">{error.detail}</p>}
      </div>
      <IconButton label="关闭" size="xs" pill noTip onClick={dismiss}>
        <IconX className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );
}

export function PhraseCards() {
  const phrases = useJdStore((s) => s.phrases);
  const analysis = useJdStore((s) => s.analysis);
  const status = useJdStore((s) => s.status);
  const generatePhrases = useJdStore((s) => s.generatePhrases);
  const [copied, setCopied] = useState<number | null>(null);
  const generating = status === "generating";

  const copy = async (text: string, index: number) => {
    await writeClipboard(text);
    setCopied(index);
    toast("已复制，去招聘软件里粘贴", "success");
    window.setTimeout(() => setCopied((c) => (c === index ? null : c)), 1600);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 px-1 pt-2">
        <p className="text-[16px] font-semibold tracking-[-0.015em] text-fg">打招呼话术</p>
        {phrases.length > 0 && <span className="text-[12px] text-fg-4">点复制，粘到招聘软件</span>}
        <Button
          className="ml-auto"
          size="md"
          pill
          variant={phrases.length ? "secondary" : "primary"}
          disabled={!analysis || generating}
          onClick={() => void generatePhrases()}
          icon={phrases.length ? <IconRefresh className="h-4 w-4" /> : <IconSpark className="h-4 w-4" />}
        >
          {generating ? "生成中" : phrases.length ? "重新生成" : "生成话术"}
        </Button>
      </div>

      <ErrorBanner />

      {generating && (
        <div className="surface flex items-center gap-2.5 px-5 py-5" style={{ ["--r" as string]: "var(--r-card)" }}>
          <span className="breathe h-2 w-2 rounded-full bg-fg" />
          <ShimmerText className="text-[13px] font-medium">正在按三个角度写话术（推理模型要想一会儿，约 20–90 秒）</ShimmerText>
        </div>
      )}

      {phrases.length === 0 && !generating && (
        <div className="rounded-[var(--r-card)] px-5 py-8 text-center outline-1 -outline-offset-1 outline-dashed outline-[var(--hairline-2)]">
          <p className="text-[13px] text-fg-3">
            {hasLlmKey()
              ? "按「能力对标」「成果说话」「业务理解」三个角度各写一条，只引用简历和经历库里真实存在的内容。"
              : "还没有配置模型 API key，配好之后才能生成话术。"}
          </p>
          {!hasLlmKey() && (
            <p className="mt-2 text-[12px] text-fg-4">在项目根目录建 .env.local，写入 MINIMAX_API_KEY=你的密钥，然后重启服务。</p>
          )}
        </div>
      )}

      <div className="stagger space-y-3">
        {phrases.map((p, i) => (
          <article
            key={`${p.angle}-${i}`}
            className="surface group/phrase px-5 py-4"
            style={{ ["--r" as string]: "var(--r-card)", ["--i" as string]: i }}
          >
            <header className="mb-2.5 flex items-center gap-2">
              <span className="chip chip-sm">{p.angle}</span>
              <span className="tnum text-[11.5px] text-fg-4">{p.text.replace(/\s/g, "").length} 字</span>
              <Button
                size="xs"
                pill
                variant={copied === i ? "primary" : "ghost"}
                className="ml-auto"
                onClick={() => void copy(p.text, i)}
                icon={copied === i ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
              >
                {copied === i ? "已复制" : "复制"}
              </Button>
            </header>
            <p className="select-text whitespace-pre-wrap text-[13.5px] leading-[1.8] text-fg">{p.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
