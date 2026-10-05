#!/bin/bash
# BOSS 投递执行器 · 一键安装（只支持 macOS）
#   用法：curl -fsSL -H "X-Invite-Code: 你的个人密钥" __SITE__/runner/install.sh | bash -s -- 你的个人密钥
# 装到 ~/BossRunner；你的画像和投递记录在 ~/Library/Application Support/BossRunner，重装不会丢
set -euo pipefail

SITE="__SITE__"
CODE="${1:-}"
DEST="$HOME/BossRunner"

if [ "$(uname)" != "Darwin" ]; then echo "目前只支持 macOS。"; exit 1; fi
if [ -z "$CODE" ]; then echo "缺少个人密钥：请从网页「投递」页复制完整的安装命令。"; exit 1; fi

echo "→ 下载执行器…"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
if ! curl -fsSL -H "X-Invite-Code: $CODE" "$SITE/runner/boss-runner.zip" -o "$TMP/runner.zip"; then
  echo "下载失败：个人密钥不对，或者账号已停用。"; exit 1
fi

echo "→ 安装到 $DEST"
mkdir -p "$DEST"
rm -rf "$DEST/skill"
unzip -oq "$TMP/runner.zip" -d "$DEST"
chmod +x "$DEST/start.command"

if ! command -v python3 >/dev/null 2>&1; then
  echo "还需要 Python 3：在弹出的窗口里安装「命令行开发者工具」，装好后双击 $DEST/start.command。"
  xcode-select --install 2>/dev/null || true
  exit 0
fi

echo "✓ 装好了。以后双击 $DEST/start.command 启动；现在先帮你启动一次。"
echo
exec "$DEST/start.command"
