import html
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import unquote, urlparse
import httpx
from . import store, planning, ai
from .platform_tools import require_tool, tool_path
from . import integration_runtime as integrations

POOL = ThreadPoolExecutor(max_workers=1)
MAX_BYTES = 300 * 1024 * 1024
MEDIA = store.DATA / 'media'
MEDIA.mkdir(exist_ok=True)
ALLOWED = ('douyin.com', 'iesdouyin.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'bilibili.com', 'b23.tv', 'xiaohongshu.com', 'xhslink.com')
TOOLS = store.ROOT / 'tools'
WATCH_SKILL = store.ROOT / 'vendor' / 'claude-video' / 'skills' / 'watch'
ENGINE = 'claude-video / watch 0.3.2'

def run(args, timeout=300):
    env = os.environ.copy()
    env['PATH'] = str(Path(sys.executable).parent) + os.pathsep + tool_path()
    env['HF_HOME'] = str(store.DATA / 'models')
    env['PYTHONIOENCODING'] = 'utf-8'
    p = subprocess.run([str(a) for a in args], capture_output=True, timeout=timeout, encoding='utf-8', errors='replace', env=env, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if p.returncode:
        message = (p.stderr or p.stdout)[-2000:]
        # Do not put cookie values or signed CDN URLs into UI errors.
        message = re.sub(r'https?://\S+', '[地址已省略]', message)
        raise ValueError(message)
    return p.stdout

def parse_link(text):
    found = re.search(r'https?://[^\s<>"，。！；]+', text)
    if not found:
        raise ValueError('请粘贴抖音分享文案或完整视频链接。')
    url = found.group(0).rstrip('.,;!）)')
    p = urlparse(url)
    host = (p.hostname or '').lower()
    if p.username or p.password or p.port not in (None, 80, 443) or not any(host == s or host.endswith('.' + s) for s in ALLOWED):
        raise ValueError('目前支持抖音、TikTok、YouTube、B站、小红书的公开视频链接；本地文件请用上传入口。')
    return url

def ffprobe(file):
    raw = run([require_tool('ffprobe'), '-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], 40)
    data = json.loads(raw)
    if not any(s.get('codec_type') == 'video' for s in data.get('streams', [])):
        raise ValueError('文件中没有可读取的视频画面。')
    duration = float(data.get('format', {}).get('duration', 0))
    if duration <= 0 or duration > 600:
        raise ValueError('当前支持 10 分钟以内的视频，请先剪出需要拆解的部分。')
    return data

def update(ident, **fields):
    current = store.get('video', ident)
    if current:
        return store.save('video', {**current, **fields})

def ensure_frames(ident):
    """Repair missing frame assets from the existing original, preserving edits."""
    item = store.get('video', ident)
    if not item:
        raise ValueError('视频记录不存在。')
    folder = (MEDIA / ident).resolve()
    if folder.parent != MEDIA.resolve():
        raise ValueError('无效视频路径。')
    frames = item.get('frames', [])
    if frames and all((folder / f['file']).resolve().is_relative_to(folder) and (folder / f['file']).is_file() for f in frames):
        return item
    source = next((p for p in folder.glob('source.*') if p.suffix.lower() in ('.mp4', '.webm', '.mkv', '.mov', '.avi', '.m4v')), None)
    if not source:
        raise ValueError('本地关键帧和原视频缺失，请重新上传视频后再分析。已有脚本和文字记录仍保留。')
    out = folder / 'extracted'
    if item.get('engine', '').startswith('ViralVision'):
        run([integrations.node(), store.ROOT / 'app' / 'viral_bridge.mjs', source, out, str(float(ffprobe(source)['format']['duration']))], 180)
    else:
        run([sys.executable, '-m', 'app.watch_bridge', source, out], 300)
    manifest = json.loads((out / 'frames.json').read_text('utf-8'))
    restored = []
    for f in manifest.get('frames', []) if isinstance(manifest, dict) else manifest:
        path = (out / f['file']).resolve()
        if not path.is_relative_to(folder) or not path.is_file():
            continue
        rel = path.relative_to(folder).as_posix()
        restored.append({**f, 'file': rel, 'url': f'/media/{ident}/{rel}'})
    if not restored:
        raise ValueError('未能恢复关键帧，请重新上传视频。已有文字记录仍保留。')
    return update(ident, frames=restored)

def download(url, folder):
    cookie = store.DATA / 'cookies.txt'
    args = [sys.executable, '-m', 'yt_dlp', '--no-playlist', '--no-warnings', '--socket-timeout', '20', '--retries', '1', '--max-filesize', '300M', '--match-filter', 'duration <= 600', '--ffmpeg-location', Path(require_tool('ffmpeg')).parent, '-f', 'best[ext=mp4]/best', '--write-info-json', '-o', folder / 'source.%(ext)s', url]
    if cookie.exists():
        args += ['--cookies', cookie]
    try:
        run(args, 240)
        files = [f for f in folder.glob('source.*') if f.suffix.lower() in ('.mp4', '.webm', '.mkv', '.mov')]
        if not files:
            raise ValueError('平台未提供可下载的视频或超过大小限制。')
        meta_file = folder / 'source.info.json'
        return files[0], json.loads(meta_file.read_text('utf-8')) if meta_file.exists() else {}
    except Exception as error:
        if 'douyin.com' in (urlparse(url).hostname or ''):
            try:
                return douyin_fallback(url, folder)
            except Exception:
                try:
                    parsed = integrations.source_call([sys.executable, '-m', 'app.browser_fetch', url], timeout=75)
                    target = integrations.download_resolved(parsed['url'], folder / 'source.mp4')
                    return target, {'title': parsed.get('title', ''), 'download_source': parsed['source'], 'download_note': parsed['note']}
                except Exception as browser_error:
                    detail = re.sub(r'https?://\S+', '[地址已省略]', str(browser_error)).split('Call log:')[0].strip()[:350]
                    imported = '已使用你导入的 Cookie，但它不能保证所有作品都可读取。' if cookie.exists() else '尚未导入平台 Cookie。'
                    raise ValueError('链接读取失败。' + imported + '具体原因：' + detail + ' 可以上传视频文件继续拆解。') from error
        raise

def douyin_fallback(url, folder):
    """Read public SSR data when the platform supplies it; no signature bypass."""
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36', 'Referer': 'https://www.douyin.com/'}
    cookie_file = store.DATA / 'cookies.txt'
    if cookie_file.exists():
        from http.cookiejar import MozillaCookieJar
        jar = MozillaCookieJar(str(cookie_file))
        jar.load(ignore_discard=True, ignore_expires=True)
        pairs = [f'{c.name}={c.value}' for c in jar if c.domain.lstrip('.').endswith('douyin.com')]
        if pairs:
            headers['Cookie'] = '; '.join(pairs)
    with httpx.Client(headers=headers, timeout=30, follow_redirects=False, trust_env=False) as client:
        for _ in range(5):
            parse_link(url)
            response = client.get(url)
            if response.is_redirect:
                from urllib.parse import urljoin
                url = urljoin(url, response.headers['location'])
            else:
                break
        response.raise_for_status()
        page = response.text
        candidates = []
        for pattern in (r'window\._ROUTER_DATA\s*=\s*(\{.*?\})\s*</script>', r'<script[^>]+id="RENDER_DATA"[^>]*>(.*?)</script>'):
            for match in re.findall(pattern, page, re.S):
                try:
                    candidates.append(json.loads(unquote(html.unescape(match))))
                except (ValueError, TypeError):
                    continue
        def find(obj):
            if isinstance(obj, dict):
                v = obj.get('video')
                if isinstance(v, dict) and ('play_addr' in v or 'playAddr' in v):
                    return obj
                for value in obj.values():
                    result = find(value)
                    if result:
                        return result
            elif isinstance(obj, list):
                for value in obj:
                    result = find(value)
                    if result:
                        return result
        item = next((v for c in candidates if (v := find(c))), None)
        if not item:
            raise ValueError('公开视频数据不可用')
        addr = item['video'].get('play_addr') or item['video'].get('playAddr')
        addresses = addr.get('url_list') or addr.get('urlList') or []
        stream_url = addresses[0]
        # Send authentication only to Douyin pages, never to arbitrary media hosts.
        with httpx.Client(timeout=45, follow_redirects=True, trust_env=False, headers={'User-Agent': headers['User-Agent'], 'Referer': 'https://www.douyin.com/'}) as media_client:
            with media_client.stream('GET', stream_url) as res:
                res.raise_for_status()
                target = folder / 'source.mp4'
                total = 0
                with target.open('wb') as f:
                    for chunk in res.iter_bytes(65536):
                        total += len(chunk)
                        if total > MAX_BYTES:
                            raise ValueError('文件超过 300MB')
                        f.write(chunk)
        return target, {'title': item.get('desc', ''), 'uploader': (item.get('author') or {}).get('nickname', ''), 'description': item.get('desc', '')}

def process(ident, local_file=None):
    folder = MEDIA / ident
    folder.mkdir(exist_ok=True)
    try:
        update(ident, status='processing', stage='读取视频', progress=10)
        video = store.get('video', ident)
        extras = store.integration_config()
        metadata = {}
        if local_file:
            source = Path(local_file)
        else:
            update(ident, stage='解析分享链接并下载视频', progress=15)
            provider = extras.get('link_provider', 'local')
            benchmark = store.get('benchmark', video['source_benchmark_id']) if video.get('source_benchmark_id') else None
            if benchmark:
                source = integrations.download_resolved(benchmark['media_url'], folder / 'source.mp4')
                metadata = {'title': benchmark['title'], 'uploader': benchmark.get('author', {}).get('nickname', ''), 'stats': benchmark.get('stats'), 'ratios': benchmark.get('ratios')}
            elif provider in ('analyzer', 'douyin_mcp') and any((urlparse(video['url']).hostname or '').endswith(s) for s in ('douyin.com', 'iesdouyin.com')):
                parsed = integrations.capture_info(video['url']) if provider == 'analyzer' else integrations.douyin_parse(video['url'])
                media_url = parsed.get('no_watermark_play_url') if provider == 'analyzer' else parsed.get('url')
                if not media_url:
                    raise ValueError('该解析方案未返回可读取的视频地址。可在能力中心换回本地解析，或上传原片。')
                source = integrations.download_resolved(media_url, folder / 'source.mp4')
                metadata = {'title': parsed.get('title'), 'uploader': (parsed.get('author') or {}).get('nickname', ''), 'stats': parsed.get('stats')}
            else:
                source, metadata = download(video['url'], folder)
        probe = ffprobe(source)
        duration = float(probe['format']['duration'])
        use_viral = extras.get('frame_engine') == 'viralvision'
        engine = 'ViralVision 1.0.0' if use_viral else ENGINE
        update(ident, title=metadata.get('title') or video['title'], duration=round(duration, 2), author=metadata.get('uploader', ''), public_stats=metadata.get('stats'), download_source=metadata.get('download_source') or video.get('download_source'), engine=engine, progress=35, stage=engine + ' · 抽取画面')
        out = folder / 'extracted'
        if use_viral:
            run([integrations.node(), store.ROOT / 'app' / 'viral_bridge.mjs', source, out, str(duration)], 180)
        else:
            run([sys.executable, '-m', 'app.watch_bridge', source, out], 300)
        frame_file = out / 'frames.json'
        raw_frames = json.loads(frame_file.read_text('utf-8')) if frame_file.exists() else []
        if isinstance(raw_frames, dict):
            raw_frames = raw_frames.get('frames', [])
        frames = []
        for index, f in enumerate(raw_frames):
            original = f.get('file', '')
            candidates = [out / original, out / 'frames' / Path(original).name]
            found = next((x for x in candidates if x.is_file()), None)
            if found:
                rel = found.relative_to(folder).as_posix()
                frames.append({**f, 'file': rel, 'url': f'/media/{ident}/{rel}'})
        if not frames:
            raise ValueError('抽帧未产出可读取的画面，请检查视频文件。')
        transcript = ''
        warnings = []
        if metadata.get('download_note'):
            warnings.append(metadata['download_note'])
        if use_viral:
            warnings.append('ViralVision 的时间点按采样率估算，适合浏览定位；不是逐帧测得的精确时间，不用于计算真实切镜频率。')
        cfg = store.config()
        if cfg.get('transcribe') and any(s.get('codec_type') == 'audio' for s in probe['streams']):
            update(ident, stage='本地语音识别（首次需要下载模型）', progress=60, frames=frames)
            try:
                if extras.get('speech_provider') == 'siliconflow':
                    update(ident, stage='硅基流动语音转写（音频发送至所选服务）', progress=65)
                    audio = folder / 'speech.mp3'
                    run([require_tool('ffmpeg'), '-y', '-i', source, '-vn', '-ac', '1', '-ar', '16000', '-codec:a', 'libmp3lame', audio], 90)
                    transcript = integrations.silicon_transcribe(audio, MEDIA)
                    warnings.append('此台词由硅基流动识别；上游未返回分段时间戳，不能据此确定开场台词或各段时长。')
                else:
                    raw = run([sys.executable, '-m', 'app.transcribe', source, folder / 'transcript.json', cfg.get('whisper_model', 'base')], 600)
                    segments = json.loads((folder / 'transcript.json').read_text('utf-8'))
                    transcript = '\n'.join(f'[{s["start"]:.1f}s–{s["end"]:.1f}s] {s["text"]}' for s in segments)
                if not transcript:
                    warnings.append('语音模型未检测到人声；不代表原视频一定没有人声，请播放核对。')
            except Exception:
                warnings.append('本地语音识别未完成（模型下载或运行失败）；关键帧已保留。可在设置检查模型，或手动补充台词。')
        else:
            warnings.append('未运行语音转写：设置已关闭或未检测到音轨。')
        current = update(ident, frames=frames, transcript=transcript, warnings=warnings, progress=85, stage='整理拆解素材')
        report = planning.rule_report(transcript, frames, {**metadata, 'duration': duration})
        if cfg.get('provider') != 'none':
            try:
                update(ident, stage='AI 分析关键帧与转写', progress=90)
                report = ai.analyze(current, folder)
            except Exception as error:
                warnings.append(str(error)[:250])
        update(ident, status='ready', stage='素材拆解完成', progress=100, report=report, warnings=warnings, media_url=f'/media/{ident}/{source.name}')
    except Exception as error:
        message = '处理超时，请换一个更短的视频或上传文件。' if isinstance(error, subprocess.TimeoutExpired) else str(error)
        update(ident, status='failed', stage='处理未完成', error=message[:1800], progress=0)
