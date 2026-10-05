#!/bin/bash
# 双击启动 BOSS 投递执行器（会打开一个终端窗口，关掉窗口 = 停止）
cd "$(dirname "$0")" || exit 1
printf '\033]0;BOSS 投递执行器\007'
if ! command -v python3 >/dev/null 2>&1; then
  echo "需要 Python 3：在弹出的窗口里安装「命令行开发者工具」，装好后再双击一次。"
  xcode-select --install 2>/dev/null
  read -n 1 -s -r -p "按任意键关闭…"
  exit 1
fi
exec python3 boss_runner.py "$@"
