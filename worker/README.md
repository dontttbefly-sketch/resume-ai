# worker（AI 代理）

前端所有模型请求都发到这里：它保管 API key、校验邀请码、限速。
前端仓库完全开源，这个目录也开源 —— **但所有秘密都在 Cloudflare 后台的 Secrets 里**，代码库里什么都没有。

## 部署步骤（一次性，约 3 分钟）

```bash
cd worker
npm install
npx wrangler login          # 浏览器授权一次

# 三个 secret（交互式粘贴，回车确认）
npx wrangler secret put MINIMAX_API_KEY     # 你的模型 API key
npx wrangler secret put INVITE_CODES        # 逗号分隔，如 12345
npx wrangler deploy

# 部署完会输出形如 https://resume-ai-llm.<你的子域>.workers.dev 的地址
```

## 部署后

1. 把 workers.dev 地址填到前端（设置入口 / `VITE_LLM_PROXY_URL`）
2. 若要限制来源：编辑 `wrangler.toml` 的 `ALLOWED_ORIGINS`（逗号分隔）再 `wrangler deploy`

## 接口

`POST /api/llm`

- 请求头：`X-Invite-Code: <邀请码>`
- 请求体：OpenAI 兼容的 chat/completions 参数
- 错误：`401` 邀请码无效 / `429` 超过每小时限额 / `502` 上游失败

## 本地调试

```bash
npx wrangler dev            # 本地起 worker，默认 :8787
MINIMAX_API_KEY=xxx INVITE_CODES=12345 npx wrangler dev --var MINIMAX_API_KEY:xxx --var INVITE_CODES:12345
```

## 改邀请码

```bash
npx wrangler secret put INVITE_CODES
```
即时生效，不用重新部署。
