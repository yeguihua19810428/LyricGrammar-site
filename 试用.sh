#!/bin/bash
# 在本机进入本仓库文件夹后运行：bash 试用.sh
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "还没有检测到 Node.js / npm。"
  echo "请先安装 Node.js 20 或更高版本：打开 https://nodejs.org 下载安装。"
  echo "装好后重新打开终端，再运行：bash 试用.sh"
  exit 1
fi

echo "当前 Node.js 版本：$(node -v)"
echo "正在安装依赖（第一次会比较慢）……"
npm install

echo
echo "正在启动本地试用服务。"
echo "启动后，用本机浏览器打开："
echo "  学生页：http://127.0.0.1:8080/"
echo "  改讲解：http://127.0.0.1:8080/?editExplain=1"
echo "要停止服务，在这个终端里按 Ctrl+C。"
echo

npm run dev
