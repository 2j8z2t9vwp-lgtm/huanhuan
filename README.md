# 欢欢工作台

给抖音餐饮账号运营师的本地网页工作台。浅色极简界面，Python 后端 + 浏览器前端，SQLite 保存记录。默认只监听本机，不需要注册账号。

## 打开工作台

这台电脑的依赖和 FFmpeg 已安装，直接双击 **启动欢欢工作台.bat**。

浏览器打开：<http://127.0.0.1:8765>。双击启动文件会在后台运行并打开浏览器；双击 **停止欢欢工作台.bat** 结束服务，数据仍在。电脑重启后重新启动即可。

第一次在其他 Windows 电脑使用：安装 Python 3.11 或更新版本；扩展能力还需 Node.js 24 或更新版本。双击 **安装依赖.bat**，完成后再启动。依赖、视频下载、首次模型下载需要网络。

也可在项目目录执行：

```powershell
.\.venv\Scripts\python.exe start.py
```

若 8765 端口被其他程序使用，在 PowerShell 中设置其他端口：

```powershell
$env:HUANHUAN_PORT = '8766'
.\.venv\Scripts\python.exe start.py
```

## 每天怎么用

1. **建立门店档案**：填城市商圈、主推菜、实际价格、顾客画像和可以拍出来的卖点。可以管理多家门店。
2. **拆解参考**：在首页粘贴抖音分享文案／视频链接。也支持上传 300MB 以内、10 分钟以内的视频。
3. **看真实素材**：查看关键画面和对应时间戳，点击关键帧跳转原片；校正语音台词，记下人工观察。
4. **生成自己的脚本**：选择门店和内容角度，得到包含时间、画面、口播、字幕、道具的分镜。价格、条件等缺失信息用【占位内容】保留，必须自行核实。
5. **安排拍摄**：脚本选择拍摄日期与状态。也可在拍摄日历一键生成未来 7 天的不同选题模板，按门店实际产能调整。
6. **发布与复盘**：编辑封面、文案与话题，完成发布检查；手动记录同一观察窗口的播放、互动、完播、主页访问和订单，比较不同开场的实际效果。

## 已实现的能力与边界

| 功能 | 无 API Key | 接入支持图片的 AI 后 |
| --- | --- | --- |
| 分享文案提取链接、尝试视频下载 | 支持，受平台访问限制 | 相同 |
| 上传视频、播放、场景关键帧与时间点 | 本地真实处理 | 相同 |
| 中文语音转写 | Faster Whisper 本地 CPU | 相同 |
| 台词内容线索与时间分组 | 基于真实转写的关键词规则，不判断传播原因 | 可进一步总结 |
| 画面语义、开场机制、证据拆解 | 人工查看与记录 | 根据关键帧、台词分析；传播机制仍是推测 |
| 门店脚本 | 7 种可编辑餐饮策划模板；保留来源及观察 | 结合门店、参考拆解、人工观察与具体要求原创改编 |
| 排期、发布检查、复盘、导出 | 支持 | 相同 |

**抖音链接限制**：未登录时，平台可能不给视频数据。本次公开链接实测遇到了平台访问限制，不能保证任何链接都能下载，也没有用测试数据冒充拆解成功。可在设置导入本人浏览器导出的 Netscape cookies.txt 后重试；平台仍限制时，在抖音保存视频再上传。本工具没有接入付费解析站，也不绕过付费或访问权限。

**本地语音**：默认 Base 模型，首次下载后可本地识别；Tiny 更快但识别错字更多，Small 更慢、通常更适合对准确性有要求的场景。在设置切换模型，第一次使用所选模型可能需要下载。背景音乐、方言、人声不清都会影响识别，逐句对照原片校正。

可提前缓存模型：

```powershell
.\.venv\Scripts\python.exe setup_model.py base
```

**没有自动获取抖音后台数据或自动发帖**：复盘来自你手动填写的数据。工作台提供运营实验建议，不将“固定时间发”“固定标签数量”等当作流量保证。餐饮优先看同城需求、真实出品、到店信息、主页访问和可归因订单。

## 可选 AI 配置

打开偏好设置，选择以下一种：

- **Claude / Anthropic Messages API**：填写基础地址、模型 ID 和本人 API Key。
- **兼容 Chat Completions API**：填写服务商提供的 `/v1` 地址、模型 ID 与 Key；也可接入已在本机运行的 Ollama，其基础地址通常为 `http://localhost:11434/v1`，无需云端 Key。视觉拆解必须选择支持图片的模型；本项目不包含 Ollama 服务或视觉模型权重。

