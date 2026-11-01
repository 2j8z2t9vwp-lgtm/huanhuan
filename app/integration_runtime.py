import asyncio
import importlib.util
import ipaddress
import json
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlparse, urljoin
import httpx
from . import store
from .platform_tools import executable, tool_path

SOURCES = store.ROOT / 'vendor' / 'integrations'
CATALOG = [
    ('douyin-analyzer', '竞品公开数据', 'bettermen/douyin-analyzer', '免 Key 读取公开点赞、评论、转发、收藏，保存竞品观察与对比。', '优先使用'),
    ('douyin-mcp', '抖音备用解析', 'jackyjoylee/douyin-mcp', 'ALAPI 解析链接；硅基流动识别口播。需要本人密钥。', '按需配置'),
    ('viralvision-mcp', '备用画面采样', 'yourhousemktg-ctrl/viralvision-mcp', '可选的均匀抽帧引擎。与 watch 有重合，默认仍使用 watch。', '备用能力'),
    ('promo-workflow-mcp', '宣传项目流程', 'isagoakira/promo-workflow-mcp', '适合上新、节日活动等完整宣传项目，保存阶段与人工审核。', '复杂项目使用'),
]
_review_process = None
_review_url = None
_review_lock = threading.Lock()
_capture_lock = threading.Lock()
_last_capture = 0.0
_promo_lock = threading.RLock()

def node():
    resolved = executable('node')
    if resolved:
        return resolved
    saved = store.ROOT / 'tools' / 'node-path.txt'
    if saved.exists() and Path(saved.read_text('utf-8').strip()).exists():
        return saved.read_text('utf-8').strip()
    raise ValueError('未找到 Node.js，请安装 Node.js 20+ 并重新启动工作台。')

def environment():
    env = os.environ.copy()
    paths = [store.ROOT / 'tools', Path(sys.executable).parent, store.ROOT / 'tools' / 'bin']
    try:
        paths.append(Path(node()).parent)
    except ValueError:
        pass
    env['PATH'] = os.pathsep.join(map(str, paths)) + os.pathsep + tool_path()
    env['PYTHONIOENCODING'] = 'utf-8'
    env['PROMO_WORKFLOW_DATA_DIR'] = str(store.DATA / 'promo')
    env['PROMO_PROJECT_REGISTRY'] = str(store.DATA / 'promo' / 'projects-registry.json')
    env['PROMO_REVIEW_AUTO_START'] = 'false'
    # Do not enable optional external production adapters from unrelated shell settings.
    for key in list(env):
        if key.startswith(('PROMO_CUT_', 'PROMO_VECTCUT', 'PROMO_WORKFLOW_ADAPTER')):
            env.pop(key, None)
    return env

def public_settings():
    cfg = store.integration_config()
    cfg['has_alapi'] = (store.DATA / 'alapi.dpapi').exists()
    cfg['has_siliconflow'] = (store.DATA / 'siliconflow.dpapi').exists()
    result = []
    for slug, title, repo, desc, recommendation in CATALOG:
        source = SOURCES / slug
        downloaded = (source / 'SOURCE.json').exists()
        if slug == 'douyin-mcp':
            ready = downloaded and importlib.util.find_spec('mcp') is not None
            configured = cfg['has_alapi']
        elif slug == 'viralvision-mcp':
            ready = (source / 'dist' / 'utils' / 'frames.js').exists()
            configured = ready
        elif slug == 'promo-workflow-mcp':
            ready = (source / 'packages' / 'promo-mcp' / 'dist' / 'index.js').exists()
            configured = ready
        else:
            ready = (source / 'douyin-analyzer' / 'scripts' / 'douyin_scraper.py').exists()
            configured = ready
        result.append({'id': slug, 'title': title, 'url': 'https://github.com/' + repo, 'description': desc, 'recommendation': recommendation, 'downloaded': downloaded, 'ready': ready, 'configured': configured})
    return {**cfg, 'projects': result}

