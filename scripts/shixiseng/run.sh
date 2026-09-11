#!/usr/bin/env bash
# 一条命令跑完「抓取 → 解码」。
#
#   ./scripts/shixiseng/run.sh                      # 默认 深圳 · AI产品经理 · 3 页
#   SXS_PAGES=17 ./scripts/shixiseng/run.sh         # 抓满（约 340 个岗位）
#   SXS_KEYWORD=产品经理 SXS_CITY=北京 ./scripts/shixiseng/run.sh
#   SXS_KEYWORD=大模型 SXS_CITY=全国 ./scripts/shixiseng/run.sh
#
# 只读，不投递。抓完的干净数据在 $SXS_OUT/jobs.json。
#
# 为什么要文本替换配置块而不走环境变量：ego-browser 的 node 运行时不继承
# 调用方的环境变量，也不接受命令行参数（实测 0.5.0.28），cwd 还恒为 `/`。
# 所以只能把参数写进脚本正文再喂给 stdin。

set -euo pipefail

cd "$(dirname "$0")/../.."
ROOT="$(pwd)"

export SXS_KEYWORD="${SXS_KEYWORD:-AI产品经理}"
export SXS_CITY="${SXS_CITY:-深圳}"
export SXS_PAGES="${SXS_PAGES:-3}"
export SXS_OUT="${SXS_OUT:-/tmp/sxs}"

# 找带 fontTools 的 python：优先 $PY，其次托管的 venv，最后系统 python3
pick_py() {
  local cands=(
    "${PY:-}"
    "$HOME/.workbuddy/binaries/python/envs/default/bin/python"
    "$HOME/.workbuddy/binaries/python/versions/3.13.12/bin/python3"
    "$(command -v python3 || true)"
  )
  local c
  for c in "${cands[@]}"; do
    [ -n "$c" ] && [ -x "$c" ] || continue
    if "$c" -c "import fontTools" 2>/dev/null; then echo "$c"; return 0; fi
  done
  return 1
}

if ! PY="$(pick_py)"; then
  echo "找不到带 fontTools 的 python。请先：" >&2
  echo "  $HOME/.workbuddy/binaries/python/envs/default/bin/pip install fonttools" >&2
  exit 1
fi

TMP_SCRIPT="$(mktemp -t sxs-scrape-XXXXXX.mjs)"

echo "== 第 1 步：抓列表 =="
echo "   岗位「${SXS_KEYWORD}」· 城市「${SXS_CITY}」· ${SXS_PAGES} 页 → ${SXS_OUT}"

# 用 Python 生成替换文本，避免关键词里的引号/反斜杠破坏 JS 语法
"$PY" - "$ROOT" "$SXS_KEYWORD" "$SXS_CITY" "$SXS_PAGES" "$SXS_OUT" "$TMP_SCRIPT" <<'PY'
import json, pathlib, sys

root, keyword, city, pages, out, dest = sys.argv[1:7]
src = pathlib.Path(root, "scripts/shixiseng/scrape.mjs").read_text()

start_marker = "// >>> SXS_CONFIG_START"
end_marker = "// <<< SXS_CONFIG_END"
start = src.index(start_marker)
end = src.index(end_marker) + len(end_marker)

cfg = {"keyword": keyword, "city": city, "pages": int(pages), "out": out}
block = (
    start_marker
    + "\nconst CFG = "
    + json.dumps(cfg, ensure_ascii=False)
    + ";\n"
    + end_marker
)

pathlib.Path(dest).write_text(src[:start] + block + src[end:])
PY

ego-browser nodejs < "$TMP_SCRIPT"
rm -f "$TMP_SCRIPT"

echo
echo "== 第 2 步：解字体反爬 =="
"$PY" "$ROOT/scripts/shixiseng/decode.py" "$SXS_OUT"

# 抓完顺手把干净数据复制进工程的 public/，简历工作台的「岗位池」面板
# 打开就会自动读这个文件（fetch 相对路径 shixiseng-jobs.json）。
PUBLIC_SNAPSHOT="$ROOT/public/shixiseng-jobs.json"
if cp "$SXS_OUT/jobs.json" "$PUBLIC_SNAPSHOT" 2>/dev/null; then
  echo
  echo "已同步到岗位池：$PUBLIC_SNAPSHOT（打开工作台的「岗位池」即可看到）"
fi

echo
echo "干净数据：$SXS_OUT/jobs.json"
