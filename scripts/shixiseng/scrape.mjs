/* ============================================================================
 * 第 1 步：抓实习僧的岗位列表（只读，不投递）
 *
 * 推荐用包装脚本跑（会自动替换下面的配置块）：
 *
 *   ./scripts/shixiseng/run.sh
 *   SXS_PAGES=17 ./scripts/shixiseng/run.sh
 *
 * 也可以直接跑（用下面的默认配置）：
 *
 *   ego-browser nodejs < scripts/shixiseng/scrape.mjs
 *
 * ⚠️ 两个 ego-browser 的硬约束（实测 0.5.0.28）：
 *   1. node 运行时 **不继承调用方的环境变量** —— 所以参数不能走 process.env
 *   2. 运行时 **cwd 恒为 `/`** —— 所以脚本里不能写相对路径
 *   因此参数只能靠 run.sh 把下面这个配置块文本替换掉。
 *
 * 产出两个文件：
 *   <out>/raw.json    原始数据（含字体私用区字符，尚未解码）
 *   <out>/font.woff   站点当前的字体文件，给第 2 步解码用
 *
 * 为什么必须先落盘再解码：字体文件 curl 直接下会 403，必须带浏览器会话取；
 * 而解码要用 fontTools（Python）。所以拆成两步，中间用文件交接。
 * ========================================================================== */

const fs = await import("node:fs");
const path = await import("node:path");

// >>> SXS_CONFIG_START（run.sh 会整块替换，别删掉这两行标记）
const CFG = { keyword: "AI产品经理", city: "深圳", pages: 3, out: "/tmp/sxs" };
// <<< SXS_CONFIG_END

const KEYWORD = CFG.keyword;
const CITY = CFG.city;
const PAGES = Number(CFG.pages);
const OUT = CFG.out;

fs.mkdirSync(OUT, { recursive: true });

const listUrl = (p) =>
  "https://www.shixiseng.com/interns?" +
  new URLSearchParams({
    page: String(p),
    type: "intern",
    keyword: KEYWORD,
    city: CITY,
  }).toString();

const task = await taskSpace(`抓实习僧 ${KEYWORD}@${CITY}`);
console.log(`[抓取] 空间 ${task.spaceId}｜${KEYWORD} · ${CITY} · ${PAGES} 页`);
const page = task.page("p1");

/* 取字体文件的真实地址：样式表里的 url 带一个每次都变的 rand 参数，
   但实测文件内容恒定（SHA256 一致），所以映射表建一次就能长期复用。 */
const findFontUrl = () =>
  page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // 跨域样式表读不了，跳过
      }
      for (const r of rules || []) {
        if (r.constructor?.name === "CSSFontFaceRule" && /myFont/.test(r.style.fontFamily)) {
          const m = /url\(["']?([^"')]+)/.exec(r.style.src);
          if (m) return new URL(m[1], location.href).href;
        }
      }
    }
    return null;
  });

/* 一张岗位卡片 → 结构化字段。这里拿到的是「未解码」的文本：
   岗位名里的字母、薪资里的数字会被替换成私用区码点（字体反爬）。 */
const extractCards = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".intern-wrap")].map((c) => {
      const pick = (sel) => c.querySelector(sel)?.textContent?.trim() ?? "";
      const tipSpans = [...c.querySelectorAll(".intern-detail__job p.tip span")]
        .map((s) => s.textContent.trim())
        .filter((t) => t && t !== "|");
      return {
        internId: c.getAttribute("data-intern-id") ?? "",
        title: pick(".intern-detail__job a.title"),
        salary: pick(".intern-detail__job span.day"),
        city: tipSpans[0] ?? "",
        daysPerWeek: tipSpans[1] ?? "",
        months: tipSpans[2] ?? "",
        company: pick(".intern-detail__company a.title"),
        companyMeta: pick(".intern-detail__company p.tip"),
        advantage: pick(".advantage-wrap"),
        href: c.querySelector("a[href*='/intern/']")?.getAttribute("href") ?? "",
      };
    }),
  );

const pages = [];
let fontUrl = null;

for (let p = 1; p <= PAGES; p++) {
  await page.goto(listUrl(p), { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(2500); // 等列表渲染完，太早抓会拿到空卡片

  if (!fontUrl) fontUrl = await findFontUrl();

  const cards = await extractCards();
  pages.push({ page: p, url: await page.url(), count: cards.length, cards });
  console.log(`[抓取] 第 ${p} 页 → ${cards.length} 个岗位`);

  // 温和限速，别把站点当靶子打
  if (p < PAGES) await page.waitForTimeout(1200);
}

if (!fontUrl) throw new Error("没找到 myFont 的字体地址，站点结构可能变了");

const fontRes = await page.fetch(fontUrl, { saveAs: path.join(OUT, "font.woff") });
if (!fontRes.ok) throw new Error(`字体下载失败：HTTP ${fontRes.status}`);

const raw = {
  keyword: KEYWORD,
  city: CITY,
  scrapedAt: new Date().toISOString(),
  fontUrl,
  total: pages.reduce((n, p) => n + p.count, 0),
  pages,
};
fs.writeFileSync(path.join(OUT, "raw.json"), JSON.stringify(raw, null, 2));

console.log(`[抓取] 合计 ${raw.total} 个岗位（原始未解码）`);
console.log(`[抓取] 已写出 ${path.join(OUT, "raw.json")}`);
console.log(`[抓取] 已写出 ${path.join(OUT, "font.woff")}`);
console.log("[下一步] python scripts/shixiseng/decode.py " + OUT);

await task.finish({ keep: [] });
