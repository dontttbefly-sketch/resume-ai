#!/usr/bin/env python3
"""第 2 步：解开实习僧的字体反爬，把 raw.json 变成干净可用的 jobs.json。

用法：
    python scripts/shixiseng/decode.py /tmp/sxs

原理（实测确认，2026-09）：
    实习僧给 .font 类元素套了一个自定义字体 myFont，把一部分字符（数字、部分
    字母）的码点换成了私用区（U+E000–U+F8FF）。所以直接读 textContent 会拿到
    "\uf8fe\uf094\ueed9-\ue798\uf094\ueed9/天" 这种鬼东西。

    破法很简单：这个字体在 cmap 里把真实字符写进了 **字形名**——
        U+E798 -> glyph "uni32"   （0x32 就是 '2'）
        U+E2A6 -> glyph "uni751F" （0x751F 就是 '生'）
    所以只要读字形名里的十六进制数就是原字符。98 个私用区码点全部可解。

    再实测确认：字体 URL 里的 rand 每次都变，但文件内容的 SHA256 恒定，
    因此映射表建一次就能长期缓存复用，不必每次抓取都重算。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

PUA_START, PUA_END = 0xE000, 0xF8FF
GLYPH_NAME_RE = re.compile(r"^uni([0-9A-Fa-f]{2,6})$")


def build_map(font_path: Path) -> dict[int, int]:
    """私用区码点 -> 真实码点。字形名不合规的会跳过并报出来。"""
    cmap = TTFont(str(font_path)).getBestCmap()
    table: dict[int, int] = {}
    unmapped: list[str] = []
    for cp, glyph_name in cmap.items():
        if not (PUA_START <= cp <= PUA_END):
            continue
        m = GLYPH_NAME_RE.match(glyph_name)
        if m:
            table[cp] = int(m.group(1), 16)
        else:
            unmapped.append(f"U+{cp:04X}({glyph_name})")
    if unmapped:
        print(f"  ⚠ 有 {len(unmapped)} 个字形名不合规、解不了：{unmapped[:8]}")
    return table


def make_decoder(table: dict[int, int]):
    def decode(text: str) -> str:
        return "".join(chr(table[ord(c)]) if ord(c) in table else c for c in text)

    return decode


def normalize(card: dict, decode) -> dict:
    """解码 + 把「150-250/天」「5天/周」「6个月」拆成好用的数值字段。"""
    salary_raw = decode(card["salary"])
    salary_lo = salary_hi = None
    m = re.search(r"(\d+)\s*[-~]\s*(\d+)", salary_raw)
    if m:
        salary_lo, salary_hi = int(m.group(1)), int(m.group(2))
    elif (m1 := re.search(r"(\d+)", salary_raw)) and "面议" not in salary_raw:
        salary_lo = salary_hi = int(m1.group(1))

    days = re.search(r"(\d+)", decode(card["daysPerWeek"]))
    months = re.search(r"(\d+)", decode(card["months"]))

    intern_id = card["internId"]
    return {
        "internId": intern_id,
        "title": decode(card["title"]),
        "company": decode(card["company"]),
        "salaryText": salary_raw,
        "salaryLow": salary_lo,
        "salaryHigh": salary_hi,
        "salaryPerDay": salary_lo,  # 排序用：取区间下界，免得「面议」永远排最后
        "city": decode(card["city"]),
        "daysPerWeek": int(days.group(1)) if days else None,
        "months": int(months.group(1)) if months else None,
        "advantage": decode(card["advantage"]),
        "companyMeta": decode(card["companyMeta"]),
        "url": f"https://www.shixiseng.com/intern/{intern_id}" if intern_id else "",
    }


def main() -> None:
    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/sxs")
    raw_path, font_path = out_dir / "raw.json", out_dir / "font.woff"
    if not raw_path.exists():
        sys.exit(f"找不到 {raw_path}，先跑 scripts/shixiseng/scrape.mjs")
    if not font_path.exists():
        sys.exit(f"找不到 {font_path}，先跑 scripts/shixiseng/scrape.mjs")

    table = build_map(font_path)
    print(f"字体映射：{len(table)} 条可解码点")
    decode = make_decoder(table)

    raw = json.loads(raw_path.read_text())
    jobs, seen = [], set()
    for page in raw["pages"]:
        for card in page["cards"]:
            job = normalize(card, decode)
            if not job["internId"] or job["internId"] in seen:
                continue  # 跨页去重（同一岗位可能重复出现）
            seen.add(job["internId"])
            job["page"] = page["page"]
            jobs.append(job)

    result = {
        "keyword": raw["keyword"],
        "city": raw["city"],
        "scrapedAt": raw["scrapedAt"],
        "rawTotal": raw["total"],
        "uniqueTotal": len(jobs),
        "jobs": jobs,
    }
    (out_dir / "jobs.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    (out_dir / "fontmap.json").write_text(
        json.dumps({f"{k:x}": v for k, v in table.items()}, ensure_ascii=False)
    )

    print(f"解码完成：{raw['total']} 条 → 去重后 {len(jobs)} 个岗位")
    print(f"已写出 {out_dir / 'jobs.json'}")
    print(f"已写出 {out_dir / 'fontmap.json'}（映射表，可长期复用）\n")

    print(f"{'岗位':<30}{'薪资/天':<12}{'公司':<20}{'城市':<6}周期")
    print("-" * 82)
    for job in jobs[:25]:
        pay = job["salaryText"].replace("/天", "")
        period = f"{job['daysPerWeek'] or '-'}天/周 · {job['months'] or '-'}个月"
        print(f"{job['title'][:28]:<30}{pay[:10]:<12}{job['company'][:18]:<20}{job['city'][:5]:<6}{period}")
    if len(jobs) > 25:
        print(f"... 还有 {len(jobs) - 25} 个，完整数据见 jobs.json")


if __name__ == "__main__":
    main()
