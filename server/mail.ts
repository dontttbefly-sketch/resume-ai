/* ============================================================================
 * 发注册验证码：Resend（Vercel Marketplace 集成，注入 RESEND_API_KEY）
 *
 * 发件域名 mail.kongbei.xyz 要先在 Resend 验证过（DNS 记录在 Cloudflare 上，
 * 见 docs/私有部署-Vercel.md）。换发件人用环境变量 MAIL_FROM。
 * ========================================================================== */

export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendCode(to: string, code: string): Promise<void> {
  const from = process.env.MAIL_FROM ?? "简历工作台 <noreply@mail.kongbei.xyz>";
  const text = `你的注册验证码是 ${code}，10 分钟内有效。\n\n如果不是你本人操作，忽略这封邮件即可。`;
  const html = `<div style="font-family:-apple-system,'PingFang SC',sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;color:#0b0b0c">
  <p style="margin:0;font-size:15px;font-weight:600">简历工作台</p>
  <p style="margin:24px 0 8px;font-size:14px;color:#6c6c73">你的注册验证码</p>
  <p style="margin:0;font-size:34px;font-weight:600;letter-spacing:.18em">${code}</p>
  <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#6c6c73">10 分钟内有效。如果不是你本人操作，忽略这封邮件即可。</p>
</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: `${code} 是你的注册验证码 · 简历工作台`, text, html }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
  }
}
