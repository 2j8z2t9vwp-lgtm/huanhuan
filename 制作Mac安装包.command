#!/bin/bash
# Developer-only: the recipient does not need this launcher.
source "$(dirname "$0")/mac/common.sh"
if [ "$(uname -s)" != 'Darwin' ]; then echo '请在 Mac 上制作安装包。'; exit 1; fi
if ! command -v brew >/dev/null 2>&1; then echo '制作者需先从 https://brew.sh/ 安装 Homebrew。'; exit 1; fi
brew install python@3.11 ffmpeg node
if [ ! -x "$ROOT/.build-venv/bin/python" ]; then python3.11 -m venv "$ROOT/.build-venv"; fi
"$ROOT/.build-venv/bin/python" scripts/build_mac_app.py
