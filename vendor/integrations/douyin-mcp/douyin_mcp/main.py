#!/usr/bin/env python3
"""
Douyin MCP Server
Provides tools for parsing Douyin videos, extracting text, and downloading videos
"""
import os
import re
import json
import tempfile
import shutil
from pathlib import Path
from typing import Optional
from datetime import datetime
import requests
import ffmpeg
from dotenv import load_dotenv
from mcp.server import Server
from mcp.types import (
    Tool,
    TextContent,
    ImageContent,
    EmbeddedResource,
)
# Load environment variables
load_dotenv()
# Configuration
ALAPI_TOKEN = os.getenv("ALAPI_TOKEN", "")
SILICONFLOW_API_KEY = os.getenv("SILICONFLOW_API_KEY", "")
DEFAULT_API_BASE_URL = "https://api.siliconflow.cn/v1/audio/transcriptions"
DEFAULT_MODEL = "FunAudioLLM/SenseVoiceSmall"
# 请求头
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/121.0.2277.107 Version/17.0 Mobile/15E148 Safari/604.1'
}
server = Server("douyin-mcp-server")
class DouyinProcessor:
    """抖音视频处理器"""
    def __init__(self, alapi_token: str = "", siliconflow_api_key: str = ""):
        self.alapi_token = alapi_token or ALAPI_TOKEN
        self.siliconflow_api_key = siliconflow_api_key or SILICONFLOW_API_KEY
        self.temp_dir = Path(tempfile.mkdtemp())
    def __del__(self):
        """清理临时目录"""
        if hasattr(self, 'temp_dir') and self.temp_dir.exists():
            shutil.rmtree(self.temp_dir, ignore_errors=True)
    def parse_share_url(self, share_text: str) -> dict:
        """从分享文本中提取无水印视频链接"""
        # 提取分享链接
        urls = re.findall(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', share_text)
        if not urls:
            raise ValueError("未找到有效的分享链接")
        share_url = urls[0]
        # 使用ALAPI抖音解析接口
        api_url = "https://v3.alapi.cn/api/video/url"
        headers = HEADERS.copy()
        headers['Content-Type'] = 'application/json'
        payload = {
            "token": self.alapi_token,
            "url": share_url
        }
        response = requests.post(api_url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        if data.get('code') != 200:
            raise ValueError(f"解析失败: {data.get('message', data.get('msg', '未知错误'))}")
        video_data = data['data']
        # 从视频链接中提取video_id
        video_url = video_data.get('video_url', '')
        if not video_url:
            raise ValueError("无法获取视频下载链接")
        # 提取video_id
        if 'video/' in share_url:
            video_id = share_url.split("video/")[1].split("?")[0].strip("/")
        else:
            video_id = share_url.split("?")[0].strip("/").split("/")[-1]
        # 获取标题
        desc = video_data.get('title', '').strip() or f"douyin_{video_id}"
        # 替换文件名中的非法字符
        desc = re.sub(r'[\\/:*?"<>|]', '_', desc)
        return {
            "url": video_url,
            "title": desc,
            "video_id": video_id,
            "cover_url": video_data.get('cover_url', '')
        }
    def download_video(self, video_info: dict, output_dir: Optional[Path] = None, show_progress: bool = False) -> Path:
        """下载视频"""
        if output_dir is None:
            output_dir = self.temp_dir
        else:
            output_dir = Path(output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{video_info['video_id']}.mp4"
        filepath = output_dir / filename
        response = requests.get(video_info['url'], headers=HEADERS, stream=True)
        response.raise_for_status()
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        return filepath
    def extract_audio(self, video_path: Path) -> Path:
        """从视频文件中提取音频"""
        audio_path = video_path.with_suffix('.mp3')
        try:
            (
                ffmpeg
                .input(str(video_path))
                .output(str(audio_path), acodec='libmp3lame', q=0)
                .run(capture_stdout=True, capture_stderr=True, overwrite_output=True)
            )
            return audio_path
        except Exception as e:
            raise Exception(f"提取音频时出错: {str(e)}")
    def transcribe_audio(self, audio_path: Path) -> str:
        """转录单个音频文件"""
        if not self.siliconflow_api_key:
            raise ValueError("未设置 SILICONFLOW_API_KEY 环境变量")
        files = {
            'file': (audio_path.name, open(audio_path, 'rb'), 'audio/mpeg'),
            'model': (None, DEFAULT_MODEL)
        }
        headers = {
            "Authorization": f"Bearer {self.siliconflow_api_key}"
        }
        try:
            response = requests.post(DEFAULT_API_BASE_URL, files=files, headers=headers)
            response.raise_for_status()
            result = response.json()
            if 'text' in result:
                return result['text']
            else:
                return response.text
        except Exception as e:
            raise Exception(f"提取文字时出错: {str(e)}")
        finally:
            files['file'][1].close()
    def extract_text(self, share_url: str, save_video: bool = False, output_dir: Optional[str] = None) -> dict:
        """提取视频文案"""
        video_info = self.parse_share_url(share_url)
        video_path = self.download_video(video_info)
        audio_path = self.extract_audio(video_path)
        text_content = self.transcribe_audio(audio_path)
        result = {
            "video_info": video_info,
            "text": text_content,
            "output_path": None
        }
        # 保存到文件
        if output_dir:
            output_base = Path(output_dir)
            video_folder = output_base / video_info['video_id']
            video_folder.mkdir(parents=True, exist_ok=True)
            # 保存文案为 Markdown 格式
            transcript_path = video_folder / "transcript.md"
            with open(transcript_path, 'w', encoding='utf-8') as f:
                f.write(f"# {video_info['title']}\n\n")
                f.write(f"| 属性 | 值 |\n")
                f.write(f"|------|----|\n")
                f.write(f"| 视频ID | `{video_info['video_id']}` |\n")
                f.write(f"| 提取时间 | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} |\n")
                f.write(f"| 下载链接 | [点击下载]({video_info['url']}) |\n\n")
                f.write(f"---\n\n")
                f.write(f"## 文案内容\n\n")
                f.write(text_content)
            result["output_path"] = str(video_folder)
            # 保存视频 (可选)
            if save_video:
                saved_video_path = video_folder / f"{video_info['video_id']}.mp4"
                shutil.copy2(video_path, saved_video_path)
        # 清理临时文件
        self.cleanup_files(video_path, audio_path)
        return result
    def cleanup_files(self, *file_paths: Path):
        """清理指定的文件"""
        for file_path in file_paths:
            if file_path.exists():
                file_path.unlink()
# Register tools
@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="parse_douyin_video_info",
            description="解析抖音分享链接，获取视频标题、封面、无水印下载链接等基础信息，不需要API Key",
            inputSchema={
                "type": "object",
                "properties": {
                    "share_url": {
                        "type": "string",
                        "description": "抖音分享链接或包含链接的文本"
                    }
                },
                "required": ["share_url"]
            }
        ),
        Tool(
            name="extract_douyin_text",
            description="提取抖音视频中的口播文案，需要配置ALAPI_TOKEN和SILICONFLOW_API_KEY环境变量",
            inputSchema={
                "type": "object",
                "properties": {
                    "share_url": {
                        "type": "string",
                        "description": "抖音分享链接或包含链接的文本"
                    },
                    "save_video": {
                        "type": "boolean",
                        "description": "是否同时保存视频文件，默认false",
                        "default": False
                    },
                    "output_dir": {
                        "type": "string",
                        "description": "可选输出目录，保存提取结果和视频文件"
                    }
                },
                "required": ["share_url"]
            }
        ),
        Tool(
            name="download_douyin_video",
            description="下载抖音无水印视频，需要配置ALAPI_TOKEN环境变量",
            inputSchema={
                "type": "object",
                "properties": {
                    "share_url": {
                        "type": "string",
                        "description": "抖音分享链接或包含链接的文本"
                    },
                    "output_dir": {
                        "type": "string",
                        "description": "视频保存目录，默认当前目录",
                        "default": "."
                    }
                },
                "required": ["share_url"]
            }
        )
    ]
@server.call_tool()
async def call_tool(name: str, arguments: dict):
    processor = DouyinProcessor()
    try:
        if name == "parse_douyin_video_info":
            result = processor.parse_share_url(arguments["share_url"])
            return [
                TextContent(
                    type="text",
                    text=json.dumps(result, ensure_ascii=False, indent=2)
                )
            ]
        elif name == "extract_douyin_text":
            result = processor.extract_text(
                arguments["share_url"],
                save_video=arguments.get("save_video", False),
                output_dir=arguments.get("output_dir")
            )
            return [
                TextContent(
                    type="text",
                    text=f"✅ 文案提取成功！\n\n**视频标题：** {result['video_info']['title']}\n\n**文案内容：**\n{result['text']}"
                )
            ]
        elif name == "download_douyin_video":
            video_info = processor.parse_share_url(arguments["share_url"])
            output_path = processor.download_video(
                video_info,
                output_dir=Path(arguments.get("output_dir", "."))
            )
            return [
                TextContent(
                    type="text",
                    text=f"✅ 视频下载成功！\n保存路径：{output_path}"
                )
            ]
        else:
            raise ValueError(f"Unknown tool: {name}")
    except Exception as e:
        return [
            TextContent(
                type="text",
                text=f"❌ 操作失败：{str(e)}"
            )
        ]
def main():
    """启动MCP服务器"""
    server.run()
if __name__ == "__main__":
    main()
