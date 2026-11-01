"""Developer build, on a Mac. The recipient only receives the resulting DMG."""
import os
import json
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def run(*args, **kwargs):
    subprocess.run([str(a) for a in args], check=True, **kwargs)


def main():
    if sys.platform != 'darwin':
        raise SystemExit('DMG 必须在 Mac 构建。请在 Mac 运行本脚本或使用随附的 macOS 构建工作流。')
    os.chdir(ROOT)
    run(sys.executable, '-m', 'pip', 'install', '-r', 'mac/requirements-desktop.txt', 'imageio-ffmpeg', 'beautifulsoup4', 'lxml')
    # Install into the build machine only; native executables and libraries are bundled below.
    run('brew', 'install', 'ffmpeg')
    if not shutil.which('node'):
        run('brew', 'install', 'node')
    stage = ROOT / 'build/mac-assets'
    tools = stage / 'tools'
    tools.mkdir(parents=True, exist_ok=True)
    native_sources = {}
    for name in ('ffmpeg', 'ffprobe', 'node'):
        source = shutil.which(name)
        if not source:
            raise SystemExit(f'Missing build prerequisite: {name}')
        shutil.copy2(Path(source).resolve(), tools / name)
        native_sources[name] = str(Path(source).resolve())
    (stage / 'native-sources.json').write_text(json.dumps(native_sources), encoding='utf-8')
    for slug in ('viralvision-mcp', 'promo-workflow-mcp'):
        folder = ROOT / 'vendor/integrations' / slug
        run('npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund', cwd=folder)
        run('npm', 'run', 'build', cwd=folder)
    env = os.environ.copy()
    env['PLAYWRIGHT_BROWSERS_PATH'] = str(stage / 'browsers')
    run(sys.executable, '-m', 'playwright', 'install', 'chromium', env=env)
    # Include the existing default ASR model so the recipient has no model setup.
    from faster_whisper.utils import download_model
    download_model('base', output_dir=str(stage / 'models/whisper/base'))
    run(sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', 'mac/workbench.spec')
    app = ROOT / 'dist/欢欢工作台.app'
    # Preserve Chromium's nested .app/framework symlinks and original structure.
    # PyInstaller's binary rewriting/signing cannot flatten this third-party app.
    shutil.copytree(stage / 'browsers', app / 'Contents/Resources/browsers', symlinks=True)
    run('codesign', '--force', '--deep', '--sign', '-', app)
    executable = app / 'Contents/MacOS/欢欢工作台'
    with tempfile.TemporaryDirectory(prefix='huanhuan-bundle-check-') as folder:
        test_env = {**os.environ, 'HUANHUAN_DATA_DIR': folder}
        run(executable, '-m', 'app.desktop_smoke', env=test_env)
    with tempfile.TemporaryDirectory(prefix='huanhuan-dmg-') as folder:
        staging = Path(folder)
        shutil.copytree(app, staging / app.name, symlinks=True)
        (staging / 'Applications').symlink_to('/Applications')
        (staging / '请先读我.txt').write_text('把欢欢工作台拖进 Applications 后双击打开。首次在设置填写 AI Key。\n关闭窗口即停止后台。数据保存在 ~/Library/Application Support/欢欢工作台。\n此构建未经 Apple 公证；首次请按系统提示允许打开。\n', encoding='utf-8')
        output = ROOT / 'dist' / f'欢欢工作台-Mac-{platform.machine()}.dmg'
        run('hdiutil', 'create', '-ov', '-format', 'UDZO', '-volname', '欢欢工作台', '-srcfolder', staging, output)
        print(f'Built and smoke-tested: {output}')


if __name__ == '__main__':
    main()
