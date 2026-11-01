---
name: douyin-analyzer
description: 抖音视频数据抓取与运营分析。当用户需要获取抖音视频数据（标题、作者、点赞/评论/转发/收藏数、无水印下载地址）、分析某条抖音视频表现、拆解爆款视频、对比竞品账号数据、基于数据给出选题建议，或输入中包含抖音分享口令/链接（v.douyin.com、douyin.com/video/ 等）时使用。提供免登录的抓取脚本、字段字典与分析方法。
---

# Douyin Analyzer（抖音视频数据分析）

## 核心能力

1. **抓取**：用 `scripts/douyin_scraper.py` 获取抖音视频公开数据，免登录、免 Cookie、免签名
2. **分析**：按 `references/analysis.md` 的指标体系与拆解框架输出运营洞察
3. **集成**：`scripts/douyin_mcp_server.py` 可将抓取能力封装为 MCP Server，供客户端长期接入

## 抓取用法

```bash
python3 scripts/douyin_scraper.py info     "<分享口令|短链|长链|视频ID>"
python3 scripts/douyin_scraper.py resolve  "<分享口令|短链|长链|视频ID>"
python3 scripts/douyin_scraper.py comments "<分享口令|短链|长链|视频ID>" [--count 20] [--cookie "…"]
```

- 依赖：`pip install httpx`（MCP server 另需 `pip install mcp`）
- `info` 直接接受用户从抖音 App 复制的整段分享文字，无需预处理链接
- 输出为 JSON；失败返回 `{"error": ..., "hint": ...}`，按 hint 向用户解释
- 批量抓取时每条间隔 ≥ 1.5 秒

## 工作流

**单视频分析**：抓取 `info` → 阅读 `references/analysis.md` 的核心指标 → 计算评赞比/转赞比/藏赞比 → 按五维框架拆解 → 输出结论。指标含义与数据陷阱（如无播放量）先读 `references/data_fields.md`。

**爆款拆解**：抓取目标视频 → 完整走 `references/analysis.md` 的"爆款拆解框架"→ 结论区分"数据事实"与"推测"。

**竞品/批量对比**：用户提供多条链接 → 逐条抓取（控制频率）→ 汇总成对比表 → 按 `references/analysis.md` 的对比流程归纳各账号打法。

**评论分析**：`comments` 子命令风控严格，无 Cookie 时大概率 403。失败则告知用户该限制，改用点赞/转发等公开指标分析；不要重试轰炸接口。

## 合规红线

- 仅抓取公开数据，控制频率，不绕过登录态抓私密内容
- 不向用户承诺"稳定批量采集"；明确说明数据仅供研究参考
- 分析结论基于真实抓取数据，禁止编造数字

## 故障排查

页面结构变更导致解析失败时，先读 `references/data_fields.md` 的"已知限制"与"扩展方向"定位原因。
