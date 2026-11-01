import json
import os
import re
import shutil
import uuid
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from . import store, video, planning, ai
from . import integration_runtime
from .integrations import router as integrations_router
from . import maintenance

@asynccontextmanager
async def lifespan(app):
    store.init()
    housekeeping = asyncio.create_task(maintenance.periodic())
    try:
        yield
    finally:
        housekeeping.cancel()
        try:
            await housekeeping
        except asyncio.CancelledError:
            pass
        integration_runtime.stop_review()

app = FastAPI(title='欢欢工作台', lifespan=lifespan)

@app.middleware('http')
async def local_only(request: Request, call_next):
    hostname = (request.url.hostname or '').lower()
    if hostname not in ('127.0.0.1', 'localhost', '::1', 'testserver'):
        return JSONResponse({'detail': '仅允许本机访问'}, status_code=403)
    origin = request.headers.get('origin')
    if origin and urlparse(origin).netloc != request.headers.get('host'):
        return JSONResponse({'detail': '拒绝跨来源请求'}, status_code=403)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['X-Frame-Options'] = 'DENY'
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    return response

@app.exception_handler(ValueError)
async def bad_value(request, error):
    return JSONResponse({'detail': str(error)}, status_code=400)

def require(kind, ident):
    value = store.get(kind, ident)
    if not value:
        raise HTTPException(404, '未找到这条记录')
    return value

def public_settings():
    cfg = store.config()
    cfg['has_key'] = (store.DATA / 'credentials.dpapi').exists()
    cfg['has_cookies'] = (store.DATA / 'cookies.txt').exists()
    cfg['ffmpeg_ready'] = all(video.integrations.executable(f) for f in ('ffmpeg', 'ffprobe'))
    cfg['engine'] = video.ENGINE
    cfg['engine_ready'] = (video.WATCH_SKILL / 'scripts' / 'frames.py').is_file()
    cfg['model_cached'] = any((store.DATA / 'models' / 'whisper').rglob('model.bin')) if (store.DATA / 'models' / 'whisper').exists() else False
    return cfg

@app.get('/api/bootstrap')
def bootstrap():
    return {'app_name': 'huanhuan-workbench', 'pid': os.getpid(), 'profiles': store.listing('profile'), 'videos': store.listing('video'), 'scripts': store.listing('script'), 'settings': public_settings(), 'angles': planning.ANGLES, 'integrations': integration_runtime.public_settings(), 'benchmarks': store.listing('benchmark'), 'campaigns': store.listing('campaign')}

