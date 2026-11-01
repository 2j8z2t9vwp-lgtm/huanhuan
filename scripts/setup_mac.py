"""Install native Mac dependencies in a new local virtual environment."""
import os
from pathlib import Path
import subprocess
import sys
import venv

ROOT = Path(__file__).resolve().parents[1]


def main():
    if sys.platform != 'darwin':
        raise SystemExit('This installer runs on macOS only.')
    if sys.version_info[:2] != (3, 11):
        raise SystemExit('Please use Python 3.11: brew install python@3.11')
    os.chdir(ROOT)
    target = ROOT / '.venv'
    if (target / 'Scripts').exists():
        raise SystemExit('发现 Windows .venv，请将工作台重新解压到新文件夹，勿复制 Windows 虚拟环境。')
    if not (target / 'bin/python').exists():
        venv.EnvBuilder(with_pip=True).create(target)
    python = str(target / 'bin/python')
    subprocess.run([python, '-m', 'pip', 'install', '--upgrade', 'pip'], check=True)
    subprocess.run([python, '-m', 'pip', 'install', '-r', 'requirements-mac.txt'], check=True)
    subprocess.run([python, 'setup_tools.py'], check=True)
    # Reinstall JS packages on the Mac; never ship Windows node_modules.
    for slug in ('viralvision-mcp', 'promo-workflow-mcp'):
        folder = ROOT / 'vendor/integrations' / slug
        subprocess.run(['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], cwd=folder, check=True)
        subprocess.run(['npm', 'run', 'build'], cwd=folder, check=True)
    for path in ROOT.glob('*.command'):
        path.chmod(0o755)
    print('安装完成。双击「启动欢欢工作台.command」，然后在偏好设置填写 API Key。')
    print('本地语音模型会在首次转写时下载；抖音链接读取需安装 Chrome 或 Edge。')


if __name__ == '__main__':
    main()
