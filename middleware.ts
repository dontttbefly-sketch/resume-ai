/* ============================================================================
 * 私有部署的门禁（Vercel Routing Middleware）
 *
 * 部署在 Vercel 上的这一份只给自己用：每个请求（页面、静态资源、/api/llm）
 * 都要带 Basic Auth，否则 401。在缓存之前执行，所以静态文件也绕不过去。
 *
 *   BASIC_AUTH_USER / BASIC_AUTH_PASSWORD   Vercel 项目环境变量（密码设为 Sensitive）
 *
 * 失败即关闭：两个变量任一没配，所有人都进不来 —— 想彻底关站就删掉密码变量再重新部署。
 * 本地 pnpm dev 和 GitHub Pages 都不经过这个文件。
 * ========================================================================== */

import { next } from "@vercel/functions";

export const config = {
  matcher: "/(.*)",
  runtime: "nodejs",
};

/** 等长逐位比较，避免按字符提前返回泄露比对进度 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorized(request: Request): boolean {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) return false;

  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return false;

  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  return safeEqual(decoded.slice(0, sep), user) && safeEqual(decoded.slice(sep + 1), pass);
}

export default function middleware(request: Request) {
  if (authorized(request)) return next();

  return new Response("暂不开放", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="resume", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
