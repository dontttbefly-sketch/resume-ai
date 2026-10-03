# 简历工作台

**跑在自己电脑上的 AI 求职工作台。写简历、对岗位、投简历、攒经历，都在一个页面里完成。**

AI 会帮你改简历、写打招呼话术、判断一个岗位值不值得投。它引用的每个事实都来自你自己的简历和经历库，不编数字，也不拔高。

![点纸上的一句话，AI 给出改写候选，一键写回简历](assets/readme/demo.gif)

<sub>截图里的「林知夏」和其中的公司、数据都是虚构的演示内容。</sub>

> 项目已部署在 Vercel 上，暂不对外开放。想试用的话，欢迎发邮件到 [15916363770@163.com](mailto:15916363770@163.com) 联系我。

## 四个视图，对应求职的四件事

| 视图 | 做什么 |
|---|---|
| **简历** | 所见即所得的 A4 纸，点哪段让 AI 改哪段，一键导出 PDF |
| **岗位** | 粘贴 JD 看匹配度和缺口，生成三条可以直接发的打招呼话术 |
| **投递** | BOSS 直聘逐张处理：读 JD，AI 按你的规则判断，然后投或跳过 |
| **经历** | 和 AI 聊出经历细节，存进经历库，供上面三处引用 |

### 简历：在纸上改，看到的就是成品

![简历视图：左边编辑，中间 A4 纸，右边 AI 顾问](assets/readme/studio.webp)

- 中间是最终的 A4 成品，左边面板逐字段编辑，改动实时显示在纸上
- 点纸上任意一句（可多选），对 AI 顾问说哪里不满意，它给出 2–3 个候选，点「应用」写回原处
- 底部浮条显示页数和剩余空间，一页装不装得下一眼就知道
- 抬头可以放证件照和作品二维码，导出后二维码照样能扫
- 导出的 PDF 是可选中、可搜索的文字，招聘系统能正常解析关键词
- 最多 3 份档案，可以从一份复制出另一个求职方向的版本

### 岗位：先看差在哪，再决定怎么打招呼

![岗位视图：匹配度、已覆盖与待补充的关键词、三条打招呼话术](assets/readme/match.webp)

- 粘贴岗位描述，本地按关键词加权算出匹配度，列出已覆盖和待补充的能力，并标出缺失的核心项。这一步不调模型，同一份输入每次结果一样，也能逐项解释
- 「生成话术」按能力对标、成果说话、业务理解三个角度各写一条，每条 60–110 字，复制就能发
- 「岗位池」读取从实习僧抓下来的岗位，按和你简历的匹配度排序，看中哪个就送去做完整分析

![岗位池：实习僧岗位按匹配度排序](assets/readme/pool.webp)

### 投递：一张一张地读、判、投

![投递视图：当前岗位、JD、AI 结论，右侧是判岗画像](assets/readme/deliver.webp)

- 控制你电脑上已登录 BOSS 直聘的浏览器，一次处理一张卡片：读 JD，AI 按「判岗画像」给出投或不投和理由，再由你确认
- 也可以切到自动模式连续投递；达到本轮目标、每日上限，或遇到异常弹窗时自动停止
- 求职方向、城市、薪资区间、希望投和不投的类型、判岗规则，都在页面上直接改
- 今日动态、累计投递数，以及按行业或方向分组的投递记录，都在同一页

> 投递只能在本机运行，因为它要控制你电脑上的浏览器。它基于 [boss-zhipin-assistant](https://github.com/taohuajianxian/boss-zhipin-assistant) 的 Ego Lite 移植版，需要安装 Ego Lite 浏览器。技能目录默认放在项目根下的 `boss-zhipin-assistant-egolite/`，放在别处就在 `.env.local` 里设置 `BOSS_SKILL_DIR`。

### 经历：先把事实攒下来

![经历视图：经历卡片，右侧是经历挖掘对话](assets/readme/library.webp)

- 「经历挖掘」像朋友聊天，一次只问一个问题，追问做了什么、怎么做的、结果是多少
- 聊完点「提炼入库」，整段对话会被整理成一张经历卡
- 后面改简历、写话术、判断岗位时，AI 从简历和经历库里取事实

## AI 不替你编

- 提示词明确要求只引用简历和经历库里有的内容，不编造公司、数字或技能
- 话术的动词强度不能超过简历原文，简历写「接入」，话术就不会写成「主导」
- 判岗拿不准时判不投，并写明哪里不确定

## 其他细节

![深色模式](assets/readme/dark.webp)

- 支持浅色、深色和跟随系统，界面是黑白灰的毛玻璃风格
- 头像菜单里有简历完成度检查、简历强调色（经典蓝 / 墨黑）和云同步登录
- 快捷键：`⌘P` 导出 PDF，`⌘K` 打开 AI 顾问，`⌘\` 收起内容面板
- 数据默认只存在浏览器本地；登录后可以云同步

## 快速开始

需要 Node 22.12 或更高版本。

```bash
git clone https://github.com/dontttbefly-sketch/resume-ai.git
cd resume-ai
pnpm install
pnpm dev        # 打开 http://localhost:5173
```

在 macOS 上也可以双击项目里的 `启动.command`。

简历编辑和匹配度分析不需要配置。要用 AI 功能，在项目根目录新建 `.env.local`，写一行：

```
MINIMAX_API_KEY=你的密钥
```

默认用 MiniMax。其他兼容 OpenAI `/chat/completions` 接口的模型也可以，另外设置 `MINIMAX_BASE_URL` 和 `MINIMAX_MODEL` 即可。密钥只在本机开发服务器里使用，不会进入网页代码。

## 想改什么

| 想做的事 | 改哪里 |
|---|---|
| 给简历加一个模块（比如获奖经历） | `src/data/sections.ts`，编辑器、纸面和完成度检查会自动跟上 |
| 让匹配度认识更多关键词 | `src/data/jdLexicon.ts` |
| 调整配色、玻璃质感、动效 | `src/styles/` |
| 抓实习僧岗位 | `scripts/shixiseng/`，说明见目录里的 README |

技术栈：React 19、TypeScript、Vite、Tailwind CSS 4、Zustand。

## 部署

在线版：<https://dontttbefly-sketch.github.io/resume-ai/>（AI 功能需要邀请码，没有投递视图）

- **前端**：push 到 `main` 后自动构建并发布到 GitHub Pages（`.github/workflows/deploy.yml`）
- **AI 代理**：`worker/` 是一个 Cloudflare Worker，负责保管模型密钥和校验邀请码，部署方法见 [worker/README.md](worker/README.md)
- **云同步**（可选）：自建 Supabase 项目，建一张 `resumes` 表（SQL 见 [worker/README.md](worker/README.md)），设置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`
- **个人数据**：真实简历放在 `src/data/private/`，证件照和二维码放在 `public/private/`，这两个目录不进仓库；没有时自动载入示例简历
- **Vercel**：`vercel.json`、`middleware.ts`、`api/llm.ts` 是 Vercel 部署用的：整站 Basic Auth 密码门，加一个同源的模型代理