保存后可测试文本连接。实际图片分析还取决于所选模型的视觉能力。云端分析将关键帧与台词发给所配置的服务商；原创改编发送门店资料、拆解文字与要求。默认未接入服务，不调用云端 AI。服务商费用由你自己的 API 账号结算。

API Key 使用 Windows DPAPI 加密，绑定当前 Windows 用户；不会返回浏览器或导出。Cookie 只保留所支持视频平台的域，保存在本地 `data/cookies.txt`，不发给 AI。不要公开分享自己的 `data` 目录。

## 数据与导出

- `data/huanhuan.db`：门店、拆解记录、脚本、复盘及设置。
- `data/media/`：上传／下载的视频、抽帧结果、转写文件。
- `data/models/`：本地语音模型缓存。
- `data/credentials.dpapi`：加密的 AI Key；`data/cookies.txt`：平台登录 Cookie。
- 脚本页可以导出 Markdown，或打印到 PDF；导出按钮导出**已保存版本**。
- 发布与复盘可导出 CSV；设置页可导出内容记录 JSON（不含视频、Cookie、Key，也没有实现 JSON 导入）。
- 完整迁移：关闭服务后复制整个项目目录。换 Windows 用户／电脑后重新填写 API Key。

## 技术结构

```text
app/main.py       FastAPI 本机 API、上传、内容记录、设置与导出
app/video.py      后台单任务队列、yt-dlp、抖音公开 SSR 与浏览器回退
app/browser_fetch.py  全新未登录 Chrome / Edge 公开播放读取
app/watch_bridge.py  隔离调用 claude-video / watch 的场景抽帧与时间戳
app/transcribe.py 独立进程中文识别，失败不影响已有画面
app/planning.py   7 种餐饮脚本、转写线索规则、复盘与导出
app/ai.py         可选 Claude／兼容接口适配，JSON 结果校验
app/store.py      SQLite 持久化、Windows DPAPI
static/          无构建前端，原生 JavaScript + CSS
tools/           项目内 FFmpeg 和 ffprobe
```

