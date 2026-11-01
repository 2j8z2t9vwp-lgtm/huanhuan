#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
douyin_scraper.py — 抖音视频公开数据抓取 CLI

用法：
  python3 douyin_scraper.py info     <分享口令|短链|长链|视频ID>
  python3 douyin_scraper.py resolve  <分享口令|短链|长链|视频ID>
  python3 douyin_scraper.py comments <分享口令|短链|长链|视频ID> [--count 20] [--cookie "…"]

依赖：httpx（pip install httpx）
输出：JSON 到 stdout；失败时输出 {"error": "...", "hint": "..."}，exit code 1。

数据路径：iesdouyin.com 分享页 SSR 内嵌数据（RENDER_DATA / window._ROUTER_DATA），
无需签名与登录。合规要求见 SKILL.md。
"""

import argparse
import asyncio
import json
import re
import sys
import urllib.parse
from typing import Any, Optional

import httpx

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
# 链接解析
# ---------------------------------------------------------------------------

def _extract_aweme_id_from_url(url: str) -> Optional[str]:
    for p in (r"/video/(\d+)", r"/share/video/(\d+)", r"item_ids=(\d+)", r"aweme_id=(\d+)"):
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


async def resolve_aweme_id(text: str) -> dict:
    """从分享口令 / 短链 / 长链 / 纯 ID 中解析视频 ID。"""
    text = text.strip()
    if re.fullmatch(r"\d{10,25}", text):
        return {"aweme_id": text, "resolved_url": None}

    url_match = re.search(r"https?://[^\s\"'，。]+", text)
    if not url_match:
        raise ValueError("输入中没有链接或视频 ID")
    url = url_match.group(0)

    if "v.douyin.com" in url or "douyin.com/s/" in url:
        async with httpx.AsyncClient(
            headers=COMMON_HEADERS, follow_redirects=True, timeout=DEFAULT_TIMEOUT
        ) as client:
            resp = await client.get(url)
            aweme_id = _extract_aweme_id_from_url(str(resp.url)) or \
                       _extract_aweme_id_from_url(resp.text)
            if not aweme_id:
                raise ValueError(f"短链跳转后未找到视频 ID，最终地址：{resp.url}")
            return {"aweme_id": aweme_id, "resolved_url": str(resp.url)}

    aweme_id = _extract_aweme_id_from_url(url)
    if not aweme_id:
        raise ValueError(f"无法从链接中提取视频 ID：{url}")
    return {"aweme_id": aweme_id, "resolved_url": url}


# ---------------------------------------------------------------------------
# 分享页数据解析
# ---------------------------------------------------------------------------

def _find_key_recursive(obj: Any, key: str) -> Optional[Any]:
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
    return isinstance(d, dict) and "aweme_id" in d and "statistics" in d and "author" in d


def _find_aweme_detail(obj: Any) -> Optional[dict]:
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
    m = re.search(r'<script[^>]*id=["\']RENDER_DATA["\'][^>]*>(.*?)</script>', html, re.DOTALL)
    if m:
        return json.loads(urllib.parse.unquote(m.group(1)))
    m = re.search(r"window\._ROUTER_DATA\s*=\s*(\{.*?\})\s*</script>", html, re.DOTALL)
    if m:
        return json.loads(m.group(1))
    raise ValueError("分享页中未找到内嵌数据（RENDER_DATA / _ROUTER_DATA），页面结构可能已变更")


def format_video_info(detail: dict) -> dict:
    stats = detail.get("statistics") or {}
    author = detail.get("author") or {}
    video = detail.get("video") or {}
    music = detail.get("music") or {}

    url_list = (video.get("play_addr") or {}).get("url_list") or []
    play_url = url_list[0] if url_list else None
    if play_url and "playwm" in play_url:
        play_url = play_url.replace("playwm", "play")

    create_time_str = None
    if detail.get("create_time"):
        import datetime
        create_time_str = datetime.datetime.fromtimestamp(
            int(detail["create_time"])).strftime("%Y-%m-%d %H:%M:%S")

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
            "play_count": stats.get("play_count"),  # 分享页通常为 0/None
        },
        "hashtags": [t.get("hashtag_name") for t in (detail.get("text_extra") or [])
                     if t.get("hashtag_name")],
        "music": {"title": music.get("title"), "author": music.get("author")} if music else None,
        "no_watermark_play_url": play_url,
        "cover": ((video.get("cover") or {}).get("url_list") or [None])[0],
    }


async def fetch_video_info(text_or_id: str) -> dict:
    resolved = await resolve_aweme_id(text_or_id)
    url = f"https://www.iesdouyin.com/share/video/{resolved['aweme_id']}/"
    async with httpx.AsyncClient(
        headers=COMMON_HEADERS, follow_redirects=True, timeout=DEFAULT_TIMEOUT
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = _parse_share_page(resp.text)
    detail = _find_aweme_detail(data)
    if detail is None:
        raise ValueError("未获取到视频详情：视频可能已删除、设为私密或被平台过滤")
    return format_video_info(detail)


async def fetch_comments(text_or_id: str, count: int = 20, cookie: str = "") -> dict:
    resolved = await resolve_aweme_id(text_or_id)
    aweme_id = resolved["aweme_id"]
    count = max(1, min(count, 50))

    headers = dict(COMMON_HEADERS)
    headers["User-Agent"] = PC_UA
    if cookie:
        headers["Cookie"] = cookie

    comments = []
    cursor = 0
    async with httpx.AsyncClient(
        headers=headers, follow_redirects=True, timeout=DEFAULT_TIMEOUT
    ) as client:
        while len(comments) < count:
            api = ("https://www.iesdouyin.com/aweme/v1/web/comment/list/"
                   f"?aweme_id={aweme_id}&cursor={cursor}&count=20")
            resp = await client.get(api)
            resp.raise_for_status()
            data = resp.json()
            batch = data.get("comments") or []
            for c in batch:
                comments.append({
                    "user": (c.get("user") or {}).get("nickname"),
                    "text": c.get("text"),
                    "digg_count": c.get("digg_count"),
                    "reply_total": c.get("reply_comment_total"),
                })
            if not data.get("has_more") or not batch:
                break
            cursor = data.get("cursor", cursor + 20)

    return {"aweme_id": aweme_id, "fetched": len(comments[:count]), "comments": comments[:count]}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _emit(payload: dict, exit_code: int = 0):
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    sys.exit(exit_code)


def main():
    parser = argparse.ArgumentParser(description="抖音视频公开数据抓取")
    sub = parser.add_subparsers(dest="cmd", required=True)

    for name in ("info", "resolve"):
        p = sub.add_parser(name)
        p.add_argument("text", help="分享口令 / 短链 / 长链 / 视频ID")

    p = sub.add_parser("comments")
    p.add_argument("text", help="分享口令 / 短链 / 长链 / 视频ID")
    p.add_argument("--count", type=int, default=20)
    p.add_argument("--cookie", default="", help="浏览器登录态 Cookie（可选）")

    args = parser.parse_args()

    try:
        if args.cmd == "resolve":
            result = asyncio.run(resolve_aweme_id(args.text))
        elif args.cmd == "info":
            result = asyncio.run(fetch_video_info(args.text))
        else:
            result = asyncio.run(fetch_comments(args.text, args.count, args.cookie))
        _emit(result)
    except Exception as e:
        hint = None
        if "403" in str(e):
            hint = "接口被风控：评论接口需传入 --cookie；视频详情可稍后重试"
        _emit({"error": str(e), **({"hint": hint} if hint else {})}, exit_code=1)


if __name__ == "__main__":
    main()
