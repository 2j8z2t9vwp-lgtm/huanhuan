# 抖音 MCP 服务器
标准 MCP 协议服务器，提供抖音视频解析、文案提取、无水印下载功能，支持所有兼容 MCP 协议的 AI 应用（Claude Desktop、Cursor、Windsurf、OpenClaw 等）。
## 功能特性
- 🎬 **视频解析**：获取抖音视频标题、封面、无水印下载链接
- 🎙️ **文案提取**：AI 自动识别视频内的口播文案
- 💾 **视频下载**：下载无水印视频到本地
- 🔌 **通用兼容**：支持所有 MCP 协议客户端
## 安装方法
### 1. 安装依赖
```bash
# 克隆或下载本项目
cd douyin-mcp-server
# 安装依赖
uv sync
# 或者使用 pip
pip install -e .
```
### 2. 配置环境变量
复制 `.env.example` 为 `.env`，填写你的 API Key：
```env
# ALAPI Token，从 https://www.alapi.cn/ 获取
ALAPI_TOKEN=your_alapi_token_here
# 硅基流动 API Key，从 https://cloud.siliconflow.cn/ 获取
SILICONFLOW_API_KEY=your_siliconflow_api_key_here
```
## 配置到 MCP 客户端
### Claude Desktop 配置
编辑 Claude Desktop 配置文件：
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
添加以下配置：
```json
{
  "mcpServers": {
    "douyin": {
      "command": "uvx",
      "args": ["douyin-mcp-server"],
      "env": {
        "ALAPI_TOKEN": "your_alapi_token_here",
        "SILICONFLOW_API_KEY": "your_siliconflow_api_key_here"
      }
    }
  }
}
```
### OpenClaw 配置
在 OpenClaw 配置中添加：
```json
{
  "mcpServers": {
    "douyin": {
      "command": "uvx",
      "args": ["douyin-mcp-server"],
      "env": {
        "ALAPI_TOKEN": "your_alapi_token_here",
        "SILICONFLOW_API_KEY": "your_siliconflow_api_key_here"
      }
    }
  }
}
```
## 可用工具
### 1. `parse_douyin_video_info`
解析抖音分享链接，获取基础信息（不需要 API Key）
**参数：**
- `share_url`：抖音分享链接
### 2. `extract_douyin_text`
提取视频口播文案
**参数：**
- `share_url`：抖音分享链接
- `save_video`：是否保存视频文件（可选，默认 false）
- `output_dir`：输出目录（可选）
### 3. `download_douyin_video`
下载无水印视频
**参数：**
- `share_url`：抖音分享链接
- `output_dir`：保存目录（可选，默认当前目录）
## 使用示例
```
用户：帮我提取这个抖音视频的文案 https://v.douyin.com/xxxxxx/
AI：我来帮你提取抖音视频文案...
[调用 extract_douyin_text 工具]
✅ 文案提取成功！
**视频标题：** xxxxx
**文案内容：**
xxxxxx
```
## 许可证
MIT
