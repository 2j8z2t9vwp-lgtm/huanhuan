import { z } from "zod";
import { execFileAsync } from "../utils/exec.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { detectPlatform, getPlatformEmoji } from "../utils/platform.js";

export function registerInfo(server: McpServer): void {
  server.tool(
    "vv_info",
    "Get video info without downloading the full video. Returns title, duration, creator, views, likes, description, and hashtags. Use this before vv_watch to check what a video contains. Much faster than vv_watch — takes 2-3 seconds.",
    {
      url: z.string().describe("YouTube URL, Instagram post/reel URL, TikTok URL, or any supported social video URL"),
    },
    async (params) => {
      const platformInfo = detectPlatform(params.url);
      const emoji = getPlatformEmoji(platformInfo.platform);

      let result;
      try {
        const { stdout } = await execFileAsync("yt-dlp", [
          params.url,
          "--dump-json",
          "--no-download",
          "--no-playlist",
          "--quiet",
          "--no-warnings",
        ], {
          timeout: 30_000,
          maxBuffer: 10 * 1024 * 1024,
        });

        const raw = JSON.parse(stdout);
        const description = raw.description || "";
        const hashtags = [
          ...(description.match(/#\w+/g) || []),
          ...(raw.tags || []).filter((t: string) => t.startsWith("#")),
        ];

        result = {
          platform: platformInfo.platform,
          title: raw.title || "Unknown",
          uploader: raw.uploader || raw.creator || raw.channel || "Unknown",
          duration_seconds: raw.duration || 0,
          duration_formatted: formatDuration(raw.duration || 0),
          upload_date: raw.upload_date || "",
          view_count: raw.view_count || 0,
          like_count: raw.like_count || 0,
          comment_count: raw.comment_count || 0,
          description: description.slice(0, 800),
          hashtags: [...new Set(hashtags)].slice(0, 30),
          thumbnail: raw.thumbnail || "",
          is_live: raw.is_live || false,
          age_limit: raw.age_limit || 0,
          dimensions: raw.width && raw.height ? `${raw.width}x${raw.height}` : "unknown",
          has_captions: !!(raw.subtitles && Object.keys(raw.subtitles).length > 0),
          has_auto_captions: !!(raw.automatic_captions && Object.keys(raw.automatic_captions).length > 0),
          original_url: params.url,
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `## ${emoji} Info Failed\n\n**URL:** ${params.url}\n**Error:** ${err?.stderr?.slice(0, 300) || err?.message || String(err)}\n\n**Is yt-dlp installed?** Run \`yt-dlp --version\` in terminal.`,
          }],
        };
      }

      const text = [
        `## ${emoji} ${result.title}`,
        `**Platform:** ${result.platform}  |  **Creator:** ${result.uploader}`,
        `**Duration:** ${result.duration_formatted}  |  **Dimensions:** ${result.dimensions}`,
        result.view_count > 0 ? `**Views:** ${result.view_count.toLocaleString()}  |  **Likes:** ${result.like_count.toLocaleString()}` : "",
        result.upload_date ? `**Posted:** ${result.upload_date}` : "",
        result.has_captions ? "**Captions:** ✅ Manual captions available" : "",
        result.has_auto_captions ? "**Auto-captions:** ✅ Available" : "",
        "",
        result.description ? `### Description\n${result.description}${(result.description?.length || 0) >= 800 ? "..." : ""}` : "",
        result.hashtags.length > 0 ? `\n### Hashtags (${result.hashtags.length})\n${result.hashtags.join(" ")}` : "",
        "",
        `---`,
        `*Run \`vv_watch\` with this URL to extract frames and analyze the video content.*`,
      ].filter(s => s !== null && s !== undefined).join("\n");

      return { content: [{ type: "text" as const, text }] };
    },
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
