"""Runs inside the packaged executable before a DMG may be produced."""
import json
from pathlib import Path
import subprocess
import sys


def main():
    from app import store, creative, integration_runtime as runtime, video
    from fastapi.testclient import TestClient
    from app.main import app
    for name in ('ffmpeg', 'ffprobe', 'node'):
        resolved = runtime.executable(name)
        bundle = Path(sys.executable).resolve().parents[1]
        if not resolved or not Path(resolved).resolve().is_relative_to(bundle):
            raise RuntimeError(f'Missing bundled executable: {name}')
    creative.instructions()
    with TestClient(app) as client:
        assert client.get('/').status_code == 200
        assert client.get('/api/bootstrap').json()['app_name'] == 'huanhuan-workbench'
        for path in ('/api/maintenance', '/api/integrations'):
            assert client.get(path).status_code == 200, path
        source = store.DATA / 'synthetic.mp4'
        video.run([runtime.executable('ffmpeg'), '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x568:rate=12', '-t', '3', '-c:v', 'libx264', source], 30)
        assert float(video.ffprobe(source)['format']['duration']) > 0
        subprocess.run([sys.executable, '-m', 'app.watch_bridge', str(source), str(store.DATA / 'frames-check')], check=True, timeout=90)
        manifest = json.loads((store.DATA / 'frames-check/frames.json').read_text('utf-8'))
        assert manifest['frames']
        for server in ('douyin-mcp', 'douyin-analyzer', 'viralvision-mcp', 'promo-workflow-mcp'):
            print('Checking bundled MCP: ' + server, flush=True)
            try:
                assert runtime.mcp_request(server)['ok'], server
            except Exception:
                log = store.DATA / 'integrations.log'
                if log.exists():
                    print(log.read_text('utf-8', errors='replace')[-12000:], file=sys.stderr, flush=True)
                raise
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            assert Path(p.chromium.executable_path).is_file()
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.set_content('<h1>欢欢工作台</h1>')
            assert page.locator('h1').inner_text() == '欢欢工作台'
            browser.close()
        import keyring.backends.macOS  # Native backend must be present, no plaintext fallback.
        assert (store.ROOT / 'models/whisper/base/model.bin').is_file()
        from faster_whisper import WhisperModel
        model = WhisperModel(str(store.ROOT / 'models/whisper/base'), device='cpu', compute_type='int8', local_files_only=True)
        assert model is not None
    print(json.dumps({'ok': True, 'bundled_runtime': True, 'real_ai_calls': 0}))


if __name__ == '__main__':
    main()
