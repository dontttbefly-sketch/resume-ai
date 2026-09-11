#!/bin/zsh
# 双击本文件即可启动简历工作台。
# 关掉服务：在这个终端窗口里按 Control + C。

cd "$(dirname "$0")" || exit 1

# 本机的 Node 是 WorkBuddy 托管运行时，不在默认 PATH 里，这里补上
NODE_BIN="/Users/bottom_/.workbuddy/binaries/node/versions/22.22.2-2/bin"
if [ -x "$NODE_BIN/node" ]; then
  export PATH="$NODE_BIN:$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "找不到 Node.js。请先把下面这行加到 shell 配置里，或改用 README 里的方式二："
  echo "export PATH=\"$NODE_BIN:\$PATH\""
  echo
  read -r "?按回车键关闭…"
  exit 1
fi

echo "正在启动简历工作台…"
echo "地址：http://localhost:5173"
echo "关闭服务：按 Control + C"
echo

./node_modules/.bin/vite --port 5173 --strictPort
