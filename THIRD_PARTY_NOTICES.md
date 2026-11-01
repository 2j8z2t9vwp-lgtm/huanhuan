# 开源组件声明

欢欢工作台将下列开源项目作为独立依赖调用；未将其付费能力包装成本项目能力。

| 组件 | 用途 | 官方仓库 / 许可 |
| --- | --- | --- |
| claude-video / watch 0.3.2 | 场景关键帧、去重、时间戳；固定版本源码见 vendor/claude-video | https://github.com/bradautomates/claude-video · MIT；许可证保留在 vendor/claude-video/LICENSE |
| yt-dlp | 视频链接、下载和元信息 | https://github.com/yt-dlp/yt-dlp · Unlicense；其依赖各自遵循各自许可 |
| Faster Whisper | CPU 本地语音识别 | https://github.com/SYSTRAN/faster-whisper · MIT |
| FFmpeg / ffprobe | 读取与处理媒体文件 | https://ffmpeg.org/ · 具体许可依构建配置；本地 Gyan essentials 构建包含 GPL 组件 |
| FastAPI | 本地 HTTP 服务 | https://github.com/fastapi/fastapi · MIT |
| Uvicorn | ASGI 服务器 | https://github.com/encode/uvicorn · BSD-3-Clause |
| HTTPX | HTTP 客户端 | https://github.com/encode/httpx · BSD-3-Clause |
| douyin-analyzer | 公开数据读取、字段说明与相对指标 | https://github.com/bettermen/douyin-analyzer · MIT；许可证保留在 vendor/integrations/douyin-analyzer/LICENSE |
| douyin-mcp | ALAPI 解析及硅基流动语音的上游处理器 | https://github.com/jackyjoylee/douyin-mcp · README 声明 MIT；保留完整来源及声明 |
| viralvision-mcp 1.0.0 | 可选均匀采样引擎与 MCP 工具 | https://github.com/yourhousemktg-ctrl/viralvision-mcp · package.json / README 声明 MIT；保留完整来源 |
| Promo Workflow 0.1.0 | 宣传项目状态机、版本、审核及原生审核台 | https://github.com/isagoakira/promo-workflow-mcp · 保留其仓库许可证与来源声明 |
| viral-reverse-engineering 1.0.0 | 网页生成前的骨架拆解、反事实检查、逐段迁移 | https://github.com/social-media-skills/skills/tree/main/skills/viral-reverse-engineering · MIT；版权及许可见 vendor/viral-reverse-engineering/LICENSE |

上述四个扩展的原始代码位于 `vendor/integrations/`，未修改其源码。每个目录的 `SOURCE.json` 记录官方仓库、分支、源码归档 SHA-256；项目级适配在 `app/`，用于协议接入、Windows 入口修复、超时限制、数据路径隔离及网页功能。新增 Node 依赖按各包安装目录内的许可证分别授权。

FFmpeg 可执行文件来自 https://www.gyan.dev/ffmpeg/builds/ ，由 setup_tools.py 下载到被 Git 忽略的 tools 目录，不修改系统 PATH。查看 `tools/ffmpeg.exe -L` 和 `-buildconf` 了解具体构建许可；对应 FFmpeg 源码、构建资料及许可证可从 FFmpeg 官方项目与构建提供方获得。重新分发二进制时需按该构建的许可履行相应义务。

Python 依赖安装目录内保留相应许可证与元数据。语音模型来自 Faster Whisper 所使用的公开模型仓库，使用时同时遵守模型仓库的许可。
