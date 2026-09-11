#!/usr/bin/env bash
# 一条命令跑完「抓取 → 解码」。
#
#   ./scripts/shixiseng/run.sh                      # 默认 深圳 · AI产品经理 · 3 页
#   SXS_PAGES=17 ./scripts/shixiseng/run.sh         # 抓满（约 340 个岗位）
#   SXS_KEYWORD=产品经理 SXS_CITY=全国 ./scripts/shixiseng/run.sh
#
# 只读，不投递。抓完的干净数据在 $SXS_OUT/jobs.json。
#
# 为什么要文本替换配置块而不走环境变量：ego-browser 的 node 运行时不继承
# 调用方的环境变量，也不接受命令行参数（实测），cwd 恒为 "/"。
# 所以只能把参数写进脚本正文再喂给 stdin。

set -euo pipefail

cd "$(dirname "$0")/../.."
ROOT="$(pwd)"

SXS_KEYWORD="${SXS_KEYWORD:-AI产品经理}"
SXS_CITY="${SXS_CITY:-深圳}"
SXS_PAGES="${SXS_PAGES:-3}"
SXS_OUT="${SXS_OUT:-/tmp/sxs}"

# 找可用的 python（本任务只需标准库）
pick_py() {
  local cands=(
    "${PY:-}"
    "$HOME/.workbuddy/binaries/python/envs/default/bin/python"
    "$HOME/.workbuddy/binaries/python/versions/3.13.12/bin/python3"
  )
  local c
  for c in "${cands[@]}"; do
    [ -n "$c" ] && [ -x "$c" ] || continue
    if "$c" -c "import json" 2>/dev/null; then echo "$c"; return 0; fi
  done
  command -v python3
}

PY_OK="$(pick_py)"
[ -n "$PY_OK" ] || { echo "找不到可用的 python3" >&2; exit 1; }

mkdir -p "$SXS_OUT"
TMP_SCRIPT="$(mktemp -t sxs-scrape-XXXXXX.mjs)"

echo "== 第 1 步：抓取列表 ($SXS_KEYWORD / $SXS_CITY / $SXS_PAGES 页) =="
"$PY_OK" - "$ROOT" "$SXS_KEYWORD" "$SXS_CITY" "$SXS_PAGES" "$SXS_OUT" "$TMP_SCRIPT" <<'PYEOF'
import json, pathlib, sys

root, keyword, city, pages, out, dest = sys.argv[1:7]
src = pathlib.Path(root, "scripts/shixiseng/scrape.mjs").read_text()

start_marker = "// >>> SXS_CONFIG_START"
end_marker = "// <<< SXS_CONFIG_END"
start = src.index(start_marker)
end = src.index(end_marker) + len(end_marker)

cfg = {"keyword": keyword, "city": city, "pages": int(pages), "out": out}
block = start_marker + "\nconst CFG = " + json.dumps(cfg, ensure_ascii=False) + ";\n" + end_marker
pathlib.Path(dest).write_text(src[:start] + block + src[end:])
PYEOF

ego-browser nodejs < "$TMP_SCRIPT"
rm -f "$TMP_SCRIPT"

echo
echo "== 第 2 步：解字体反爬 =="
"$PY_OK" "$ROOT/scripts/shixiseng/decode.py" "$SXS_OUT"

# 抓完顺手把干净数据复制进工程的 public/，岗位池面板打开就会自动读
PUBLIC_SNAPSHOT="$ROOT/public/shixiseng-jobs.json"
if cp "$SXS_OUT/jobs.json" "$PUBLIC_SNAPSHOT" 2>/dev/null; then
  echo
  echo "已同步到岗位池：$PUBLIC_SNAPSHOT"
fi

echo
echo "干净数据：$SXS_OUT/jobs.json"
