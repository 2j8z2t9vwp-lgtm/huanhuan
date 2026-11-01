# ViralVision — Give Claude Eyes on Any Social Video

You are the ViralVision skill. When activated, you help the user analyze social videos using the ViralVision tools built into Claude Code.

**Built by:** Marc Illy (@Marc_illy)  
**GitHub:** https://github.com/yourhousemktg-ctrl/viralvision-mcp  
**Landing page:** https://illymethod.com/viralvision

---

## What this skill does

Paste any TikTok, YouTube, Instagram Reel, or Twitter/X link. Claude downloads it, watches every frame, and gives you a full breakdown — hook strength, pacing, every cut, the CTA. No Gemini. No OpenAI. No extra API keys. Just Claude.

---

## How to use

Just paste a video URL and tell Claude what you want:

```
vv_watch https://www.tiktok.com/@someone/video/7123456789
```

Then ask:
- "What's the hook formula? Rate it 1-10."
- "How does the pacing compare to top-performing Reels?"
- "Write me a hook using the same pattern."
- "What's the CTA and how could I improve it?"

---

## Commands

| Command | What it does |
|---------|-------------|
| `vv_watch [URL]` | Frame-by-frame analysis — hook, pacing, cuts, viral score, CTA breakdown |
| `vv_transcript [URL]` | Full timestamped transcript in seconds. No download needed. |
| `vv_info [URL]` | Views, likes, hashtags, creator metadata, duration. |
| `vv_setup` | Check your installation status. |

**Supported platforms:** YouTube · TikTok · Instagram Reels · Twitter/X · Facebook · Reddit · local files

---

## Install (one-time setup)

**Step 1 — Install dependencies**
```bash
brew install yt-dlp ffmpeg        # macOS
# sudo apt install ffmpeg && pip install yt-dlp  # Linux
```

**Step 2 — Clone and build**
```bash
git clone https://github.com/yourhousemktg-ctrl/viralvision-mcp ~/.claude/mcp/viralvision-mcp
cd ~/.claude/mcp/viralvision-mcp
npm install && npm run build
```

**Step 3 — Register the skill**
```bash
claude mcp add viralvision -- node ~/.claude/mcp/viralvision-mcp/dist/index.js
cp ~/.claude/mcp/viralvision-mcp/commands/viralvision.md ~/.claude/commands/viralvision.md
```

Restart Claude Code. Then type `/viralvision` to activate the skill.

---

## Troubleshooting

**"vv_watch not found"** — Run `vv_setup` to check your install status.

**"yt-dlp not found"** — Run `brew install yt-dlp` and restart terminal.

**"ffmpeg not found"** — Run `brew install ffmpeg` (Mac) or `sudo apt install ffmpeg` (Linux).

**"Video unavailable"** — Some videos are geo-restricted. Try a different video.

**Private videos** — Must be a public URL.

---

## Links

- GitHub: https://github.com/yourhousemktg-ctrl/viralvision-mcp
- Free setup guide: https://illymethod.com/viralvision
- Marc's Instagram: https://www.instagram.com/Marc_illy
- Marc's TikTok: https://www.tiktok.com/@marc_illy
- Marc's YouTube: https://www.youtube.com/@MarciLLyTV
- Marc's Skool community: https://www.skool.com/cognivalco-9857
- AI Playbook 2026: https://www.marcillyaiplaybook.it.com
