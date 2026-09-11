# 实习僧岗位抓取（只读，不投递）

2026-09-10 实测通过。给「简历工作台」的岗位匹配功能喂真实岗位数据用。

## 结论速览

| 环节 | 实测结果 |
|---|---|
| 列表页抓取 | ✅ **免登录**，一次抓到 20 个/页，共 17 页（约 340 个岗位） |
| 详情页 JD | ✅ **免登录**读全文：职位描述、任职要求、截止日期、工作地点、公司简介 |
| 字体反爬 | ⚠️ 有，但**可完全破解**（98 个私用区码点 100% 解出） |
| 投递动作 | ❌ **必须登录** —— 点「投个简历」会弹出登录框（微信扫码/短信/密码/微博/QQ） |
| 验证码 | 只读抓取全程**没遇到**滑块或图形验证码 |
| 限速需求 | 页面之间有停顿即可，未触发风控 |

一句话：**抓数据非常顺，投简历必须人工登录。**

## 怎么跑

```bash
# 默认：深圳 · AI产品经理 · 3 页（60 个岗位）
# 跑完会自动把干净数据复制到 public/shixiseng-jobs.json
./scripts/shixiseng/run.sh

# 抓满
SXS_PAGES=17 ./scripts/shixiseng/run.sh

# 换关键词 / 城市
SXS_KEYWORD=大模型 SXS_CITY=北京 ./scripts/shixiseng/run.sh
```

产物在 `$SXS_OUT`（默认 `/tmp/sxs`）：

| 文件 | 内容 |
|---|---|
| `raw.json` | 原始数据，含未解码的私用区字符 |
| `font.woff` | 站点当前字体文件（解码用） |
| `jobs.json` | **解码后的干净结构化数据** ← 要的就是它 |
| `fontmap.json` | 码点映射表，可长期复用 |

`sample-jobs.json` 是本目录里保留的一次真实抓取结果（深圳 · AI产品经理 · 60 个岗位），可以直接拿来看数据结构。

## 第二段：抓详情页 JD（精筛用）

列表页只有岗位名 + 优势标签，粗筛分只反映「岗位方向对不对口」。想让匹配度变成真的能力项覆盖，抓详情页：

```bash
# 默认抓 /tmp/sxs/jobs.json 里还没抓过 JD 的前 10 个
./scripts/shixiseng/run-detail.sh

# 抓前 30 个 / 只抓标题含 AI 的 / 换数据源
SXS_LIMIT=30 ./scripts/shixiseng/run-detail.sh
SXS_INCLUDE="AI" ./scripts/shixiseng/run-detail.sh
SXS_JOBS=/tmp/sxs-test/jobs.json SXS_OUT=/tmp/sxs-test SXS_LIMIT=2 ./scripts/shixiseng/run-detail.sh
```

产物 `jobs-detail.json` = 原结构 + 每条多了 `jd`（正文）和 `degree`（学历要求）字段。
2026-09-10 实测：2/2 成功，JD 全文可读、0 残留私用区字符。

进岗位池任选其一：

```bash
# 方式一：复制成快照，打开工作台「岗位池」自动加载
cp $SXS_OUT/jobs-detail.json public/shixiseng-jobs.json
# 方式二：浏览器里点「选择文件」导入
```

## 岗位池面板（工作台第三个 tab）

打开工作台 →「岗位池」，数据流是：

```
run.sh 抓列表 → 自动复制到 public/shixiseng-jobs.json → 面板自动 fetch 加载
                ↘ run-detail.sh 抓 JD → 复制/导入 → 卡片从「粗筛」变「已抓 JD」
```

- 每个岗位用本地词典匹配引擎（`src/lib/jdMatch.ts`）算匹配度，**纯本地、不调模型**
- 粗筛文本太短时会出现一片 100 分（命中的几个词简历恰好全有），所以同分时再按「已抓 JD 优先 → 命中词更多 → 日薪更高」排
- 筛选：匹配度下限 / 标题必含 / 标题排除 / 只看已抓 JD
- 「看详情」会把这条岗位送进「岗位匹配」tab，出完整分析和打招呼话术
- 卡片上的外链图标打开岗位页 —— **投递请人工登录后自己点**

## 字体反爬是怎么破的

实习僧给带 `.font` 类的元素套了自定义字体 `myFont`，把数字和部分字母的码点换成了私用区字符（U+E000–U+F8FF）。直接读 `textContent` 会得到：

```
"\uf8fe\uf094\ueed9-\ue798\uf094\ueed9/天"      ← 实际是 150-250/天
"产品经理实习\ue2a6（\uec79\ue65e产品）"          ← 实际是 产品经理实习生（AI产品）
```

**破法**：这个字体在 `cmap` 里把真实字符写进了**字形名**。

