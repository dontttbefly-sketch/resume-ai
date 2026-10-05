/* ============================================================================
 * 顶栏的 AI 额度胶囊（线上版）：额度 28 万
 *
 * 只给「花站长额度」的人看：站长不限额度、填了自己模型密钥的人不扣额度，都不显示。
 * 每次调完 AI 余额随响应头带回（见 lib/llm.ts），数字滚动着变小；
 * 不到 5 万时前面亮一个小红点，用完了直接写「额度用完」。点开是 AI 额度弹窗。
 * ========================================================================== */

import { useState } from "react";

import { fmtTokens, useAccount } from "../../lib/account";
import { Button } from "../kit/Button";
import { NumberTicker } from "../kit/misc";
import { AiQuotaDialog } from "./AccountDialogs";

const LOW = 50_000;

export function QuotaPill() {
  const me = useAccount((s) => s.me);
  const [open, setOpen] = useState(false);
  if (!me || me.role === "owner" || me.ownLlm) return null;

  const empty = me.quota <= 0;
  const low = !empty && me.quota < LOW;

  return (
    <>
      <Button
        size="md"
        pill
        variant="secondary"
        className="anim-fade gap-1.5"
        data-tip={empty ? "AI 额度用完了，点开看怎么办" : `AI 额度还剩 ${fmtTokens(me.quota)} token`}
        onClick={() => setOpen(true)}
      >
        {empty ? (
          <span className="text-danger">额度用完</span>
        ) : (
          <>
            {low && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />}
            <span className="font-normal text-fg-3">额度</span>
            <NumberTicker value={me.quota} format={fmtTokens} />
          </>
        )}
      </Button>
      <AiQuotaDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
