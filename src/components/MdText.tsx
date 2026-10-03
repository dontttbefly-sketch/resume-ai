/* 轻量 Markdown 渲染：AI 回复里常见的 **粗体**、`代码`、列表、小标题 */

import type { ReactNode } from "react";

function inlineNodes(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[0].startsWith("**")) {
      parts.push(
        <strong key={k++} className="font-semibold text-fg">
          {m[0].slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <code key={k++} className="rounded-[5px] bg-fill-2 px-1 py-px font-mono text-[0.88em] text-fg-2">
          {m[0].slice(1, -1)}
        </code>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MdText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  let ordered = false;
  const flush = () => {
    if (!list.length) return;
    out.push(
      ordered ? (
        <ol key={out.length} className="my-1 list-decimal space-y-1 pl-5 marker:text-fg-4">
          {list}
        </ol>
      ) : (
        <ul key={out.length} className="my-1 list-disc space-y-1 pl-5 marker:text-fg-4">
          {list}
        </ul>
      ),
    );
    list = [];
  };
  text.split("\n").forEach((line, i) => {
    const t = line.trim();
    if (!t) {
      flush();
      return;
    }
    const ul = t.match(/^[-•*]\s+(.*)/);
    const ol = t.match(/^(\d+)[.、)]\s*(.*)/);
    const h = t.match(/^#{1,4}\s+(.*)/);
    if (ul) {
      if (ordered) flush();
      ordered = false;
      list.push(<li key={i}>{inlineNodes(ul[1])}</li>);
      return;
    }
    if (ol) {
      if (!ordered) flush();
      ordered = true;
      list.push(<li key={i}>{inlineNodes(ol[2])}</li>);
      return;
    }
    flush();
    if (h) {
      out.push(
        <p key={i} className="mb-0.5 mt-2 text-[13.5px] font-semibold tracking-[-0.01em] text-fg">
          {inlineNodes(h[1])}
        </p>,
      );
      return;
    }
    out.push(<p key={i}>{inlineNodes(t)}</p>);
  });
  flush();
  return <div className="space-y-1.5">{out}</div>;
}
