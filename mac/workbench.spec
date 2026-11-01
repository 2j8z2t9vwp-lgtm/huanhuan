# Run on macOS after build_mac_app.py stages native assets and JS dependencies.
from pathlib import Path
import json
from PyInstaller.utils.hooks import collect_all, collect_submodules, copy_metadata

root = Path(SPECPATH).parent
stage = root / 'build/mac-assets'
datas = [(str(root / name), name) for name in ('static', 'vendor', 'app')]
datas += [(str(stage / 'models'), 'models')]
datas += [(str(root / 'THIRD_PARTY_NOTICES.md'), '.')]
# Analyze at original locations so loader-relative dylib paths still resolve.
native_sources = json.loads((stage / 'native-sources.json').read_text('utf-8'))
binaries = [(native_sources[name], 'tools') for name in ('ffmpeg', 'ffprobe', 'node')]
hidden = collect_submodules('app')
for package in ('uvicorn', 'yt_dlp', 'faster_whisper', 'ctranslate2', 'onnxruntime',
                'playwright', 'webview', 'keyring', 'mcp', 'imageio_ffmpeg'):
    d, b, h = collect_all(package)
    datas += d
    binaries += b
    hidden += h
# External upstream scripts import these dynamically.
hidden += collect_submodules('ffmpeg') + collect_submodules('dotenv')
hidden += ['keyring.backends.macOS', 'httpx', 'requests', 'bs4', 'lxml', 'cryptography.fernet']
datas += copy_metadata('yt-dlp', recursive=True)
a = Analysis([str(root / 'desktop.py')], pathex=[str(root)], binaries=binaries,
             datas=datas, hiddenimports=hidden, excludes=['PyQt5', 'PyQt6', 'tkinter'])
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='欢欢工作台',
          console=False, argv_emulation=False)
col = COLLECT(exe, a.binaries, a.datas, name='欢欢工作台')
app = BUNDLE(col, name='欢欢工作台.app', bundle_identifier='local.huanhuan.workbench',
             info_plist={'CFBundleDisplayName': '欢欢工作台',
                         'CFBundleShortVersionString': '1.0.0',
                         'NSHighResolutionCapable': True,
                         'NSAppTransportSecurity': {'NSAllowsLocalNetworking': True}})
