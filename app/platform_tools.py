"""Locate native tools on Windows and macOS, including Finder's short PATH."""
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def tool_path():
    paths = [ROOT / 'tools', ROOT / 'tools' / 'bin']
    if sys.platform != 'win32':
        paths += [Path('/opt/homebrew/bin'), Path('/usr/local/bin'), Path('/usr/bin'), Path('/bin')]
    return os.pathsep.join(map(str, paths)) + os.pathsep + os.environ.get('PATH', '')


def executable(name):
    return shutil.which(name, path=tool_path())


def require_tool(name):
    found = executable(name)
    if not found:
        raise ValueError(f'未找到 {name}。Mac 请先运行安装入口，或执行 brew install ffmpeg。')
    return found