class Profile(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    city: str = Field(default='', max_length=100)
    category: str = Field(default='', max_length=100)
    dish: str = Field(default='', max_length=200)
    price: str = Field(default='', max_length=200)
    audience: str = Field(default='', max_length=400)
    advantage: str = Field(default='', max_length=800)
    location: str = Field(default='', max_length=400)
    tone: str = Field(default='真实、亲切、像老板日常说话', max_length=300)

@app.post('/api/profiles')
def create_profile(body: Profile):
    return store.save('profile', body.model_dump())

@app.put('/api/profiles/{ident}')
def update_profile(ident: str, body: Profile):
    return store.save('profile', {**require('profile', ident), **body.model_dump()})

class LinkBody(BaseModel):
    text: str = Field(min_length=1, max_length=5000)

@app.post('/api/videos')
def create_video(body: LinkBody):
    if sum(x.get('status') in ('queued', 'processing') for x in store.listing('video')) >= 5:
        raise HTTPException(429, '已有 5 条视频排队，请稍后再添加。')
    if not public_settings()['ffmpeg_ready']:
        raise ValueError('视频处理工具尚未安装，请运行「安装依赖.bat」。')
    url = video.parse_link(body.text)
    job = store.save('video', {'url': url, 'title': '链接视频 · 等待解析', 'status': 'queued', 'stage': '等待处理', 'progress': 0, 'frames': [], 'notes': ''})
    video.POOL.submit(video.process, job['id'])
    return job

@app.post('/api/videos/upload')
async def upload_video(file: UploadFile = File(...)):
    if sum(x.get('status') in ('queued', 'processing') for x in store.listing('video')) >= 5:
        raise HTTPException(429, '已有 5 条视频排队，请稍后上传。')
    if not public_settings()['ffmpeg_ready']:
        raise ValueError('视频处理工具尚未安装，请运行「安装依赖.bat」。')
    suffix = Path(file.filename or '').suffix.lower()
    if suffix not in ('.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'):
        raise ValueError('请上传 MP4、MOV、MKV、WebM、AVI 或 M4V 视频。')
    ident = uuid.uuid4().hex
    folder = video.MEDIA / ident
    folder.mkdir()
    target = folder / ('source' + suffix)
    total = 0
    try:
        with target.open('wb') as dst:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > video.MAX_BYTES:
                    raise ValueError('视频超过 300MB，请先压缩或剪辑。')
                dst.write(chunk)
        if not total:
            raise ValueError('上传的视频为空。')
    except Exception:
        shutil.rmtree(folder)
        raise
    finally:
        await file.close()
    job = store.save('video', {'id': ident, 'url': '', 'title': Path(file.filename).stem[:150], 'status': 'queued', 'stage': '等待处理', 'progress': 0, 'frames': [], 'notes': ''})
    video.POOL.submit(video.process, ident, target)
    return job

@app.get('/api/videos/{ident}')
def get_video(ident: str):
    return require('video', ident)

class VideoEdit(BaseModel):
    notes: str = Field(max_length=12000, default='')
    transcript: str | None = Field(max_length=40000, default=None)
    title: str | None = Field(max_length=200, default=None)

@app.patch('/api/videos/{ident}')
def edit_video(ident: str, body: VideoEdit):
    previous = require('video', ident)
    updated = {**previous, **body.model_dump(exclude_none=True)}
    if body.transcript is not None and (previous.get('report') or {}).get('mode') == 'local':
        updated['report'] = planning.rule_report(body.transcript, previous.get('frames', []), {'duration': previous.get('duration', 0)})
    return store.save('video', updated)

@app.post('/api/videos/{ident}/analyze')
def analyze_video(ident: str):
    item = require('video', ident)
    if item['status'] != 'ready':
        raise ValueError('请等待素材处理完成。')
    item = video.ensure_frames(ident)
    result = ai.analyze(item, video.MEDIA / ident)
    return store.save('video', {**item, 'report': result})

class ScriptRequest(BaseModel):
    profile_id: str | None = Field(default=None, max_length=100)
    target_subject: str = Field(default='', max_length=200)
    source_id: str | None = Field(default=None, max_length=100)
    angle: str = Field(default='菜品诱惑', max_length=100)
    note: str = Field(default='', max_length=4000)
    use_ai: bool = False
    content_mode: Literal['food', 'drama'] = 'food'
    cast_limit: int = Field(default=2, ge=1, le=4)

@app.post('/api/scripts')
def create_script(body: ScriptRequest):
    # New scripts use only this request's subject/brief; saved profiles are opt-in
    # for old API clients and never silently selected from the database.
    profile = require('profile', body.profile_id) if body.profile_id else None
    subject = body.target_subject.strip()
    if profile is None and not subject:
        raise ValueError('请填写这次想拍的菜品或场景，无需创建门店档案。')
    context = profile if profile is not None else {'dish': subject, 'audience': '餐饮官方号的目标观众', 'tone': '像真人现场说话，围绕参考结构推进'}
    source = require('video', body.source_id) if body.source_id else None
    if source and source.get('status') != 'ready':
        raise ValueError('参考视频尚未处理完成。')
    draft = planning.make_script(context, source, body.angle, body.note) if profile is not None else planning.make_subject_script(subject, source, body.angle, body.note)
    draft.update(content_mode=body.content_mode, cast_limit=body.cast_limit, target_subject=subject or context.get('dish',''))
    if profile is None:
        draft.update(profile_id=None, profile_snapshot={}, generation_context={'subject': subject, 'brief': body.note})
    if source and not body.use_ai and profile is None:
        raise ValueError('参考骨架迁移需要启用 AI；普通模板不能代替 Skill 改编。')
    if body.content_mode == 'drama' and not body.use_ai:
        raise ValueError('剧情演绎需启用 AI 生成；请先在设置接入服务并勾选 AI。')
    if body.use_ai:
        if source and source.get('frames'):
            source = video.ensure_frames(source['id'])
        draft = ai.adapt(draft, source, context, body.note)
    return store.save('script', draft)

class Shot(BaseModel):
    time: str = Field(max_length=100)
    visual: str = Field(max_length=3000)
    voice: str = Field(max_length=3000)
    subtitle: str = Field(max_length=2000)
    props: str = Field(max_length=1000)
    beat_index: int | None = Field(default=None, ge=0, le=39)

class Metrics(BaseModel):
    views: int = Field(default=0, ge=0, le=10**12)
    likes: int = Field(default=0, ge=0, le=10**12)
    comments: int = Field(default=0, ge=0, le=10**12)
    favorites: int = Field(default=0, ge=0, le=10**12)
    profile_visits: int = Field(default=0, ge=0, le=10**12)
    orders: int = Field(default=0, ge=0, le=10**12)
    completion: float = Field(default=0, ge=0, le=100)
    avg_watch: float = Field(default=0, ge=0, le=600)
    window: str = Field(default='24小时', max_length=100)

class ScriptEdit(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    status: Literal['draft', 'shooting', 'published'] | None = None
    shots: list[Shot] | None = Field(default=None, max_length=60)
    caption: str | None = Field(default=None, max_length=10000)
    cover: str | None = Field(default=None, max_length=300)
    tags: list[str] | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=10000)
    scheduled_date: str | None = Field(default=None, max_length=10, pattern=r'^(\d{4}-\d{2}-\d{2})?$')
    publish_checks: list[int] | None = Field(default=None, max_length=20)
    metrics: Metrics | None = None

@app.patch('/api/scripts/{ident}')
def edit_script(ident: str, body: ScriptEdit):
    return store.save('script', {**require('script', ident), **body.model_dump(exclude_none=True)})

@app.get('/api/scripts/{ident}/review')
def get_review(ident: str):
    return planning.review(require('script', ident))

@app.get('/api/scripts/{ident}/export')
def export_script(ident: str):
    body = planning.markdown(require('script', ident))
    return Response(body, media_type='text/markdown; charset=utf-8', headers={'Content-Disposition': f'attachment; filename="script-{ident[:8]}.md"'})

@app.delete('/api/{kind}/{ident}')
def delete_record(kind: str, ident: str):
    mapping = {'videos': 'video', 'scripts': 'script', 'profiles': 'profile'}
    if kind not in mapping:
        raise HTTPException(404)
    item = require(mapping[kind], ident)
    if kind == 'videos':
        if item.get('status') in ('queued', 'processing'):
            raise ValueError('处理中的视频暂时无法删除。')
        target = (video.MEDIA / ident).resolve()
        if target.parent != video.MEDIA.resolve():
            raise ValueError('无效路径')
        if target.exists():
            shutil.rmtree(target)
    store.delete(mapping[kind], ident)
    return {'ok': True}

class Settings(BaseModel):
    provider: Literal['none', 'compatible', 'anthropic', 'deepseek'] = 'none'
    base_url: str = Field(default='', max_length=500)
    model: str = Field(default='', max_length=200)
    transcribe: bool = True
    whisper_model: Literal['tiny', 'base', 'small'] = 'base'
    api_key: str | None = Field(default=None, max_length=2000)
    clear_key: bool = False
    thinking: bool = False

@app.put('/api/settings')
def settings(body: Settings):
    cfg = body.model_dump(exclude={'api_key', 'clear_key'})
    if cfg['provider'] == 'deepseek':
        cfg['base_url'] = 'https://api.deepseek.com'
        cfg['model'] = cfg['model'].strip() or 'deepseek-flash'
    if cfg['provider'] != 'none':
        parsed = urlparse(cfg['base_url'])
        if parsed.scheme not in ('https', 'http') or not parsed.netloc:
            raise ValueError('请输入有效的 AI 基础地址，例如 https://服务地址/v1。')
        if not cfg['model'].strip():
            raise ValueError('请输入该服务商支持的模型名称。')
    if body.clear_key:
        store.save_key('')
    elif body.api_key:
        store.save_key(body.api_key.strip())
    store.set_config(cfg)
    return public_settings()

@app.post('/api/settings/test')
def test_ai():
    result = ai.call('只返回 JSON：{"ok":true,"message":"连接成功"}。')
    return {'ok': True, 'message': '文本连接成功。图片支持将在视频分析时检查。'}

@app.post('/api/cookies')
async def cookies(file: UploadFile = File(...)):
    raw = await file.read(1024 * 1024 + 1)
    await file.close()
    if len(raw) > 1024 * 1024 or b'Netscape HTTP Cookie File' not in raw[:300]:
        raise ValueError('请导入 1MB 以内的 Netscape cookies.txt 文件。')
    text = raw.decode('utf-8-sig')
    # Keep only domains needed by this app; do not retain unrelated session cookies.
    lines = ['# Netscape HTTP Cookie File']
    for line in text.splitlines():
        if not line or (line.startswith('#') and not line.startswith('#HttpOnly_')):
            continue
        parts = line.split('\t')
        host = parts[0].replace('#HttpOnly_', '').lstrip('.').lower()
        if len(parts) == 7 and any(host == d or host.endswith('.' + d) for d in video.ALLOWED):
            lines.append(line)
    if len(lines) == 1:
        raise ValueError('文件中没有支持的视频平台 Cookie。')
    (store.DATA / 'cookies.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    return {'ok': True}

@app.delete('/api/cookies')
def clear_cookies():
    (store.DATA / 'cookies.txt').unlink(missing_ok=True)
    return {'ok': True}

@app.get('/api/backup')
def backup():
    value = {'version': 2, 'created_at': store.now(), 'profiles': store.listing('profile'), 'scripts': store.listing('script'), 'videos': store.listing('video'), 'benchmarks': store.listing('benchmark'), 'campaigns': store.listing('campaign')}
    return Response(json.dumps(value, ensure_ascii=False, indent=2), media_type='application/json', headers={'Content-Disposition': 'attachment; filename="huanhuan-backup.json"'})

@app.get('/media/{ident}/{filename:path}')
def media(ident: str, filename: str):
    if not re.fullmatch(r'[0-9a-f]{32}', ident):
        raise HTTPException(404)
    folder = (video.MEDIA / ident).resolve()
    path = (folder / filename).resolve()
    if not path.is_relative_to(folder) or path.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v') or not path.is_file():
        raise HTTPException(404)
    return FileResponse(path)

app.include_router(integrations_router)
app.include_router(maintenance.router)
app.mount('/', StaticFiles(directory=store.ROOT / 'static', html=True), name='frontend')