```
U+E798 -> glyph "uni32"     （0x32 = '2'）
U+E2A6 -> glyph "uni751F"   （0x751F = '生'）
U+E65E -> glyph "uni49"     （0x49 = 'I'）
```

所以只要把字形名里 `uni` 后面的十六进制读出来，就是原字符：

```python
GLYPH_NAME_RE = re.compile(r"^uni([0-9A-Fa-f]{2,6})$")
table = {}
for cp, glyph_name in TTFont(font_path).getBestCmap().items():
    if 0xE000 <= cp <= 0xF8FF:
        m = GLYPH_NAME_RE.match(glyph_name)
        if m:
            table[cp] = int(m.group(1), 16)
```

⚠️ **正则必须是 `{2,6}` 位，不能写 `{4,6}`**：数字的字形名是短形式（`uni30`、`uni32`、`uni4b`），CJK 才是四位（`uni751F`）。写成四位会漏掉全部数字 —— 我第一版就栽在这，薪资金额全解不出来。

### 两个缓存要点

1. **字体 URL 的 `rand` 每次都变，但文件内容恒定**（实测两次抓取 SHA256 都是 `473b03d43577`）。所以映射表建一次就能长期用，不必每次重算。`fontmap.json` 就是缓存的映射表。
2. **字体文件不能用 curl 直接下**（实测 HTTP 403，需要浏览器会话的 Cookie/Referer）。必须走 `page.fetch()`。这就是为什么流程要拆成「浏览器抓 → 落盘 → Python 解码」两步，中间用文件交接。

## 数据结构

`jobs.json`：

```json
{
  "keyword": "AI产品经理",
  "city": "深圳",
  "scrapedAt": "2026-09-10T15:51:32.000Z",
  "rawTotal": 60,
  "uniqueTotal": 60,
  "jobs": [
    {
      "internId": "inn_9ye80z8hlhpl",
      "title": "产品经理实习生（AI产品）",
      "company": "OPPO",
      "salaryText": "150-250/天",
      "salaryLow": 150,
      "salaryHigh": 250,
      "salaryPerDay": 150,
      "city": "深圳",
      "daysPerWeek": 5,
      "months": 6,
      "advantage": "地铁周边",
      "companyMeta": "电子/通信/硬件",
      "url": "https://www.shixiseng.com/intern/inn_9ye80z8hlhpl",
      "page": 1
    }
  ]
}
```

`salaryPerDay` 取区间下界，纯为排序方便 —— 免得「薪资面议」永远沉底。

## DOM 选择器（站点改版时改这里）

| 字段 | 选择器 |
|---|---|
| 卡片容器 | `.intern-wrap`（带 `data-intern-id`） |
| 岗位名 | `.intern-detail__job a.title` |
| 薪资 | `.intern-detail__job span.day` |
| 城市 / 天数 / 月数 | `.intern-detail__job p.tip span`（依次第 1/2/3 个非 `\|` 项） |
| 公司名 | `.intern-detail__company a.title` |
| 福利标签 | `.advantage-wrap` |
| 投递按钮 | `div.btn-box.resume_apply`（文案「投个简历」） |
| 详情页 JD 正文 | `.job-box .content_left .job_detail`（兜底 `.con-job`） |
| 详情页学历要求 | 从 `.job-box` 顶部文本里正则捞（本科/硕士/大专…） |

## 实测数据分布（深圳 · AI产品经理 · 60 个岗位）

- **公司**：OPPO 8、快手 5、Shopee 4、小红书 4、腾娱互动 3、字节跳动 3、平安科技 3、美图 2、中金财富 2……
- **日薪**（52 个可解析）：最低 100、中位 180、最高 800 元/天
- **标题含 AI/AIGC/大模型**：11 / 60

## 边界与风险

- **只抓不投**。投递必须登录，本脚本刻意不碰登录态，也不写任何 Cookie。
- 抓取节奏是每页间隔 1.2 秒 + 页面加载等待，未触发风控。别把间隔调太小。
- 抓下来的岗位数据仅供个人求职筛选，不要分发或商用。
- 站点的**用户协议禁止自动化抓取**，虽然只读抓取风险极低，但仍属灰区；账号未被登录就不存在封号问题，这是本方案刻意保持的边界。
- 岗位是**实习/校招**定位，社招岗不在这个池子里。这是平台属性决定的，不是抓取问题。

## 下一步（还没做）

1. ~~把 `jobs.json` 接进「简历工作台」的匹配引擎~~ ✅ 已做：工作台「岗位池」面板
2. ~~对高分岗位抓详情页 JD~~ ✅ 已做：`run-detail.sh` + 面板「看详情」生成话术
3. ~~投递这一步留人工~~ ✅ 维持此设计：卡片外链打开岗位页，登录后手动投
4. 打招呼话术目前基于「标题+标签」的粗 JD；抓了详情 JD 后话术会更准
