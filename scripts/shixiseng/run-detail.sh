#!/usr/bin/env bash
# 抓详情页 JD（精筛用）。用法：
#
#   ./scripts/shixiseng/run-detail.sh                     # 默认抓 /tmp/sxs 里前 10 个
#   SXS_JOBS=/tmp/sxs/jobs-detail.json SXS_LIMIT=30 ./scripts/shixiseng/run-detail.sh
#   SXS_INCLUDE="AI 产品" SXS_EXCLUDE="销售 客服" ./scripts/shixiseng/run-detail.sh
#
# 抓完产物在 $SXS_OUT/jobs-detail.json。要进岗位池，复制成 public/shixiseng-jobs.json
# 或在面板里用「选择文件」导入。
#
# 与 run.sh 一样走「配置块文本替换」：ego-browser 的 node 运行时不继承环境变量、
# 不接受命令行参数、cwd 恒为 `/`。

set -euo pipefail

cd "$(dirname "$0")/../.."
ROOT="$(pwd)"

JOBS="${SXS_JOBS:-/tmp/sxs/jobs.json}"
OUT="${SXS_OUT:-$(dirname "$JOBS")}"
LIMIT="${SXS_LIMIT:-10}"
INCLUDE="${SXS_INCLUDE:-}"
EXCLUDE="${SXS_EXCLUDE:-}"
ONLY_MISSING="${SXS_ONLY_MISSING:-true}"

# 找带 fontTools 的 python（fetch-detail 本身不需要 fontTools，但保持与 run.sh 同一套探测逻辑）
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
    if "$c" -c "import json" 2>/dev/null; then echo "$c"; return 0; fi
  done
  return 1
}
PY_OK="$(pick_py)" || { echo "找不到可用的 python3" >&2; exit 1; }

TMP_SCRIPT="$(mktemp -t sxs-detail-XXXXXX.mjs)"

echo "== 抓详情页 JD =="
echo "   源 $JOBS ｜ 前 ${LIMIT} 个 ｜ 产物 $OUT/jobs-detail.json"

"$PY_OK" - "$ROOT" "$JOBS" "$OUT" "$LIMIT" "$INCLUDE" "$EXCLUDE" "$ONLY_MISSING" "$TMP_SCRIPT" <<'PY'
import json, pathlib, sys

root, jobs_file, out, limit, include, exclude, only_missing, dest = sys.argv[1:9]
src = pathlib.Path(root, "scripts/shixiseng/fetch-detail.mjs").read_text()

start_marker = "// >>> SXS_DETAIL_CONFIG_START"
end_marker = "// <<< SXS_DETAIL_CONFIG_END"
start = src.index(start_marker)
end = src.index(end_marker) + len(end_marker)

cfg = {
    "jobsFile": jobs_file,
    "out": out,
    "limit": int(limit),
    "include": include,
    "exclude": exclude,
    "onlyMissing": only_missing != "false",
}
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
echo "产物：$OUT/jobs-detail.json"
echo "进岗位池：cp $OUT/jobs-detail.json $ROOT/public/shixiseng-jobs.json"
