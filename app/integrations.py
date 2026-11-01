import json
import re
import uuid
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from . import store, video, planning
from . import integration_runtime as runtime

router = APIRouter(prefix='/api/integrations')

def require(kind, ident):
    result = store.get(kind, ident)
    if not result:
        raise HTTPException(404, '未找到该记录')
    return result

@router.get('')
def overview():
    return {'settings': runtime.public_settings(), 'benchmarks': store.listing('benchmark'), 'campaigns': store.listing('campaign')}

class IntegrationSettings(BaseModel):
    link_provider: Literal['local', 'douyin_mcp', 'analyzer'] = 'local'
    frame_engine: Literal['watch', 'viralvision'] = 'watch'
    speech_provider: Literal['local', 'siliconflow'] = 'local'
    alapi_token: str | None = Field(default=None, max_length=2000)
    siliconflow_key: str | None = Field(default=None, max_length=2000)
    clear_alapi: bool = False
    clear_siliconflow: bool = False

@router.put('/settings')
def settings(body: IntegrationSettings):
    # Validate before persisting either configuration or new secrets.
    has_alapi = not body.clear_alapi and (bool((body.alapi_token or '').strip()) or (store.DATA / 'alapi.dpapi').exists())
    has_silicon = not body.clear_siliconflow and (bool((body.siliconflow_key or '').strip()) or (store.DATA / 'siliconflow.dpapi').exists())
    if body.link_provider == 'douyin_mcp' and not has_alapi:
        raise ValueError('选择 ALAPI 解析前，请填写 ALAPI Token。')
    if body.speech_provider == 'siliconflow' and not has_silicon:
        raise ValueError('选择云端转写前，请填写硅基流动 API Key。')
    for name, value, clear in [('alapi', body.alapi_token, body.clear_alapi), ('siliconflow', body.siliconflow_key, body.clear_siliconflow)]:
        if clear:
            store.integration_secret(name, '')
        elif value:
            store.integration_secret(name, value.strip())
    store.set_integration_config(body.model_dump(include={'link_provider', 'frame_engine', 'speech_provider'}))
    return runtime.public_settings()

@router.post('/{slug}/check')
def check(slug: str):
    if slug == 'douyin-analyzer':
        result = runtime.source_call([__import__('sys').executable, runtime.SOURCES / slug / 'douyin-analyzer' / 'scripts' / 'douyin_scraper.py', 'resolve', '6982497745948921092'])
        handshake = runtime.mcp_request(slug)
        return {**handshake, 'message': f'本地脚本自检与 MCP 握手通过，提供 {len(handshake["tools"])} 个工具；外部平台是否返回数据仍需实际读取验证。'}
    if slug not in ('douyin-mcp', 'viralvision-mcp', 'promo-workflow-mcp'):
        raise HTTPException(404)
    return runtime.mcp_request(slug)