def source_call(args, payload=None, timeout=75):
    try:
        p = subprocess.run([str(a) for a in args], input=json.dumps(payload, ensure_ascii=False) if payload is not None else None, capture_output=True, encoding='utf-8', errors='replace', timeout=timeout, env=environment(), cwd=store.ROOT, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except subprocess.TimeoutExpired:
        raise ValueError('上游工具处理超时。没有自动重试，请稍后尝试或上传本地视频。') from None
    try:
        result = json.loads(p.stdout)
    except ValueError:
        raise ValueError('集成工具运行失败，请检查依赖安装和 data/server.log。') from None
    if p.returncode or isinstance(result, dict) and result.get('error'):
        message = result.get('error', '上游工具运行失败')
        hint = result.get('hint')
        raise ValueError(str(message)[:600] + ('；' + str(hint)[:400] if hint else ''))
    return result

def douyin_parse(url):
    token = store.integration_secret('alapi')
    if not token:
        raise ValueError('请先在「能力中心」配置 ALAPI Token。此上游的实际解析代码也需要 Token。')
    return source_call([sys.executable, '-m', 'app.douyin_bridge'], {'action': 'parse', 'url': url, 'alapi': token})

def silicon_transcribe(audio, media_root):
    key = store.integration_secret('siliconflow')
    if not key:
        raise ValueError('请先在「能力中心」配置硅基流动 API Key。')
    return source_call([sys.executable, '-m', 'app.douyin_bridge'], {'action': 'transcribe', 'siliconflow': key, 'audio': str(audio), 'media_root': str(media_root)}, 120)['text']

def public_url(url):
    p = urlparse(url)
    if p.scheme not in ('http', 'https') or not p.hostname or p.username or p.password or p.port not in (None, 80, 443):
        raise ValueError('解析服务返回了无效媒体地址。')
    try:
        addresses = socket.getaddrinfo(p.hostname, p.port or (443 if p.scheme == 'https' else 80))
    except OSError:
        raise ValueError('媒体域名暂时无法解析。') from None
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise ValueError('拒绝读取本机或内网媒体地址。')

def download_resolved(url, target):
    total = 0
    with httpx.Client(timeout=40, follow_redirects=False, trust_env=False) as client:
        for _ in range(6):
            public_url(url)
            with client.stream('GET', url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.douyin.com/'}) as response:
                if response.is_redirect:
                    url = urljoin(url, response.headers['location'])
                    continue
                response.raise_for_status()
                with Path(target).open('wb') as out:
                    for chunk in response.iter_bytes(65536):
                        total += len(chunk)
                        if total > 300 * 1024 * 1024:
                            raise ValueError('视频超过 300MB。')
                        out.write(chunk)
                return Path(target)
    raise ValueError('媒体地址重定向过多。')

def capture_info(text):
    global _last_capture
    # One public request at a time, >= 1.5s apart; no automatic retry loops.
    with _capture_lock:
        delay = 1.5 - (time.monotonic() - _last_capture)
        if delay > 0:
            time.sleep(delay)
        try:
            script = SOURCES / 'douyin-analyzer' / 'douyin-analyzer' / 'scripts' / 'douyin_scraper.py'
            return source_call([sys.executable, script, 'info', text], timeout=45)
        finally:
            _last_capture = time.monotonic()

def ratios(stats):
    likes = stats.get('digg_count')
    def ratio(key):
        value = stats.get(key)
        return round(value / likes * 100, 2) if isinstance(likes, (int, float)) and likes > 0 and isinstance(value, (int, float)) else None
    values = [stats.get(k) for k in ('digg_count', 'comment_count', 'share_count', 'collect_count')]
    return {'comment_like': ratio('comment_count'), 'share_like': ratio('share_count'), 'collect_like': ratio('collect_count'), 'engagements': sum(values) if all(isinstance(v, (int, float)) for v in values) else None}

async def mcp_request_async(server, tool=None, arguments=None):
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    if server == 'promo-workflow-mcp':
        params = StdioServerParameters(command=node(), args=[str(SOURCES / server / 'packages' / 'promo-mcp' / 'dist' / 'index.js')], env=environment(), cwd=str(store.ROOT))
    elif server == 'viralvision-mcp':
        params = StdioServerParameters(command=node(), args=[str(SOURCES / server / 'dist' / 'index.js')], env=environment(), cwd=str(store.ROOT))
    elif server == 'douyin-mcp':
        params = StdioServerParameters(command=sys.executable, args=['-m', 'app.douyin_server'], env=environment(), cwd=str(store.ROOT))
    elif server == 'douyin-analyzer':
        params = StdioServerParameters(command=sys.executable, args=[str(SOURCES / server / 'douyin-analyzer' / 'scripts' / 'douyin_mcp_server.py')], env=environment(), cwd=str(store.ROOT))
    else:
        raise ValueError('不支持的 MCP 服务')
    with (store.DATA / 'integrations.log').open('a', encoding='utf-8') as log:
        async with stdio_client(params, errlog=log) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                if tool is None:
                    result = await session.list_tools()
                    return {'ok': True, 'tools': [x.name for x in result.tools]}
                result = await session.call_tool(tool, arguments or {})
                texts = [x.text for x in result.content if x.type == 'text']
                if result.isError:
                    raise ValueError('\n'.join(texts)[:1000])
                if result.structuredContent:
                    return result.structuredContent
                text = '\n'.join(texts)
                try:
                    return json.loads(text)
                except ValueError:
                    return {'text': text}

def mcp_request(server, tool=None, arguments=None):
    try:
        # Serialize upstream Promo processes: mutations must never race on a file store.
        with _promo_lock:
            return asyncio.run(asyncio.wait_for(mcp_request_async(server, tool, arguments), timeout=45))
    except ValueError:
        raise
    except ExceptionGroup as group:
        def first_value(error):
            if isinstance(error, ValueError):
                return str(error)
            if isinstance(error, BaseExceptionGroup):
                return next((message for child in error.exceptions if (message := first_value(child))), None)
        message = first_value(group)
        if message:
            raise ValueError(message) from None
        raise ValueError('本地 MCP 连接未完成，请查看 data/integrations.log 并检查组件安装。') from None
    except Exception:
        raise ValueError('本地 MCP 连接未完成，请查看 data/integrations.log 并检查组件安装。') from None

def stop_review():
    global _review_process, _review_url
    if _review_process and _review_process.poll() is None:
        _review_process.terminate()
        _review_process.wait(timeout=5)
    _review_process = None
    _review_url = None

def launch_review():
    global _review_process, _review_url
    with _review_lock:
        if _review_process and _review_process.poll() is None:
            return _review_url
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        env = environment()
        env['PROMO_REVIEW_HOST'] = '127.0.0.1'
        env['PROMO_REVIEW_PORT'] = str(port)
        entry = store.ROOT / 'app' / 'promo_review_bridge.mjs'
        with (store.DATA / 'promo-review.log').open('ab') as log:
            _review_process = subprocess.Popen([node(), str(entry)], cwd=store.ROOT, env=env, stdout=log, stderr=log, stdin=subprocess.DEVNULL, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        _review_url = f'http://127.0.0.1:{port}'
        for _ in range(25):
            try:
                with urllib.request.urlopen(_review_url, timeout=.5) as response:
                    if response.status == 200:
                        return _review_url
            except OSError:
                time.sleep(.15)
        stop_review()
        raise ValueError('原生审核台没有启动成功，请查看 data/promo-review.log。')
