/* 打招呼话术卡片：生成、复制、重新生成 */

import { useState } from "react";

import { getInviteCode, hasLlmKey, setInviteCode } from "../../lib/llm";
import { useJdStore } from "../../store/useJdStore";
import { IconCheck, IconCopy, IconKey, IconSpark, IconWarn } from "../icons";
import { Btn } from "../ui";

async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
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
  const [saving, setSaving] = useState(false);

  const save = () => {
    if (!code.trim()) return;
    setSaving(true);
    setInviteCode(code);
    onSaved();
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">
      <p className="flex items-center gap-1.5 font-medium">
        <IconKey className="h-4 w-4" />
        需要邀请码才能生成 AI 话术
      </p>
      <p className="mt-1 opacity-80">向站长要一个邀请码，填一次存本机即可。</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="邀请码"
          className="w-[180px] rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
        <Btn variant="primary" disabled={!code.trim() || saving} onClick={save}>
          保存并重试
        </Btn>
      </div>
    </div>
  );
}

function ErrorBanner() {
  const error = useJdStore((s) => s.error);
  const dismiss = useJdStore((s) => s.dismissError);
  const generatePhrases = useJdStore((s) => s.generatePhrases);
  if (!error) return null;

  /* 邀请码这道门：输入一次存本机，之后不再问 */
  if (error.kind === "needs-invite") {
    return <InviteGate onSaved={() => { dismiss(); void generatePhrases(); }} />;
  }

  const isKeyIssue = error.kind === "no-key";
  const tone = isKeyIssue
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-[12.5px] ${tone}`}>
      {isKeyIssue ? (
        <IconKey className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <IconWarn className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{error.message}</p>
        {error.detail && (
          <p className="mt-1 break-words opacity-80">{error.detail}</p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded px-1 opacity-50 transition hover:opacity-100"
      >
        关闭
      </button>
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

  async function handleCopy(text: string, index: number) {
    await writeClipboard(text);
    setCopied(index);
    window.setTimeout(() => {
      setCopied((current) => (current === index ? null : current));
    }, 1600);
  }

  const header = (
    <div className="flex items-center gap-2">
      <h2 className="text-[13.5px] font-medium text-slate-800">打招呼话术</h2>
      {phrases.length > 0 && (
        <span className="text-[11.5px] text-slate-400">
          点复制即可粘到招聘平台
        </span>
      )}

      <div className="ml-auto">
        <Btn
          variant="outline"
          disabled={!analysis || generating}
          onClick={() => void generatePhrases()}
        >
          {generating ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-slate-300 border-t-slate-600" />
              生成中
            </>
          ) : (
            <>
              <IconSpark className="h-3.5 w-3.5" />
              {phrases.length > 0 ? "重新生成" : "生成话术"}
            </>
          )}
        </Btn>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {header}
      <ErrorBanner />

      {phrases.length === 0 && !generating && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-5 py-8 text-center">
          <p className="text-[12.5px] text-slate-500">
            {hasLlmKey()
              ? "点右上角「生成话术」，会按能力对标、成果说话、业务理解三个角度各写一条。"
              : "还没有配置模型 API key，配好之后才能生成话术。"}
          </p>
          {!hasLlmKey() && (
            <p className="mt-2 text-[11.5px] text-slate-400">
              在项目根目录建一个 .env.local 文件，写入 MINIMAX_API_KEY=你的密钥，然后重启服务。
            </p>
          )}
        </div>
      )}

      {phrases.map((phrase, index) => (
        <article
          key={`${phrase.angle}-${index}`}
          className="group rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300"
        >
          <header className="mb-2 flex items-center gap-2">
            <span className="rounded-md border border-brand/20 bg-brand-soft px-1.5 py-0.5 text-[11px] text-brand">
              {phrase.angle}
            </span>
            <span className="tnum text-[11px] text-slate-400">
              {phrase.text.replace(/\s/g, "").length} 字
            </span>

            <button
              type="button"
              onClick={() => void handleCopy(phrase.text, index)}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              {copied === index ? (
                <>
                  <IconCheck className="h-3.5 w-3.5 text-emerald-500" />
                  已复制
                </>
              ) : (
                <>
                  <IconCopy className="h-3.5 w-3.5" />
                  复制
                </>
              )}
            </button>
          </header>

          <p className="select-text whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
            {phrase.text}
          </p>
        </article>
      ))}
    </div>
  );
}
