/* ============================================================================
 * 第 3 步（可选）：抓详情页 JD 正文，给岗位池「精筛」用
 *
 * 为什么需要它：列表页只有岗位名 + 优势标签，粗筛分只反映岗位方向。
 * 有了 JD 正文，匹配度才是真的能力项覆盖。
 *
 * 推荐用包装脚本跑（会替换下面的配置块）：
 *
 *   ./scripts/shixiseng/run-detail.sh                          # 抓前 10 个
 *   SXS_LIMIT=30 ./scripts/shixiseng/run-detail.sh             # 抓前 30 个
 *   SXS_INCLUDE="AI 产品" SXS_LIMIT=20 ./scripts/shixiseng/run-detail.sh
 *
 * 行为：
 *   - 读 <out>/jobs.json，挑出要抓的岗位（跳过已抓过的）
 *   - 逐个打开详情页，取 .job-detail 的文本
 *   - 用 fontmap.json 顺手把可能混进来的私用区字符解掉（详情页一般不加密，
 *     但保险起见，反正映射表现成）
 *   - 产出 <out>/jobs-detail.json：原结构 + 每条多了 jd 字段
 *
 * 详情页免登录可读，但为稳妥起见仍温和限速（1.2s + 随机抖动）。
 * ========================================================================== */

const fs = await import("node:fs");
const path = await import("node:path");

// >>> SXS_DETAIL_CONFIG_START（run-detail.sh 会整块替换，别删掉这两行标记）
const CFG = { jobsFile: "/tmp/sxs/jobs.json", out: "/tmp/sxs", limit: 10, include: "", exclude: "", onlyMissing: true };
// <<< SXS_DETAIL_CONFIG_END

const JOBS_FILE = CFG.jobsFile;
const OUT_DIR = CFG.out;
const LIMIT = Number(CFG.limit) || 10;
const INCLUDE = String(CFG.include ?? "").split(/[,，\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
const EXCLUDE = String(CFG.exclude ?? "").split(/[,，\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
const ONLY_MISSING = CFG.onlyMissing !== false;

if (!fs.existsSync(JOBS_FILE)) {
  throw new Error(`找不到 ${JOBS_FILE}，先跑 run.sh 抓列表`);
}

/** 读包：{jobs:[...]} 或裸数组都吃 —— 已移到下方 parse 时内联处理 */

/** 私用区 → 真实字符。fontmap 是 decode.py 存的：{"e2a6": 29983, ...} */
const decodeFont = (() => {
  const fontmapFile = path.join(path.dirname(JOBS_FILE), "fontmap.json");
  if (!fs.existsSync(fontmapFile)) return (s) => s;
  const raw = JSON.parse(fs.readFileSync(fontmapFile, "utf8"));
  const map = new Map(Object.entries(raw).map(([k, v]) => [Number.parseInt(k, 16), v]));
  return (s) =>
    [...s]
      .map((ch) => {
        const cp = ch.codePointAt(0);
        return cp != null && map.has(cp) ? String.fromCodePoint(map.get(cp)) : ch;
      })
      .join("");
})();

const task = await taskSpace(`抓详情页 JD ×${LIMIT}`);
console.log(`[详情] 空间 ${task.spaceId}｜源 ${JOBS_FILE}`);
const page = task.page("p1");

const parsed = JSON.parse(fs.readFileSync(JOBS_FILE, "utf8"));
const meta = Array.isArray(parsed) ? {} : parsed;
const jobs = (Array.isArray(parsed) ? parsed : Array.isArray(parsed.jobs) ? parsed.jobs : []).filter(
  (j) => j && j.internId,
);

const picked = jobs.filter((j) => {
  const title = String(j.title ?? "").toLowerCase();
  if (INCLUDE.length && !INCLUDE.some((t) => title.includes(t))) return false;
  if (EXCLUDE.length && EXCLUDE.some((t) => title.includes(t))) return false;
  if (ONLY_MISSING && j.jd) return false;
  return Boolean(j.url);
});

console.log(`[详情] 池子 ${jobs.length} 个，命中筛选 ${picked.length} 个，本次抓前 ${Math.min(picked.length, LIMIT)} 个`);

const EXTRACT = () =>
  page.evaluate(() => {
    // 最内层的 JD 正文；不同岗位模板可能没有 .job-detail，就退回整个描述块
    const main =
      document.querySelector(".job-box .content_left .job_detail") ??
      document.querySelector(".job-box .content_left .con-job");
    // 顺手把「本科/硕士」这类学历要求捞出来，放 job-box 顶部信息里
    const headText = document.querySelector(".job-box .job-info, .job-box .job_info, .job-box")?.textContent ?? "";
    const degree = /学士|本科|硕士|研究生|博士|大专|专科/.exec(headText)?.[0] ?? "";
    return {
      jd: main ? main.textContent.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() : "",
      degree,
    };
  });

const results = [];
let done = 0;
let failed = 0;

for (const job of picked.slice(0, LIMIT)) {
  done++;
  try {
    await page.goto(job.url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load").catch(() => {});
    await page.waitForTimeout(1800);

    const { jd, degree } = await EXTRACT();

    if (!jd) {
      failed++;
      console.log(`[详情] (${done}/${Math.min(picked.length, LIMIT)}) ✗ 没抓到正文｜${job.title}`);
      results.push({ internId: job.internId, jd: "", degree: "", url: job.url });
    } else {
      console.log(`[详情] (${done}/${Math.min(picked.length, LIMIT)}) ✓ ${job.title}｜${jd.length} 字${degree ? `｜${degree}` : ""}`);
      results.push({ internId: job.internId, jd: decodeFont(jd), degree, url: job.url });
    }
  } catch (err) {
    failed++;
    console.log(`[详情] (${done}) ✗ ${err instanceof Error ? err.message : String(err)}`);
    results.push({ internId: job.internId, jd: "", degree: "", url: job.url, error: String(err) });
  }

  // 温和限速 + 抖动，别把站点当靶子打
  await page.waitForTimeout(900 + Math.floor(Math.random() * 700));
}

/* 合并回原结构：jd / degree 写回对应岗位，输出 jobs-detail.json */
const byId = new Map(results.map((r) => [r.internId, r]));
const merged = jobs.map((j) => {
  const hit = byId.get(j.internId);
  if (!hit) return j;
  return { ...j, jd: hit.jd || j.jd || undefined, degree: hit.degree || j.degree || undefined };
});

const out = { ...meta, jobs: merged };

const outFile = path.join(OUT_DIR, "jobs-detail.json");
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));

const okCount = results.filter((r) => r.jd).length;
console.log(`[详情] 完成：成功 ${okCount} / 失败 ${failed}`);
console.log(`[详情] 已写出 ${outFile}`);
console.log(`[下一步] 把 ${outFile} 拖进工作台「岗位池」的「选择文件」，或复制成 public/shixiseng-jobs.json`);

await task.finish({ keep: [] });
