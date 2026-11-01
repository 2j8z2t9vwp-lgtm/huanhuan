import base64
import ctypes
import json
import os
import sys
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get('HUANHUAN_DATA_DIR', str(ROOT / 'data'))).resolve()
DATA.mkdir(parents=True, exist_ok=True)
DB = DATA / 'huanhuan.db'

def now():
    return datetime.now().astimezone().isoformat(timespec='seconds')

@contextmanager
def connect():
    c = sqlite3.connect(DB, timeout=20)
    try:
        c.execute('PRAGMA journal_mode=WAL')
        with c:
            yield c
    finally:
        c.close()

def init():
    with connect() as c:
        c.execute('CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT PRIMARY KEY, body TEXT)')
        c.execute('CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)')
    for job in listing('video'):
        if job.get('status') in ('queued', 'processing'):
            save('video', {**job, 'status': 'failed', 'stage': '上次处理被中断，请重新拆解', 'error': '程序关闭导致处理停止。可重新提交原链接或上传文件。'})

def listing(kind):
    with connect() as c:
        rows = c.execute('SELECT body FROM records WHERE kind=? ORDER BY rowid DESC', (kind,)).fetchall()
    return [json.loads(r[0]) for r in rows]

def get(kind, ident):
    with connect() as c:
        row = c.execute('SELECT body FROM records WHERE kind=? AND id=?', (kind, ident)).fetchone()
    return json.loads(row[0]) if row else None

def save(kind, body):
    body = dict(body)
    body.setdefault('id', uuid.uuid4().hex)
    body.setdefault('created_at', now())
    body['updated_at'] = now()
    with connect() as c:
        c.execute('INSERT INTO records VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body', (kind, body['id'], json.dumps(body, ensure_ascii=False)))
    return body

def delete(kind, ident):
    with connect() as c:
        c.execute('DELETE FROM records WHERE kind=? AND id=?', (kind, ident))

def config():
    with connect() as c:
        row = c.execute('SELECT value FROM config WHERE key=?', ('settings',)).fetchone()
    defaults = {'provider': 'none', 'base_url': 'https://api.anthropic.com/v1', 'model': '', 'transcribe': True, 'whisper_model': 'base'}
    return {**defaults, **(json.loads(row[0]) if row else {})}

def set_config(settings):
    with connect() as c:
        c.execute('INSERT INTO config VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', ('settings', json.dumps(settings, ensure_ascii=False)))

# Windows DPAPI ties saved API credentials to the current Windows user.
class Blob(ctypes.Structure):
    _fields_ = [('size', ctypes.c_ulong), ('data', ctypes.POINTER(ctypes.c_char))]

def crypt(raw, decrypt=False):
    if sys.platform == 'darwin':
        from .mac_secrets import crypt as mac_crypt
        return mac_crypt(raw, DATA, decrypt)
    if os.name != 'nt':
        raise ValueError('密钥保存目前支持 Windows 和 macOS。')
    if decrypt and raw.startswith(b'HUANHUAN-MAC-1:'):
        raise ValueError('此密钥来自 Mac，请在 Windows 设置页重新填写。')
    buf = ctypes.create_string_buffer(raw)
    src = Blob(len(raw), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))
    dst = Blob()
    dll = ctypes.WinDLL('crypt32', use_last_error=True)
    fn = dll.CryptUnprotectData if decrypt else dll.CryptProtectData
    fn.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(Blob)]
    fn.restype = ctypes.c_int
    if not fn(ctypes.byref(src), None, None, None, None, 1, ctypes.byref(dst)):
        raise ValueError(f'Windows 密钥加密／解密失败（{ctypes.get_last_error()}），请在自己的 Windows 账号下启动工作台后重试。')
    try:
        return ctypes.string_at(dst.data, dst.size)
    finally:
        free = ctypes.windll.kernel32.LocalFree
        free.argtypes = [ctypes.c_void_p]
        free.restype = ctypes.c_void_p
        free(dst.data)

def save_key(key):
    target = DATA / 'credentials.dpapi'
    if key:
        target.write_bytes(base64.b64encode(crypt(key.encode())))
    elif target.exists():
        target.unlink()

def get_key():
    target = DATA / 'credentials.dpapi'
    return crypt(base64.b64decode(target.read_bytes()), True).decode() if target.exists() else ''

def integration_config():
    with connect() as c:
        row = c.execute('SELECT value FROM config WHERE key=?', ('integrations',)).fetchone()
    return {'link_provider': 'local', 'frame_engine': 'watch', 'speech_provider': 'local', **(json.loads(row[0]) if row else {})}

def set_integration_config(settings):
    with connect() as c:
        c.execute('INSERT INTO config VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', ('integrations', json.dumps(settings, ensure_ascii=False)))

def integration_secret(name, value=None):
    if name not in ('alapi', 'siliconflow'):
        raise ValueError('未知密钥类型')
    target = DATA / (name + '.dpapi')
    if value is not None:
        if value:
            target.write_bytes(base64.b64encode(crypt(value.encode())))
        else:
            target.unlink(missing_ok=True)
    return crypt(base64.b64decode(target.read_bytes()), True).decode() if target.exists() else ''
