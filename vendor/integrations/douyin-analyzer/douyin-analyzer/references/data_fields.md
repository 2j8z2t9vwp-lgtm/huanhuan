# 抖音视频数据字段与接口注意事项

## 字段字典（fetch_video_info 输出）

| 字段 | 含义 | 备注 |
|---|---|---|
| `aweme_id` | 视频 ID | 全局唯一，纯数字 |
| `title` | 视频文案（含话题文本） | 话题会以 `#xx` 形式混在文案里 |
| `create_time` | 发布时间 | 已从 Unix 时间戳转为 `YYYY-MM-DD HH:MM:SS` |
| `duration_ms` | 时长（毫秒） | 极少数视频为 0（图集/直播切片） |
| `author.nickname` / `unique_id` | 作者昵称 / 抖音号 | `sec_uid` 是作者的主页接口 ID |
| `stats.digg_count` | 点赞数 | |
| `stats.comment_count` | 评论数 | |
| `stats.share_count` | 转发数 | 抖音算法权重最高的互动指标 |
| `stats.collect_count` | 收藏数 | 知识/教程类内容的关键指标 |
| `stats.play_count` | 播放量 | **分享页通常返回 0 或 null**，官方不对外暴露，分析时勿依赖 |
| `hashtags` | 话题标签列表 | |
| `music` | BGM 信息 | |
| `no_watermark_play_url` | 无水印播放地址 | 由 `playwm` 替换为 `play` 得到；可直接用于下载 |
| `cover` | 封面图 URL | |

## 已知限制

1. **评论接口（403 高发）**：`/aweme/v1/web/comment/list/` 对无签名请求风控严格。
   - 对策一：让请求方提供浏览器登录抖音后的 Cookie，经 `--cookie` 传入。
   - 对策二：告知用户该限制，改用点赞/转发等公开指标做分析（多数分析场景足够）。
2. **视频不可见**：已删除/设私/被过滤的视频返回错误 "未获取到视频详情"。
3. **页面结构漂移**：抖音可能改版分享页。解析器在 `RENDER_DATA` 与 `_ROUTER_DATA`
   两种形态间自动兼容，并递归定位 `aweme_detail`，可容忍一定程度的结构变化；
   若彻底失效，检查 `_parse_share_page` 中的两种正则。
4. **频率控制**：批量抓取时每条间隔建议 ≥ 1.5 秒，单次任务控制在几十条以内；
   高频请求会触发滑块验证或 IP 限流。

## 扩展方向（需要时自行实现）

- **作者主页视频列表 / 更完整评论**：需实现 `a_bogus` 或 `X-Bogus` 签名算法，
  请求 `www.douyin.com/aweme/v1/web/aweme/post/` 等接口，并携带登录 Cookie。
- **搜索接口**：`www.douyin.com/aweme/v1/web/general/search/single/`，同样需要签名。
- 签名算法社区实现可参考开源项目（如 douyin-tiktok-scraper 类项目），注意时效性。