视频引擎采用你指定的 [bradautomates/claude-video](https://github.com/bradautomates/claude-video)，技能名为 **watch**，版本 0.3.2。代码位于 `vendor/claude-video/`，锁定提交 `03ceb42f7fa2c4439aca01752118044baabffb8f`，来源记录见 `vendor/claude-video-revision.json`。

工作台通过独立进程调用上游 `frames.py` 的场景检测、均匀回退、去重与真实时间戳，最多选择 48 帧；下载保留工作台的 yt-dlp 及抖音公开页面适配，中文识别保留已经验证的 Faster Whisper。上游源码没有修改。此适配明确使用本地处理，不读取全局 Watch 的云端服务或 Cookie 配置，也不调用 Gemini；网页 AI 仍只使用工作台设置中明确配置的服务。

同一个 watch 技能也已安装到本机 Codex 的 `C:\Users\Administrator\.codex\skills\watch`，下一轮对话可请求使用。安装技能和网页服务是两套入口；网页直接调用项目自带的固定版本，不依赖 Codex 处于运行状态。

在项目目录使用独立技能时，可在当前 PowerShell 会话内加入已有工具路径（不修改系统 PATH）：

```powershell
$env:PATH = "$PWD\tools;$PWD\.venv\Scripts;$env:PATH"
.\.venv\Scripts\python.exe vendor\claude-video\skills\watch\scripts\setup.py --json
```

## 验证

### 内存、磁盘与定时清理

偏好设置 → “存储与清理”显示主服务的当前内存，以及 `data/` 下视频与关键帧、语音模型、宣传项目和其余文件的磁盘占用。内存数值只含 Python 主服务，不包含网页浏览器、转写与 FFmpeg 子进程；模型磁盘缓存不是常驻内存。关闭网页标签不会停止后台，不用时双击“停止欢欢工作台.bat”；再次启动后记录仍在。

清理前可查看文件列表。手动清理和每日自动清理均只处理 `data/media/` 下七天以上的 `.part/.ytdl/.tmp/.temp` 文件，以及三十天以上、严格匹配名称的归档日志；不删除原视频、关键帧、转写、模型、项目、SQLite、Cookie 或密钥。默认不开自动清理。用户开启后，后台每半小时检查是否已间隔24小时；有视频任务就跳过，后台没运行则不会执行。无需为了清理保持电脑开机。该功能是网页后台自己的维护，不是 Windows 定时任务。

服务启动时若 `server.log` 超过5MB则归档，旧归档受上述清理规则管理。清理忽略符号链接与 Windows 重解析点，并在删除时复查路径范围；只删除单个候选临时文件，不递归删除目录。磁盘空间不足时，先导出备份，再通过视频记录中的删除按钮移除确实不需要的整条视频；不要手动清空 `data/media`。

### 网页骨架迁移与官方号剧情演绎

切入点共14种：菜品诱惑、老板出镜、价格价值、后厨信任、同城场景、顾客问答、门店日常、第一视角Vlog、店员跟拍、吃法攻略、菜品对比、新品介绍、午休用餐、声音特写。新增角度有各自的离线拍摄结构；Vlog使用真实员工/老板视角，声音特写可无对白。生成周计划时从中勾选恰好7种，不会把全部14种自动排成14天。

新建脚本或从参考视频点击“转为我的脚本”，选择参考、拍摄形式（菜品展示 / 剧情演绎）、1–4 名可出镜人数，并填写演员和情境要求。启用 AI 后，参考生成先调用模型提炼骨架与迁移表，再据此生成拍摄分镜；没有参考则做原创策划，只调用一次。每次调用使用设置中的服务，界面明确说明将发送关键帧、转写、门店资料及用量计费。

骨架阶段加载 `vendor/viral-reverse-engineering/` 的固定版本技能与参考文件；`SOURCE.json` 保存来源、版本和 Markdown 文件校验值，许可随包保留。门店档案提供品牌和受众输入；参考以真实关键帧、转写、现有拆解和观察为证据。单条样本不能证明传播因果，未知项必须保留，不把上游泛化的分享论断当作实际数据结论。

生成的“骨架与演绎”页展示原片段落、证据、段落功能和自家拍法。剧情版还展示情境、角色目的、分歧、变化和收尾；分镜含角色对白与动作，发布文案保留“剧情演绎”。程序验证原片时间轴、镜头与骨架的索引顺序、段落覆盖和角色人数；失败不保存半成品。段落映射不代表逐帧复刻，不能保证脚本创意质量或流量。

编辑分镜会保留骨架索引；Markdown 导出包含骨架与角色资料。旧脚本保持原样，需新生成才有这些字段。剧情模式需启用 AI，普通离线模板不会冒充自动编剧。测试使用合成资料与模拟 AI，未代表已经通过真实 DeepSeek 创作质量验收。

页面回归：`python tests/browser_creative.py` 拦截全部 API，仅用合成数据测试桌面 / 手机的剧情生成、骨架查看和编辑保存，不写入用户记录或调用外部 AI。

### DeepSeek 官方 API

设置 → 服务类型选择“DeepSeek 官方”，自动填入 `https://api.deepseek.com` 与 `deepseek-flash`；在本地填写自己的 API Key，保存后测试连接。关键帧分析使用官方文档声明支持图片的 `deepseek-flash`，脚本生成使用同一接口。可选择思考模式；程序只使用最终 JSON 回答，不保存或显示 reasoning_content。该接口不负责解析抖音链接。接口用量由服务商计费，Key 使用既有 Windows DPAPI 存储；尚未提供真实 Key 时只验证模拟请求，不能宣称实际联网调用通过。

依据官方文档（2026-11-01 核对）：[首次调用](https://api-docs.deepseek.com/zh-cn/)、[图像理解](https://api-docs.deepseek.com/zh-cn/guides/vision/)、[思考模式](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/)。

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

包含真实合成视频的上传、指定 claude-video 引擎及帧时间戳验证、关键帧读取、视频 Range 播放、记录持久化、指标计算、导出、Cookie 域过滤、密钥加解密、跨来源访问限制测试。Windows 密钥测试需要在当前用户的正常进程中运行。

浏览器验收（需安装 Playwright，且服务已启动）：

```powershell
.\.venv\Scripts\python.exe -m pip install playwright
.\.venv\Scripts\python.exe tests/browser_check.py
```

验收覆盖 7 页、390px 手机布局、门店创建、分镜编辑保存、7 天排期、数据复盘、上传抽帧与点击跳转。只清理验收过程新创建的记录，截图在 `test-results/`。测试脚本默认使用本机系统 Chrome 路径。

## 新增：竞品观察、能力中心与宣传项目

本次根据餐饮账号运营用途保留四个扩展。用户取消的 dida-task-skill 没有安装，其临时下载也已移除。

| 来源 | 在工作台里的用途 | 当前边界 |
| --- | --- | --- |
| bettermen/douyin-analyzer | 竞品观察：保存公开点赞、评论、转发、收藏；计算评赞比、转赞比、藏赞比；做笔记、导出对比表、导入视频拆解 | 公开页面是否给数据受平台限制；不展示推算播放量或完播率，不使用固定“爆款及格线” |
| jackyjoylee/douyin-mcp | 可选 ALAPI 解析、硅基流动口播转写 | 实际解析函数也需要 ALAPI Token；云端转写需要对应 Key，并会上传音频 |
| yourhousemktg-ctrl/viralvision-mcp | 可选均匀抽帧方案，完整视频范围内最多 48 帧 | 时间按采样率估算，明确标注；它提供图片，仍需视觉 AI 理解，不额外提供模型 |
| isagoakira/promo-workflow-mcp | 门店上新、活动等完整宣传项目；原生 MCP 状态机、独立工作区、版本、审核台 | 当前网页提供创建、阅读工作区、明确确认、推进当前自动步骤、保存备注、刷新与原生审核入口；选题、写稿、锁定和制作仍须按上游流程协作 |

日常内容继续从脚本库与拍摄日历进入。复杂活动才需要建立宣传项目；项目的首次工作区确认和后续人审都保留，没有自动批准或伪造制品。原生审核台点击后按需启动，退出工作台时可通过停止文件结束其子进程。

**使用入口**：导航里的“竞品观察”“宣传项目”“能力中心”。默认继续使用 watch + 本地 Faster Whisper，新增工具只在用户选择的处理方案或按钮动作中执行，不因原方案失败而擅自切换到收费服务。

**配置密钥**：能力中心中的 ALAPI Token 和硅基流动 Key 使用 Windows DPAPI 加密，分别保存在 `data/alapi.dpapi` 与 `data/siliconflow.dpapi`；不回显、不导出。勾选云端转写后，所选服务会接收音频。它与偏好设置中的视觉 AI Key 是不同用途的配置。

**已核实的适配问题**：douyin-mcp 上游打包缺少包目录声明、stdio 入口不完整；本项目直接加载其处理器，并在 `app/douyin_server.py` 中补齐 MCP 入口和超时。Promo 原生审核台的 CLI 入口判断在 Windows 路径下不生效；本项目用 `app/promo_review_bridge.mjs` 调用其导出函数。上游源码保持原样。

**数据保存**：竞品与宣传项目索引在 SQLite 中；Promo 的权威状态和制品在 `data/promo/`，只能通过原生 MCP 修改。内容 JSON 导出包含竞品与项目索引，但不含完整 Promo 制品与视频，完整迁移仍需关闭服务后备份整个目录。MCP 诊断日志在 `data/integrations.log`。

**本机技能**：已安装 douyin-analyzer，以及 Promo 的流程入口、人话写作、口播、分镜与交付规范 5 个技能，下一轮对话可用。网页后端已具备本地 MCP 调用能力；这并不代表修改了 Codex 全局 MCP 配置或自动添加了本聊天的原生工具。

**真实链接实测**：用户提供的肥姨妈螺蛳粉短链已解析到视频 ID `7694544053383220507`。yt-dlp 与公开 SSR 失败后，一次全新未登录 Chrome 公开播放测试成功获得视频，已完成 21.99 秒、15 帧及本地中文转写。本次聊天助手实际查看画面后，保存了一份拆解和待填写门店事实的原创改拍示范，页面明确标注为本次助手拆解。这不代表未配置视觉 API 时网页能够自动理解画面。未获得可靠互动数据，不推算播放量或流量成因。

**链接读取边界**：默认本地解析已加入全新未登录浏览器回退，需要本机 Chrome 或 Edge；不读取既有浏览器资料、不自动登录、不处理验证码。再次验证出现页面超时及媒体域名不匹配，因此不能保证每次粘贴链接成功。已有视频文件与拆解保存在本地，不受短链后续变化影响；链接失败时可上传本人保存的视频。

**待核实项目**：`https://github.com/leilei123/video-insight-mcp` 在检查时 GitHub API 与常见分支归档均返回 404，未安装，也没有凭名称评估其能力。需要可访问的正确地址才能进一步核查。

扩展构建可以单独重跑：

```powershell
.\.venv\Scripts\python.exe scripts/fetch_integrations.py
.\.venv\Scripts\python.exe scripts/setup_node_packages.py
.\.venv\Scripts\python.exe scripts/build_integrations.py
```

扩展页面验收使用独立端口和临时数据库，覆盖 10 页及 1440px / 390px 布局，避免在用户工作台留下测试项目：

```powershell
.\.venv\Scripts\python.exe tests/browser_integrations.py
```


## macOS 版本

Mac 安装与运行见 [MAC使用说明.md](MAC使用说明.md)。双击安装、启动、停止的 `.command` 入口；使用 Python 3.11、原生 FFmpeg、Node.js 与 macOS 钥匙串。可用 `python scripts/package_mac.py` 生成不含用户数据的迁移 ZIP。不得将 Windows 的虚拟环境或二进制复制到 Mac。
