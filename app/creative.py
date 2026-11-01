"""Pinned skill instructions and validated reference-to-restaurant mapping."""
from typing import Literal
from pydantic import BaseModel, Field, ValidationError
from . import store

SKILL = store.ROOT / 'vendor' / 'viral-reverse-engineering'

def instructions():
    files = ['SKILL.md', 'references/sourcing-the-content.md',
             'references/deconstruction-framework.md',
             'references/replicability-and-application.md']
    try:
        return '\n\n'.join((SKILL / f).read_text('utf-8') for f in files)
    except OSError:
        raise ValueError('骨架拆解技能文件缺失，请恢复 vendor/viral-reverse-engineering。') from None

class Beat(BaseModel):
    start: float = Field(ge=0, le=600)
    end: float = Field(gt=0, le=600)
    source: str = Field(min_length=1, max_length=2000)
    function: str = Field(min_length=1, max_length=1000)
    evidence: str = Field(min_length=1, max_length=2000)
    target: str = Field(min_length=1, max_length=2000)
    strategy: Literal['preserve', 'adapt', 'omit'] = 'adapt'

class Blueprint(BaseModel):
    mechanism: str = Field(min_length=1, max_length=2000)
    counterfactual: str = Field(min_length=1, max_length=2000)
    limits: list[str] = Field(min_length=1, max_length=20)
    beats: list[Beat] = Field(min_length=1, max_length=40)

def validate_blueprint(raw, duration):
    try:
        value = Blueprint.model_validate(raw)
    except ValidationError:
        raise ValueError('骨架分析结果不完整，未生成脚本，请重试。') from None
    previous = 0
    for beat in value.beats:
        if beat.end <= beat.start or beat.start < previous or (duration and beat.end > float(duration) + .5):
            raise ValueError('参考骨架时间轴无效或超出原片时长，未生成脚本。')
        previous = beat.end
    return value.model_dump()

class Character(BaseModel):
    role: str = Field(min_length=1, max_length=100)
    objective: str = Field(min_length=1, max_length=500)

class Performance(BaseModel):
    premise: str = Field(min_length=1, max_length=1500)
    cast: list[Character] = Field(min_length=1, max_length=4)
    tension: str = Field(min_length=1, max_length=1000)
    turn: str = Field(min_length=1, max_length=1000)
    ending: str = Field(min_length=1, max_length=1000)

def validate_performance(raw, cast_limit):
    try:
        value = Performance.model_validate(raw)
    except ValidationError:
        raise ValueError('剧情缺少角色、情境或收尾，未保存不完整剧本，请重试。') from None
    if len(value.cast) > cast_limit:
        raise ValueError('剧情角色超过可出镜人数，请重新生成。')
    return {**value.model_dump(), 'label': '剧情演绎'}
