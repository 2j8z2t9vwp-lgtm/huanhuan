import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkDependencies } from "../utils/downloader.js";
import { execFileAsync } from "../utils/exec.js";

export function registerSetup(server: McpServer): void {
  server.tool(
    "vv_setup",
    "Check if ViralVision MCP is correctly installed. Verifies yt-dlp and ffmpeg are available, shows their versions, and gives platform-specific setup instructions. Run this first when setting up.",
    {},
    async () => {
      const deps = checkDependencies();

      let ytdlpVersion = "";
      let ffmpegVersion = "";

      try {
        const r = await execFileAsync("yt-dlp", ["--version"], { timeout: 5000 });
        ytdlpVersion = r.stdout.trim();
      } catch { /* already marked as missing */ }

      try {
        const r = await execFileAsync("ffmpeg", ["-version"], { timeout: 5000 });
        ffmpegVersion = r.stdout.split("\n")[0]?.replace("ffmpeg version", "").trim() || "";
      } catch { /* already marked as missing */ }

      const status = deps.errors.length === 0 ? "✅ Ready" : "⚠️ Setup Required";

      const text = [
        `# ViralVision MCP — Setup Check`,
        `**Status:** ${status}`,
        "",
        `## Dependencies`,
        `**yt-dlp:** ${deps.ytdlp ? `✅ ${ytdlpVersion}` : "❌ Not found"}`,
        `**ffmpeg:** ${deps.ffmpeg ? `✅ ${ffmpegVersion}` : "❌ Not found"}`,
        "",
        deps.errors.length > 0 ? `## Fix These Issues\n${deps.errors.map(e => `- ${e}`).join("\n")}` : "",
        "",
        deps.errors.length === 0 ? `## 🎉 You're all set!\n\nTry it:\n- \`vv_watch\` with any YouTube URL\n- \`vv_watch\` with any TikTok URL\n- \`vv_watch\` with any Instagram Reel URL\n- \`vv_info\` for fast metadata without downloading` : "",
        "",
        `## Install Commands (if needed)`,
        "### macOS",
        "```bash",
        "brew install yt-dlp ffmpeg",
        "```",
        "",
        "### Windows",
        "```bash",
        "# Using winget:",
        "winget install yt-dlp.yt-dlp",
        "winget install Gyan.FFmpeg",
        "# Or using scoop:",
        "scoop install yt-dlp ffmpeg",
        "```",
        "",
        "### Linux (Ubuntu/Debian)",
        "```bash",
        "sudo apt update && sudo apt install ffmpeg",
        "pip install yt-dlp",
        "```",
        "",
        `## Supported Platforms`,
        "| Platform | Public | Private | Notes |",
        "|---|---|---|---|",
        "| YouTube | ✅ | ❌ | Auto-captions extracted |",
        "| YouTube Shorts | ✅ | ❌ | Auto fps=2 |",
        "| Instagram Reels | ✅ | ❌ | Auto fps=2 |",
        "| Instagram Posts | ✅ | ❌ | Public only |",
        "| TikTok | ✅ | ❌ | Watermark-free |",
        "| Twitter/X | ✅ | ❌ | Video tweets |",
        "| Facebook | ✅ | ❌ | Public posts |",
        "| Reddit | ✅ | ❌ | v.redd.it videos |",
        "| Local files | ✅ | ✅ | MP4, MOV, AVI, etc. |",
        "",
        `## Private Instagram Posts`,
        "For private IG accounts you follow:",
        "```bash",
        "yt-dlp --cookies-from-browser chrome https://instagram.com/...",
        "```",
        "This passes your browser cookies to yt-dlp. You must be logged in to Instagram in Chrome.",
      ].filter(Boolean).join("\n");

      return { content: [{ type: "text" as const, text }] };
    },
  );
}
