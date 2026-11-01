"""Start/stop the local workbench on Windows and macOS."""
import json
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get('HUANHUAN_PORT', '8765'))
URL = f'http://127.0.0.1:{PORT}'

def health():
    try:
        with urllib.request.urlopen(URL + '/api/bootstrap', timeout=2) as response:
            data = json.load(response)
        return data if data.get('app_name') == 'huanhuan-workbench' else None
    except Exception:
        return None

def main():
    command = sys.argv[1] if len(sys.argv) > 1 else 'start'
    running = health()
    if command == 'stop':
        if running:
            # Kill only the PID returned by our verified local app, never a port owner guessed from netstat.
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(int(running['pid'])), '/T', '/F'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
            else:
                os.kill(int(running['pid']), signal.SIGTERM)
            print('Workbench stopped. Your data is preserved.')
        else:
            print('Workbench is not running on this port.')
        return
    if command == 'status':
        print(('Running: ' + URL) if running else 'Not running')
        return
    if command != 'start':
        raise SystemExit('Use: manage.py start|stop|status [--no-browser]')
    if not running:
        with socket.socket() as sock:
            if sock.connect_ex(('127.0.0.1', PORT)) == 0:
                raise SystemExit(f'Port {PORT} belongs to another program. Choose another HUANHUAN_PORT.')
        data_dir = ROOT / 'data'
        data_dir.mkdir(exist_ok=True)
        logfile = data_dir / 'server.log'
        if logfile.is_file() and logfile.stat().st_size >= 5*1024*1024:
            logfile.rename(data_dir / time.strftime('server.log.%Y%m%d-%H%M%S'))
        with (data_dir / 'server.log').open('ab') as log:
            env = os.environ.copy()
            env['PYTHONIOENCODING'] = 'utf-8'
            subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(PORT), '--no-access-log'], cwd=ROOT, stdout=log, stderr=log, stdin=subprocess.DEVNULL, env=env, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), start_new_session=os.name != 'nt')
        for _ in range(50):
            running = health()
            if running:
                break
            time.sleep(.2)
    if not running:
        raise SystemExit('Could not start. See data/server.log for details.')
    print('Workbench ready: ' + URL)
    if '--no-browser' not in sys.argv:
        webbrowser.open(URL)

if __name__ == '__main__':
    main()
