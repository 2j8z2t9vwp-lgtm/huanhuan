"""Read a Douyin page in a new isolated browser.

Only cookies explicitly imported into this app may be used. No persistent
browser profile, automatic extraction of browser cookies, login automation, challenge
solving, or premium playback is used. Only a media source exposed to this fresh
page is accepted, and download validation remains in integration_runtime.
"""
import json
import os
import re
from pathlib import Path
import sys
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]

def browser_executable():
    choices = []
    if sys.platform == 'darwin':
        for root in (Path('/Applications'), Path.home() / 'Applications'):
            choices.extend([root / 'Google Chrome.app/Contents/MacOS/Google Chrome', root / 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge', root / 'Chromium.app/Contents/MacOS/Chromium'])
    for variable in ('PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'):
        folder = os.environ.get(variable)
        if folder:
            choices.extend([Path(folder) / 'Google' / 'Chrome' / 'Application' / 'chrome.exe', Path(folder) / 'Microsoft' / 'Edge' / 'Application' / 'msedge.exe'])
    return next((str(p) for p in choices if p.is_file()), None)

def resolve_public_video(url):
    host = (urlparse(url).hostname or '').lower()
    if not any(host == h or host.endswith('.' + h) for h in ('douyin.com', 'iesdouyin.com')):
        raise ValueError('公开浏览器读取仅用于抖音链接。')
    # Desktop short-link redirects can discard the work and land on the feed.
    # Resolve its public work ID first, then navigate to that specific work.
    import asyncio
    import importlib.util
    source = ROOT / 'vendor/integrations/douyin-analyzer/douyin-analyzer/scripts/douyin_scraper.py'
    spec = importlib.util.spec_from_file_location('huanhuan_public_resolver', source)
    resolver = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(resolver)
    resolved = asyncio.run(resolver.resolve_aweme_id(url))
    work_id = str(resolved['aweme_id'])
    if not re.fullmatch(r'\d{10,25}', work_id):
        raise ValueError('未能确定分享链接对应的作品编号。')
    url = 'https://www.douyin.com/video/' + work_id
    from playwright.sync_api import sync_playwright
    executable = browser_executable()
    with sync_playwright() as p:
        if not executable and Path(p.chromium.executable_path).is_file():
            executable = p.chromium.executable_path
        if not executable:
            raise ValueError('未找到内置浏览器、Chrome 或 Edge；可以上传视频，或安装浏览器后重试。')
        browser = p.chromium.launch(executable_path=executable, headless=True)
        try:
            context = browser.new_context(viewport={'width': 1100, 'height': 850})
            # Use only the platform cookies explicitly imported into this app.
            from app import store
            from http.cookiejar import MozillaCookieJar
            cookie_file = store.DATA / 'cookies.txt'
            authenticated = False
            if cookie_file.exists():
                jar = MozillaCookieJar(str(cookie_file))
                jar.load(ignore_discard=True, ignore_expires=False)
                cookies = []
                for c in jar:
                    domain = c.domain.lstrip('.').lower()
                    if any(domain == h or domain.endswith('.' + h) for h in ('douyin.com', 'iesdouyin.com')):
                        item = {'name': c.name, 'value': c.value, 'domain': c.domain, 'path': c.path or '/', 'secure': bool(c.secure)}
                        if c.expires:
                            item['expires'] = float(c.expires)
                        cookies.append(item)
                if cookies:
                    context.add_cookies(cookies)
                    authenticated = True
            page = context.new_page()
            try:
                page.goto(url, wait_until='domcontentloaded', timeout=25000)
            except Exception as navigation_error:
                from playwright.sync_api import TimeoutError as BrowserTimeout
                if not isinstance(navigation_error, BrowserTimeout):
                    raise
            # Wait only for media already supplied to this ordinary public page.
            # Do not click login buttons or dismiss/solve a verification challenge.
            if not re.search(r'/(?:share/)?video/' + work_id + r'(?:[/?#]|$)', page.url) and ('modal_id=' + work_id) not in page.url:
                raise ValueError('抖音将目标作品跳转到了其他页面，未读取首页推荐视频。请在抖音确认该作品是否可正常打开。')
            try:
                page.wait_for_function('(wid)=>(location.pathname.endsWith("/video/"+wid)||new URLSearchParams(location.search).get("modal_id")===wid)&&Array.from(document.querySelectorAll("video")).some(v=>{try {const u=new URL(v.currentSrc||v.src);return u.protocol==="https:"&&["douyinvod.com","douyin.com","bytecdn.cn","ibytedtos.com","byteimg.com"].some(h=>u.hostname===h||u.hostname.endsWith("."+h))&&Number.isFinite(v.duration)&&v.duration>0} catch {return false}})', arg=work_id, timeout=18000)
            except Exception:
                try:
                    body = page.locator('body').inner_text(timeout=1500)
                except Exception:
                    body = ''
                if os.environ.get('HUANHUAN_BROWSER_DIAGNOSTICS') == '1':
                    diagnostic = store.DATA / 'diagnostics' / 'link-diagnostic.png'
                    diagnostic.parent.mkdir(exist_ok=True)
                    page.screenshot(path=str(diagnostic))
                    print(json.dumps({'page_title': page.title(), 'page_host': urlparse(page.url).hostname, 'video_count': page.locator('video').count(), 'body_excerpt': body[:1400]}, ensure_ascii=False), file=sys.stderr)
                if '抖音精选电脑版' in page.title():
                    reason = '已定位作品编号 ' + work_id + '，但抖音实际展示的是精选推荐页，未加载目标作品。不会把推荐视频当成你的素材。'
                elif any(t in body for t in ('验证码', '完成验证', '安全验证', '拖动滑块')):
                    reason = '抖音页面要求安全验证，自动读取已停止。'
                elif any(t in body for t in ('作品不存在', '视频已删除', '暂时无法观看', '私密账号')):
                    reason = '该作品页面提示已删除、不可观看或访问受限。'
                else:
                    reason = '抖音页面未在等待时间内提供实际作品的播放地址；可能是网络、登录状态或平台限制。'
                raise ValueError(reason + ' 导入 Cookie 不等于一定能访问所有作品。') from None
            if not re.search(r'/(?:share/)?video/' + work_id + r'(?:[/?#]|$)', page.url) and ('modal_id=' + work_id) not in page.url:
                raise ValueError('当前播放页不是提交的目标作品，已停止读取。请重新提交目标链接。')
            candidates = page.locator('video').evaluate_all('(items)=>items.map(v=>({url:v.currentSrc||v.src,duration:Number.isFinite(v.duration)?v.duration:null}))')
            allowed_media = ('douyinvod.com', 'douyin.com', 'bytecdn.cn', 'ibytedtos.com', 'byteimg.com')
            media = next((v for v in candidates if v['url'].startswith('https://') and v['duration'] and any((urlparse(v['url']).hostname or '').lower() == h or (urlparse(v['url']).hostname or '').lower().endswith('.' + h) for h in allowed_media)), None)
            if not media or media['duration'] > 600:
                raise ValueError('未获得 10 分钟以内的公开视频。')
            media_host = (urlparse(media['url']).hostname or '').lower()
            if not any(media_host == h or media_host.endswith('.' + h) for h in ('douyinvod.com', 'douyin.com', 'bytecdn.cn', 'ibytedtos.com', 'byteimg.com')):
                raise ValueError('网页媒体地址不属于支持的视频域名：' + media_host)
            return {'url': media['url'], 'duration': media['duration'], 'title': page.title().removesuffix(' - 抖音'), 'source': 'imported-cookie-browser' if authenticated else 'fresh-public-browser', 'note': '使用你在工作台导入的平台 Cookie 读取播放版本。' if authenticated else '由全新未登录浏览器读取公开播放版本，清晰度以该版本为准。'}
        finally:
            browser.close()

if __name__ == '__main__':
    try:
        print(json.dumps(resolve_public_video(sys.argv[1]), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'error': str(error)[:600]}, ensure_ascii=False))
        raise SystemExit(1)
