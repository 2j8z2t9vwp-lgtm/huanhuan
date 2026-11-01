"""Native Mac shell around the unchanged local workbench and its child workers."""
import os
from pathlib import Path
import runpy
import sys


def prepare():
    if sys.platform == 'darwin':
        data = Path.home() / 'Library/Application Support/欢欢工作台'
        os.environ.setdefault('HUANHUAN_DATA_DIR', str(data))
        data.mkdir(parents=True, exist_ok=True)
    root = Path(__file__).resolve().parent
    if getattr(sys, 'frozen', False):
        resources = Path(sys.executable).resolve().parents[1] / 'Resources'
        if (resources / 'browsers').exists():
            root = resources
    if (root / 'browsers').exists():
        os.environ['PLAYWRIGHT_BROWSERS_PATH'] = str(root / 'browsers')
    # Windowed bootloaders can leave these as None, including in subprocesses.
    # Keep worker JSON and MCP traffic on the inherited pipes, never on the GUI log.
    for name, fd in (('stdin', 0), ('stdout', 1), ('stderr', 2)):
        if getattr(sys, name) is None:
            try:
                stream = os.fdopen(os.dup(fd), 'r' if fd == 0 else 'w', encoding='utf-8', buffering=1)
            except OSError:
                stream = open(os.devnull, 'r' if fd == 0 else 'w', encoding='utf-8')
            setattr(sys, name, stream)


def worker():
    if len(sys.argv) > 2 and sys.argv[1] == '-m':
        module = sys.argv[2]
        sys.argv = [module, *sys.argv[3:]]
        runpy.run_module(module, run_name='__main__', alter_sys=True)
        return True
    if len(sys.argv) > 1 and sys.argv[1].endswith('.py'):
        script = Path(sys.argv[1]).resolve()
        sys.argv = [str(script), *sys.argv[2:]]
        sys.path.insert(0, str(script.parent))
        runpy.run_path(str(script), run_name='__main__')
        return True
    return False


def main():
    import json
    import socket
    import threading
    import time
    import urllib.request
    import webbrowser
    import uvicorn
    import webview
    from app import store
    from app.main import app

    log = (store.DATA / 'desktop.log').open('a', encoding='utf-8', buffering=1)
    sys.stdout = sys.stderr = log
    port = int(os.environ.get('HUANHUAN_PORT', '8765'))
    url = f'http://127.0.0.1:{port}'
    with socket.socket() as sock:
        occupied = sock.connect_ex(('127.0.0.1', port)) == 0
    if occupied:
        try:
            with urllib.request.urlopen(url + '/api/bootstrap', timeout=2) as response:
                ours = json.load(response).get('app_name') == 'huanhuan-workbench'
        except Exception:
            ours = False
        if ours:
            webbrowser.open(url)
            return
        webview.create_window('欢欢工作台', html='<h2>工作台暂时无法启动</h2><p>8765 端口正被其他程序使用，请关闭占用程序后重试。</p>')
        webview.start()
        return
    server = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=port, access_log=False, log_config=None))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.monotonic() + 20
    while not server.started and thread.is_alive() and time.monotonic() < deadline:
        time.sleep(.1)
    if not server.started:
        server.should_exit = True
        webview.create_window('欢欢工作台', html='<h2>启动失败</h2><p>请查看“资源库 / Application Support / 欢欢工作台 / desktop.log”。</p>')
        webview.start()
        return
    webview.settings['ALLOW_DOWNLOADS'] = True
    window = webview.create_window('欢欢工作台', url, width=1380, height=900, min_size=(900, 640))
    window.events.closed += lambda: setattr(server, 'should_exit', True)
    try:
        webview.start(private_mode=False, storage_path=str(store.DATA / 'webview'))
    finally:
        server.should_exit = True
        thread.join(timeout=10)


if __name__ == '__main__':
    import multiprocessing
    multiprocessing.freeze_support()
    prepare()
    if not worker():
        main()
