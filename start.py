from pathlib import Path
import os
import socket
import threading
import webbrowser
import urllib.request
import json
import uvicorn

if __name__ == '__main__':
    os.chdir(Path(__file__).resolve().parent)
    port = int(os.environ.get('HUANHUAN_PORT', '8765'))
    with socket.socket() as sock:
        running = sock.connect_ex(('127.0.0.1', port)) == 0
    if running:
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/bootstrap', timeout=3) as response:
                same_app = json.load(response).get('app_name') == 'huanhuan-workbench'
        except Exception:
            same_app = False
        if same_app:
            print('Workbench is already running. Opening browser.')
            webbrowser.open(f'http://127.0.0.1:{port}')
        else:
            print(f'Port {port} belongs to another program. Set HUANHUAN_PORT to a different port and retry.')
    else:
        threading.Timer(1.5, lambda: webbrowser.open(f'http://127.0.0.1:{port}')).start()
        uvicorn.run('app.main:app', host='127.0.0.1', port=port, access_log=False)
