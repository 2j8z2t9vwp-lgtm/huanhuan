# douyin-analyzer

抖音视频数据抓取与运营分析的 Agent Skill（兼容 Claude / Kimi 等支持 Skills 的 Agent，内含 MCP Server）。

## 功能

- **数据抓取**：分享口令 / 短链 / 长链 / 视频ID 直接获取视频标题、作者、点赞 / 评论 / 转发 / 收藏数、发布时间、话题、BGM、无水印播放地址
- **免登录免签名**：数据来自 `iesdouyin.com` 分享页 SSR 内嵌数据，不需要 Cookie 或 a_bogus 签名
- **分析方法论**：内置评赞比 / 转赞比 / 藏赞比指标体系、爆款五维拆解框架、竞品对比流程
- **MCP Server**：可接入 Claude Desktop / Cursor 等 MCP 客户端

## 目录结构

```
douyin-analyzer/
├── SKILL.md                      # Skill 主文件：触发规则 + 工作流
├── scripts/
│   ├── douyin_scraper.py         # CLI 抓取脚本
│   └── douyin_mcp_server.py      # MCP Server
└── references/
    ├── data_fields.md            # 字段字典与接口注意事项
    └── analysis.md               # 运营分析方法论
```

## 快速开始

### 作为 CLI 使用

```bash
pip install httpx

# 视频详情（直接粘贴抖音 App 复制的整段分享文字即可）
python3 douyin-analyzer/scripts/douyin_scraper.py info "7.43 pda:/ ... https://v.douyin.com/xxxx/ ..."

# 解析视频 ID
python3 douyin-analyzer/scripts/douyin_scraper.py resolve "https://v.douyin.com/xxxx/"

# 评论（风控较严，建议带 Cookie）
python3 douyin-analyzer/scripts/douyin_scraper.py comments "<链接或ID>" --count 20 --cookie "你的Cookie"
```

### 作为 MCP Server 使用

```bash
pip install mcp httpx
```

在 Claude Desktop / Cursor 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "douyin": {
      "command": "python",
      "args": ["/绝对路径/douyin-analyzer/scripts/douyin_mcp_server.py"]
    }
  }
}
```

### 作为 Agent Skill 使用

将 `douyin-analyzer/` 目录放入 Agent 的 Skills 目录，或将打包好的 `.skill` 文件导入支持 Skills 的客户端。

## 返回字段

`info` 子命令输出示例：

```json
{
  "aweme_id": "6914948781100338440",
  "title": "视频标题",
  "create_time": "2021-01-07 17:33:13",
  "author": { "nickname": "作者昵称", "unique_id": "抖音号" },
  "stats": {
    "digg_count": 2902710,
    "comment_count": 101078,
    "share_count": 107232,
    "collect_count": 73946
  },
  "no_watermark_play_url": "https://...",
  "hashtags": ["..."],
  "music": { "title": "...", "author": "..." }
}
```

完整字段说明见 [references/data_fields.md](douyin-analyzer/references/data_fields.md)。

## 已知限制

- 评论接口风控严格，无 Cookie 时大概率 403
- 分享页不含播放量（`play_count` 官方不对外暴露）
- 视频已删除 / 设私时返回明确错误提示

## 合规声明

本项目仅供学习与技术研究使用。请仅抓取公开数据，遵守抖音平台服务条款与 robots 协议，控制请求频率，不得用于商业批量采集或侵犯用户隐私。使用者需自行承担使用本工具产生的一切法律责任。

## License

MIT
