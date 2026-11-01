# ViralVision — Claude Skill

**Give Claude eyes on any social video. Type `/viralvision` and paste a URL.**

Built by [Marc Illy](https://www.marcillyaiplaybook.it.com) · Free forever · MIT License

---

## What it is

ViralVision is a Claude Code skill. Once installed, you type `/viralvision` inside Claude Code to activate it — then paste any TikTok, YouTube, Instagram Reel, or Twitter/X link. Claude downloads the video, watches it frame by frame, and breaks down exactly why it performed.

No Gemini. No OpenAI. No extra API keys. Just Claude.

```
You: /viralvision
You: vv_watch https://www.tiktok.com/@garyvee/video/123456789

Claude: [watches 47 frames across the 52-second video]

"Opens with a question hook at 0:02 — strong pattern interrupt.
Cuts every 1.8 seconds through the middle section.
CTA hits at 0:48, 'link in bio', repeated twice.
Viral score: 8/10 — pacing and hook formula are the key drivers..."
```

---

## Install in 4 steps

### Step 1 — Install dependencies

**macOS:**
```bash
brew install yt-dlp ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg && pip install yt-dlp
```

**Windows:**
```bash
winget install yt-dlp.yt-dlp && winget install Gyan.FFmpeg
```

### Step 2 — Clone and build

```bash
git clone https://github.com/yourhousemktg-ctrl/viralvision-mcp ~/.claude/mcp/viralvision-mcp
cd ~/.claude/mcp/viralvision-mcp
npm install && npm run build
```

### Step 3 — Register with Claude Code

```bash
claude mcp add viralvision -- node ~/.claude/mcp/viralvision-mcp/dist/index.js
```

### Step 4 — Install the skill (slash command)

```bash
cp ~/.claude/mcp/viralvision-mcp/commands/viralvision.md ~/.claude/commands/viralvision.md
```

Restart Claude Code. Then type `/viralvision` — you're live.

---

## How to use it

Type `/viralvision` to activate the skill, then:

```
vv_watch https://www.tiktok.com/@[username]/video/[id]
```

Claude describes the hook, pacing, script structure, B-roll, cuts, and CTA.

Then ask follow-up questions:
- "What's the hook formula? Rate it 1-10."
- "How does the pacing compare to top-performing Reels?"
- "Write me a hook using the same pattern."
- "What's the CTA and how could I improve it?"

---

## Commands

| Command | What it does | Speed |
|---|---|---|
| `vv_watch [URL]` | Download + extract frames. Claude sees every frame and analyzes the full video. | 10-30s |
| `vv_transcript [URL]` | Full timestamped transcript. No download needed. | 3-5s |
| `vv_info [URL]` | Views, likes, hashtags, creator, duration — without downloading. | 2-3s |
| `vv_setup` | Check your installation status. | Instant |

---

## Supported platforms

YouTube · TikTok · Instagram Reels · Twitter/X · Facebook · Reddit · local files

---

## License

MIT — use it, fork it, ship it.

---

*Built by Marc Illy · [AI Playbook 2026](https://www.marcillyaiplaybook.it.com)*
