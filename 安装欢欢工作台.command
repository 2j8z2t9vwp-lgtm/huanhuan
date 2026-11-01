#!/bin/bash
source "$(dirname "$0")/mac/common.sh"
if [ "$(uname -s)" != 'Darwin' ]; then echo '此安装入口仅供 macOS 使用。'; exit 1; fi
if ! command -v brew >/dev/null 2>&1; then
    echo '请先从 https://brew.sh/ 安装 Homebrew，再双击此文件。'
    exit 1
fi
brew install python@3.11 ffmpeg node
python3.11 scripts/setup_mac.py
