"""Conservative housekeeping: stale transfer files and old rotated logs only."""
import asyncio
import ctypes
import json
import os
from pathlib import Path
import re
import threading
import time
import subprocess
from fastapi import APIRouter
from pydantic import BaseModel
from . import store

router = APIRouter(prefix='/api/maintenance')
LOCK = threading.Lock()
DAY = 86400

def config():
    with store.connect() as c:
        row = c.execute('SELECT value FROM config WHERE key=?', ('maintenance',)).fetchone()
    return {'auto_cleanup': False, 'last_attempt': 0, 'last_result': None, **(json.loads(row[0]) if row else {})}

def save_config(value):
    with store.connect() as c:
        c.execute('INSERT INTO config VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', ('maintenance', json.dumps(value, ensure_ascii=False)))

def reparse(path):
    try:
        return path.is_symlink() or bool(getattr(path.lstat(), 'st_file_attributes', 0) & 1024)
    except OSError:
        return True

def files_under(root):
    root = Path(root)
    if not root.is_dir() or reparse(root):
        return
    for parent, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = [d for d in dirs if not reparse(Path(parent)/d)]
        for name in files:
            path = Path(parent)/name
            if not reparse(path) and path.resolve().is_relative_to(root.resolve()):
                yield path

def size(root):
    total = 0
    for p in files_under(root):
        try:
            total += p.stat().st_size
        except OSError:
            pass
    return total

def candidates(now=None):
    now = time.time() if now is None else now
    # Never select original videos, frames, transcripts, models, DB or secrets.
    for p in files_under(store.DATA/'media'):
        if p.suffix.lower() not in ('.part', '.ytdl', '.tmp', '.temp'):
            continue
        try:
            if now-p.stat().st_mtime >= 7*DAY:
                yield p, '七天前的下载临时文件'
        except OSError:
            pass
    for p in store.DATA.glob('server.log.*'):
        if reparse(p) or not p.is_file() or not re.fullmatch(r'server\.log\.\d{8}-\d{6}', p.name):
            continue
        if now-p.stat().st_mtime >= 30*DAY:
            yield p, '三十天前的归档日志'

def memory_bytes():
    # Only this backend process; not total browser/Whisper/FFmpeg memory.
    if os.name != 'nt':
        try:
            result = subprocess.run(['/bin/ps', '-o', 'rss=', '-p', str(os.getpid())], capture_output=True, text=True, timeout=3, check=True)
            return int(result.stdout.strip()) * 1024
        except (OSError, ValueError, subprocess.SubprocessError):
            return None
    class Counters(ctypes.Structure):
        _fields_ = [('cb', ctypes.c_ulong), ('PageFaultCount', ctypes.c_ulong), *[(n, ctypes.c_size_t) for n in ('PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage')]]
    kernel = ctypes.windll.kernel32
    kernel.GetCurrentProcess.restype = ctypes.c_void_p
    fn = ctypes.windll.psapi.GetProcessMemoryInfo
    fn.argtypes = [ctypes.c_void_p, ctypes.POINTER(Counters), ctypes.c_ulong]
    value = Counters()
    value.cb = ctypes.sizeof(value)
    return int(value.WorkingSetSize) if fn(kernel.GetCurrentProcess(), ctypes.byref(value), value.cb) else None

def active():
    return any(v.get('status') in ('queued','processing') for v in store.listing('video'))

@router.get('')
def overview():
    data = store.DATA
    groups = {'videos_and_frames': size(data/'media'), 'models': size(data/'models'), 'promo': size(data/'promo')}
    groups['other_data'] = max(0, size(data)-sum(groups.values()))
    preview = []
    for p, reason in candidates():
        try:
            preview.append({'file': p.relative_to(data).as_posix(), 'bytes': p.stat().st_size, 'reason': reason})
        except OSError:
            pass
    return {'memory_bytes': memory_bytes(), 'memory_scope': '仅主服务进程，不含浏览器、FFmpeg 和转写子进程', 'storage': groups, 'total_bytes': sum(groups.values()), 'cleanup_bytes': sum(p['bytes'] for p in preview), 'cleanup_count': len(preview), 'preview': preview[:50], 'active_jobs': active(), 'config': config()}

def cleanup(automatic=False):
    if not LOCK.acquire(blocking=False):
        raise ValueError('已有清理任务运行，请稍后刷新。')
    try:
        if active():
            return {'skipped': True, 'reason': '视频处理中，本次跳过清理', 'files': 0, 'bytes': 0}
        freed = count = failed = 0
        for p, _ in list(candidates()):
            # Recheck file age and safe containment at deletion time.
            if reparse(p) or not p.resolve().is_relative_to(store.DATA.resolve()):
                continue
            try:
                length = p.stat().st_size
                p.unlink()
                count += 1
                freed += length
            except OSError:
                failed += 1
        result = {'skipped': False, 'files': count, 'bytes': freed, 'failed': failed, 'automatic': automatic, 'time': store.now()}
        cfg = config()
        cfg.update(last_attempt=time.time(), last_result=result)
        save_config(cfg)
        return result
    finally:
        LOCK.release()

class Preference(BaseModel):
    auto_cleanup: bool

@router.put('/settings')
def preferences(body: Preference):
    cfg = config()
    cfg['auto_cleanup'] = body.auto_cleanup
    if body.auto_cleanup and not cfg.get('last_attempt'):
        cfg['last_attempt'] = time.time()  # First scheduled run is after 24 hours.
    save_config(cfg)
    return cfg

@router.post('/cleanup')
def run_cleanup():
    return cleanup()

async def periodic():
    while True:
        try:
            await asyncio.to_thread(run_due)
        except Exception:
            # Housekeeping must not stop the content service; retry next tick.
            pass
        await asyncio.sleep(1800)

def run_due():
    cfg = config()
    if cfg['auto_cleanup'] and time.time()-cfg['last_attempt'] >= DAY:
        return cleanup(True)
    return None
