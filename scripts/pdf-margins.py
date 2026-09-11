#!/usr/bin/env python3
"""逐页量 PDF 的四边内容边距，用来确认打印时页边距是否真的生效。

用法：python scripts/pdf-margins.py <pdf路径>
单位换算：1pt = 1/72 inch，A4 = 595.28 × 841.89 pt
"""

import sys

import pymupdf

PT_PER_MM = 72 / 25.4


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/resume-print.pdf"
    doc = pymupdf.open(path)
    print(f"文件：{path}")
    print(f"总页数：{doc.page_count}")

    for i, page in enumerate(doc):
        rect = page.rect
        # 按「有内容的像素」算实际边距，忽略全白背景
        pix = page.get_pixmap(dpi=72, colorspace=pymupdf.csGRAY)
        w, h = pix.width, pix.height
        samples = pix.samples
        n = pix.n

        def row_has_ink(y: int) -> bool:
            base = y * pix.stride
            return any(samples[base + x * n] < 245 for x in range(w))

        def col_has_ink(x: int) -> bool:
            return any(samples[y * pix.stride + x * n] < 245 for y in range(h))

        top = next((y for y in range(h) if row_has_ink(y)), h)
        bottom = next((y for y in range(h - 1, -1, -1) if row_has_ink(y)), -1)
        left = next((x for x in range(w) if col_has_ink(x)), w)
        right = next((x for x in range(w - 1, -1, -1) if col_has_ink(x)), -1)

        mm = lambda px: round(px / 72 * 25.4, 1)  # noqa: E731
        used_h = 0 if bottom < 0 else bottom - top + 1

        print(
            f"  第 {i + 1} 页："
            f"上 {mm(top)}mm 下 {mm(h - 1 - bottom)}mm "
            f"左 {mm(left)}mm 右 {mm(w - 1 - right)}mm "
            f"｜内容高 {mm(used_h)}mm / 可用 {round((rect.height - 2 * 14 * PT_PER_MM) / PT_PER_MM, 1)}mm"
        )

    doc.close()


if __name__ == "__main__":
    main()
