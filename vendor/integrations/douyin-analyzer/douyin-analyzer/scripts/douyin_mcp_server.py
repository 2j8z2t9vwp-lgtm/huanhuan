# -*- coding: utf-8 -*-
"""
Douyin MCP Server
=================
一个用于抓取抖音视频公开数据的 MCP 工具集。

提供的工具：
  1. resolve_share_link   解析分享口令 / 短链 / 长链，提取视频 ID
  2. get_video_info       获取视频详情（标题、作者、点赞/评论/转发/收藏数、发布时间、无水印播放地址等）
  3. get_video_comments   获取视频评论（可选，部分场景需要 Cookie）

合规提示：请仅抓取公开数据，遵守抖音 robots 协议与平台条款，
控制请求频率，勿用于商业批量采集或侵犯用户隐私的用途。
"""

import json
import re
import urllib.parse
from typing import Any, Optional

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("douyin-scraper")

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
)
PC_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

COMMON_HEADERS = {
    "User-Agent": MOBILE_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Referer": "https://www.iesdouyin.com/",
}

DEFAULT_TIMEOUT = 15.0

# ---------------------------------------------------------------------------
# 内部工具函数
# ---------------------------------------------------------------------------


def _extract_aweme_id_from_url(url: str) -> Optional[str]:
    """从各种形态的抖音 URL 中提取视频 ID（纯数字）。"""
    patterns = [
        r"/video/(\d+)",          # www.douyin.com/video/xxxx
        r"/share/video/(\d+)",    # www.iesdouyin.com/share/video/xxxx
        r"item_ids=(\d+)",        # 部分 API 回跳
        r"aweme_id=(\d+)",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


async def _resolve_to_aweme_id(text: str) -> dict:
    """
    接受三种输入：
      - 纯数字视频 ID
      - 分享口令（含 v.douyin.com 短链的整段文字）
      - 各种长链接
    返回 {"aweme_id": ..., "resolved_url": ...}
    """
    text = text.strip()

    # 1. 纯数字 ID
    if re.fullmatch(r"\d{10,25}", text):
        return {"aweme_id": text, "resolved_url": None}

    # 2. 从文本中提取 URL
    url_match = re.search(r"https?://[^\s\"'，。]+", text)
    if not url_match:
        raise ValueError("未能在输入中找到链接或视频 ID，请检查输入内容。")
    url = url_match.group(0)

    # 3. 短链需要跟随 302 跳转
    if "v.douyin.com" in url or "douyin.com/s/" in url:
        async with httpx.AsyncClient(
            headers=COMMON_HEADERS, follow_redirects=True, timeout=DEFAULT_TIMEOUT
        ) as client:
            resp = await client.get(url)
            final_url = str(resp.url)
            aweme_id = _extract_aweme_id_from_url(final_url)
            # 兜底：跳转后的 HTML 里也可能藏着 ID
            if not aweme_id:
                aweme_id = _extract_aweme_id_from_url(resp.text)
            if not aweme_id:
                raise ValueError(f"短链跳转后仍未找到视频 ID，最终地址：{final_url}")
            return {"aweme_id": aweme_id, "resolved_url": final_url}

    # 4. 长链直接提取
    aweme_id = _extract_aweme_id_from_url(url)
    if not aweme_id:
        raise ValueError(f"无法从链接中提取视频 ID：{url}")
    return {"aweme_id": aweme_id, "resolved_url": url}


def _find_key_recursive(obj: Any, key: str) -> Optional[Any]:
    """在嵌套 dict/list 中递归查找指定 key 的第一个值。"""
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            found = _find_key_recursive(v, key)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = _find_key_recursive(item, key)
            if found is not None:
                return found
    return None


def _looks_like_aweme_detail(d: Any) -> bool:
    return (
        isinstance(d, dict)
        and "aweme_id" in d
        and "statistics" in d
        and "author" in d
    )


def _find_aweme_detail(obj: Any) -> Optional[dict]:
    """优先找名为 aweme_detail 的节点，否则递归找结构符合的对象。"""
    direct = _find_key_recursive(obj, "aweme_detail")
    if _looks_like_aweme_detail(direct):
        return direct
    if isinstance(obj, dict):
        if _looks_like_aweme_detail(obj):
            return obj
        for v in obj.values():
            found = _find_aweme_detail(v)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = _find_aweme_detail(item)
            if found is not None:
                return found
    return None


def _parse_share_page(html: str) -> dict:
    """从 iesdouyin 分享页 HTML 中解析内嵌 JSON 数据。"""
    # 形式一：<script id="RENDER_DATA" type="application/json">...</script>
    m = re.search(
        r'<script[^>]*id=["\']RENDER_DATA["\'][^>]*>(.*?)</script>',
        html, re.DOTALL,
    )
    if m:
        payload = urllib.parse.unquote(m.group(1))
        return json.loads(payload)

    # 形式二：window._ROUTER_DATA = {...}
    m = re.search(r"window\._ROUTER_DATA\s*=\s*(\{.*?\})\s*</script>", html, re.DOTALL)
    if m:
        return json.loads(m.group(1))

    raise ValueError("分享页中未找到内嵌数据（RENDER_DATA / _ROUTER_DATA），页面结构可能已变更。")


def _format_video_info(detail: dict) -> dict:
    """把原始 aweme_detail 整理成清爽的字段。"""
    stats = detail.get("statistics", {}) or {}
    author = detail.get("author", {}) or {}
    video = detail.get("video", {}) or {}
    music = detail.get("music", {}) or {}

    # 无水印播放地址：play_addr 的第一个 url
    play_addr = video.get("play_addr", {}) or {}
    url_list = play_addr.get("url_list", []) or []
    play_url = url_list[0] if url_list else None
    if play_url and "playwm" in play_url:
        play_url = play_url.replace("playwm", "play")

    create_time = detail.get("create_time")
    create_time_str = None
    if create_time:
        import datetime
        create_time_str = datetime.datetime.fromtimestamp(
            int(create_time)
        ).strftime("%Y-%m-%d %H:%M:%S")

    return {
        "aweme_id": detail.get("aweme_id"),
        "title": detail.get("desc"),
        "create_time": create_time_str,
        "duration_ms": video.get("duration"),
        "author": {
            "nickname": author.get("nickname"),
            "unique_id": author.get("unique_id"),
            "sec_uid": author.get("sec_uid"),
            "signature": author.get("signature"),
        },
        "stats": {
            "digg_count": stats.get("digg_count"),
            "comment_count": stats.get("comment_count"),
            "share_count": stats.get("share_count"),
            "collect_count": stats.get("collect_count"),
            "play_count": stats.get("play_count"),  # 部分接口不返回播放量
        },
        "hashtags": [
            t.get("hashtag_name")
            for t in (detail.get("text_extra") or [])
            if t.get("hashtag_name")
        ],
        "music": {
            "title": music.get("title"),
            "author": music.get("author"),
        } if music else None,
        "no_watermark_play_url": play_url,
        "cover": (video.get("cover", {}) or {}).get("url_list", [None])[0],
    }


async def _fetch_aweme_detail(aweme_id: str) -> dict:
    """通过 iesdouyin 分享页获取视频详情（无需签名，最稳定的路径）。"""
    url = f"https://www.iesdouyin.com/share/video/{aweme_id}/"
    async with httpx.AsyncClient(
        headers=COMMON_HEADERS, follow_redirects=True, timeout=DEFAULT_TIMEOUT
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = _parse_share_page(resp.text)

    detail = _find_aweme_detail(data)
    if detail is None:
        raise ValueError(
            "未能获取视频详情：视频可能已删除、设为私密、被平台过滤，"
            "或分享页结构已变更。"
        )
    return detail


# ---------------------------------------------------------------------------
# MCP 工具定义
# ---------------------------------------------------------------------------


@mcp.tool()
async def resolve_share_link(text: str) -> str:
    """解析抖音分享口令、短链或长链，返回视频 ID。

    参数:
        text: 用户从抖音 App 复制的整段分享文字（如 "7.94 复制打开抖音... https://v.douyin.com/xxxx/ ..."）、
              短链 / 长链，或纯数字视频 ID。
    """
    try:
        result = await _resolve_to_aweme_id(text)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@mcp.tool()
async def get_video_info(text_or_id: str) -> str:
    """获取抖音视频详情：标题、作者、点赞/评论/转发/收藏数、发布时间、话题、BGM、无水印播放地址。

    参数:
        text_or_id: 分享口令 / 短链 / 长链 / 视频 ID，均可直接传入。
    """
    try:
        resolved = await _resolve_to_aweme_id(text_or_id)
        detail = await _fetch_aweme_detail(resolved["aweme_id"])
        info = _format_video_info(detail)
        return json.dumps(info, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@mcp.tool()
async def get_video_comments(text_or_id: str, count: int = 20, cookie: str = "") -> str:
    """获取抖音视频评论列表（公开接口，可能受风控限制；失败时可尝试传入 Cookie）。

    参数:
        text_or_id: 分享口令 / 短链 / 长链 / 视频 ID。
        count: 期望获取的评论数量（默认 20，最大 50）。
        cookie: 可选。从浏览器登录态复制的 Cookie 字符串，用于绕过风控。
    """
    try:
        resolved = await _resolve_to_aweme_id(text_or_id)
        aweme_id = resolved["aweme_id"]
        count = max(1, min(count, 50))

        headers = dict(COMMON_HEADERS)
        headers["User-Agent"] = PC_UA
        if cookie:
            headers["Cookie"] = cookie

        comments: list[dict] = []
        cursor = 0
        async with httpx.AsyncClient(
            headers=headers, follow_redirects=True, timeout=DEFAULT_TIMEOUT
        ) as client:
            while len(comments) < count:
                api = (
                    "https://www.iesdouyin.com/aweme/v1/web/comment/list/"
                    f"?aweme_id={aweme_id}&cursor={cursor}&count=20"
                )
                resp = await client.get(api)
                resp.raise_for_status()
                data = resp.json()
                batch = data.get("comments") or []
                for c in batch:
                    user = c.get("user", {}) or {}
                    comments.append({
                        "user": user.get("nickname"),
                        "text": c.get("text"),
                        "digg_count": c.get("digg_count"),
                        "reply_total": c.get("reply_comment_total"),
                    })
                if not data.get("has_more") or not batch:
                    break
                cursor = data.get("cursor", cursor + 20)

        return json.dumps(
            {
                "aweme_id": aweme_id,
                "fetched": len(comments[:count]),
                "comments": comments[:count],
            },
            ensure_ascii=False,
            indent=2,
        )
    except Exception as e:
        return json.dumps(
            {
                "error": str(e),
                "hint": "评论接口风控较严，可尝试传入浏览器登录后的 Cookie 重试。",
            },
            ensure_ascii=False,
        )


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run()  # 默认 stdio 传输，适配 Claude Desktop / Cursor 等客户端
