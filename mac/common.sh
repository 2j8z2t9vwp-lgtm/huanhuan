#!/bin/bash
# Shared by Finder launchers. Paths may contain spaces and Chinese characters.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
finish() {
    result=$?
    if [ "$result" -ne 0 ]; then printf '\n执行失败，请查看上面的提示。\n'; fi
    if [ -t 0 ]; then read -r -p '按回车关闭此窗口…' unused || true; fi
}
trap finish EXIT
require_python() {
    if [ ! -x "$ROOT/.venv/bin/python" ]; then
        printf '请先运行「安装欢欢工作台.command」。\n'
        exit 1
    fi
}