class Capture(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    label: str = Field(default='', max_length=100)

def douyin_input(text):
    text = text.strip()
    if re.fullmatch(r'\d{10,25}', text):
        return text
    url = video.parse_link(text)
    from urllib.parse import urlparse
    host = urlparse(url).hostname or ''
    if not any(host == h or host.endswith('.' + h) for h in ('douyin.com', 'iesdouyin.com')):
        raise ValueError('此入口只接受抖音公开视频链接或视频 ID。')
    return url

@router.post('/benchmarks')
def capture(body: Capture):
    source = douyin_input(body.text)
    info = runtime.capture_info(source)
    ident = str(info.get('aweme_id') or '')
    if not re.fullmatch(r'\d{10,25}', ident):
        raise ValueError('上游未返回有效视频 ID，没有保存数据。')
    stats = info.get('stats') or {}
    for key in ('digg_count', 'comment_count', 'share_count', 'collect_count'):
        value = stats.get(key)
        stats[key] = value if isinstance(value, (int, float)) and value >= 0 else None
    # Share pages do not supply trustworthy play count; never turn absence into zero views.
    stats['play_count'] = None
    existing = next((x for x in store.listing('benchmark') if x.get('aweme_id') == ident), None)
    return store.save('benchmark', {**(existing or {}), 'aweme_id': ident, 'url': 'https://www.douyin.com/video/' + ident, 'title': info.get('title') or '未提供标题', 'author': info.get('author') or {}, 'stats': stats, 'ratios': runtime.ratios(stats), 'published_at': info.get('create_time'), 'duration_ms': info.get('duration_ms'), 'hashtags': info.get('hashtags') or [], 'music': info.get('music'), 'media_url': info.get('no_watermark_play_url'), 'label': body.label or (existing or {}).get('label', ''), 'notes': (existing or {}).get('notes', ''), 'captured_at': store.now(), 'source': 'bettermen/douyin-analyzer'})

class BenchmarkEdit(BaseModel):
    label: str = Field(default='', max_length=100)
    notes: str = Field(default='', max_length=8000)

@router.patch('/benchmarks/{ident}')
def edit_benchmark(ident: str, body: BenchmarkEdit):
    return store.save('benchmark', {**require('benchmark', ident), **body.model_dump()})

@router.delete('/benchmarks/{ident}')
def delete_benchmark(ident: str):
    require('benchmark', ident)
    store.delete('benchmark', ident)
    return {'ok': True}

@router.post('/benchmarks/{ident}/video')
def benchmark_video(ident: str):
    item = require('benchmark', ident)
    if not item.get('media_url'):
        raise ValueError('该次公开数据未包含可播放地址。可在拆解工作室尝试原链接或上传视频。')
    if sum(v.get('status') in ('queued', 'processing') for v in store.listing('video')) >= 5:
        raise HTTPException(429, '视频任务已排满，请稍后再试。')
    job = store.save('video', {'title': item['title'], 'url': item['url'], 'status': 'queued', 'stage': '等待从公开数据读取视频', 'progress': 0, 'frames': [], 'notes': item.get('notes', ''), 'source_benchmark_id': item['id']})
    video.POOL.submit(video.process, job['id'])
    return job

@router.post('/douyin/parse')
def parse_paid(body: Capture):
    url = douyin_input(body.text)
    if url.isdigit():
        url = 'https://www.douyin.com/video/' + url
    return runtime.douyin_parse(url)

class CreateCampaign(BaseModel):
    profile_id: str = Field(max_length=100)
    title: str = Field(min_length=1, max_length=100)
    goal: str = Field(min_length=1, max_length=2000)
    script_id: str | None = Field(default=None, max_length=100)
    source_url: str = Field(min_length=1, max_length=2000)

@router.post('/campaigns')
def create_campaign(body: CreateCampaign):
    profile = require('profile', body.profile_id)
    script = require('script', body.script_id) if body.script_id else None
    if script and script.get('profile_id') != profile['id']:
        raise ValueError('参考脚本与所选门店不一致。')
    from urllib.parse import urlparse
    parsed = urlparse(body.source_url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('请提供这次宣传可使用的真实参考资料链接。')
    support = profile.get('advantage') or profile.get('dish')
    if not support:
        raise ValueError('请先在门店档案补充主推菜或可实拍的真实卖点。')
    ident = uuid.uuid4().hex
    root = store.DATA / 'promo' / 'projects' / ident
    root.mkdir(parents=True)
    context = {'productProfile': {'productName': profile['name'], 'positioning': profile.get('category') or '餐饮门店', 'capabilities': [x for x in (profile.get('dish'), profile.get('advantage')) if x], 'activeCampaignLines': [body.goal, support], 'targetAudience': profile.get('audience') or '门店周边顾客'}, 'restaurantProfile': profile, 'topicSources': [{'id': 'user-reference', 'kind': 'html', 'url': body.source_url, 'label': '用户提供的本次参考资料'}]}
    if script:
        context['userProvidedDraft'] = planning.markdown(script)
    snapshot = runtime.mcp_request('promo-workflow-mcp', 'promo_commit', {'kind': 'create_workflow', 'carrier': 'video', 'summary': body.goal, 'displayName': body.title, 'rootDirectory': str(root.resolve()), 'context': context, 'idempotencyKey': 'create-' + ident})
    if not snapshot.get('workflowId'):
        raise ValueError('Promo 未返回有效项目，没有保存成功状态。')
    return store.save('campaign', {'id': ident, 'title': body.title, 'goal': body.goal, 'profile_id': body.profile_id, 'script_id': body.script_id, 'workflow_id': snapshot['workflowId'], 'snapshot': snapshot})

@router.get('/campaigns/{ident}')
def refresh_campaign(ident: str):
    item = require('campaign', ident)
    snapshot = runtime.mcp_request('promo-workflow-mcp', 'promo_get', {'workflowId': item['workflow_id']})
    return store.save('campaign', {**item, 'snapshot': snapshot})

@router.get('/campaigns/{ident}/guide')
def workspace_guide(ident: str):
    item = require('campaign', ident)
    file = Path((item['snapshot'].get('workspace') or {}).get('guidePath', '')).resolve()
    if not file.is_relative_to((store.DATA / 'promo').resolve()) or not file.is_file() or file.suffix.lower() != '.md':
        raise ValueError('项目工作区约定暂不可读，请先刷新项目。')
    return {'text': file.read_text('utf-8')}

class CampaignAction(BaseModel):
    action: Literal['confirm_workspace', 'run', 'note']
    expected_revision: int = Field(ge=1)
    idempotency_key: str = Field(min_length=1, max_length=128)
    note: str = Field(default='', max_length=4000)
    workspace_read: bool = False

@router.post('/campaigns/{ident}/action')
def campaign_action(ident: str, body: CampaignAction):
    item = require('campaign', ident)
    current = runtime.mcp_request('promo-workflow-mcp', 'promo_get', {'workflowId': item['workflow_id']})
    if current.get('revision') != body.expected_revision:
        raise HTTPException(409, '项目已更新，请刷新后再操作。')
    common = {'workflowId': item['workflow_id'], 'expectedRevision': body.expected_revision, 'idempotencyKey': body.idempotency_key}
    if body.action == 'confirm_workspace':
        if not body.workspace_read or (current.get('pendingAction') or {}).get('id') != 'confirm_workspace':
            raise ValueError('请先阅读当前项目的目录约定，并明确勾选确认。')
        result = runtime.mcp_request('promo-workflow-mcp', 'promo_commit', {**common, 'kind': 'confirm_workspace', 'summary': '用户在欢欢工作台阅读项目约定并明确确认', 'context': {'confirmed': True}})
    elif body.action == 'run':
        if (current.get('pendingAction') or {}).get('kind') != 'run':
            raise ValueError('当前节点需要内容或人工决定，不能自动跳过。')
        result = runtime.mcp_request('promo-workflow-mcp', 'promo_run', common)
    else:
        if not body.note.strip():
            raise ValueError('请填写项目备注。')
        result = runtime.mcp_request('promo-workflow-mcp', 'promo_commit', {**common, 'kind': 'save_note', 'summary': body.note, 'context': {'note': body.note}})
    return store.save('campaign', {**item, 'snapshot': result})

@router.post('/promo/review')
def open_review():
    return {'url': runtime.launch_review()}
