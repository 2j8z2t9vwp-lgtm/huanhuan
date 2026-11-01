import { z } from "zod";
import { rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { detectPlatform, getOptimalFps, getPlatformEmoji } from "../utils/platform.js";
import { downloadVideo } from "../utils/downloader.js";
import { extractFrames } from "../utils/frames.js";

export function registerWatch(server: McpServer): void {
  server.tool(
    "vv_watch",
    `Watch any social video — YouTube, Instagram (Reels/posts), TikTok, Twitter/X, Facebook, Reddit, or a local file. Paste the URL and Claude will extract frames + platform metadata so you can analyze what's in the video.

RETURNS: Platform info (title, creator, description, hashtags, duration), extracted frames as images, and a summary ready for analysis.

TIPS:
- For short-form video (TikTok, IG Reels, YouTube Shorts) use fps=2 to get dense coverage
- For long-form (YouTube) the tool auto-samples key frames — set max_frames=30 for a quick overview
- Private Instagram posts require cookies — see vv_setup for instructions`,
    {
      url: z.string().describe("YouTube URL, Instagram post/reel URL, TikTok URL, Twitter/X URL, or local file path"),
      fps: z.number().positive().default(1).describe("Frames per second to extract (default: 1 — auto-adjusted for short-form)"),
      max_frames: z.number().int().min(1).max(120).default(40).describe("Maximum frames to return (default: 40)"),
      start_time: z.string().optional().describe("Start time in HH:MM:SS format"),
      end_time: z.string().optional().describe("End time in HH:MM:SS format"),
      resolution: z.number().min(320).max(1280).default(720).describe("Frame width in pixels"),
      format: z.enum(["jpeg", "webp"]).default("jpeg").describe("Frame image format"),
      skip_frames: z.boolean().default(false).describe("Return metadata only — skip frame extraction (faster for quick info checks)"),
    },
    async (params) => {
      const platformInfo = detectPlatform(params.url);
      const emoji = getPlatformEmoji(platformInfo.platform);

      // Download / resolve video
      let downloadResult;
      try {
        downloadResult = await downloadVideo(platformInfo);
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `## ${emoji} Download Failed\n\n**URL:** ${params.url}\n**Platform:** ${platformInfo.platform}\n\n**Error:** ${err.message}\n\n**Tip:** For private Instagram posts, run \`vv_setup\` to configure cookies.`,
          }],
        };
      }

      const { videoPath, metadata, workDir } = downloadResult;

      // Auto-adjust FPS for short-form
      const effectiveFps = platformInfo.isShortForm
        ? Math.max(params.fps, 2)
        : params.fps;

      const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [];

      // Platform metadata summary
      const metaSummary = [
        `## ${emoji} ${metadata.title}`,
        `**Platform:** ${platformInfo.platform} | **Creator:** ${metadata.uploader}`,
        `**Duration:** ${formatDuration(metadata.duration_seconds)} | **Size:** ${metadata.width}x${metadata.height} @ ${metadata.fps}fps`,
        metadata.view_count > 0 ? `**Views:** ${metadata.view_count.toLocaleString()} | **Likes:** ${metadata.like_count.toLocaleString()}` : "",
        metadata.upload_date ? `**Uploaded:** ${metadata.upload_date}` : "",
        "",
        metadata.description ? `### Description\n${metadata.description.slice(0, 500)}${metadata.description.length > 500 ? "..." : ""}` : "",
        metadata.hashtags.length > 0 ? `### Hashtags\n${metadata.hashtags.slice(0, 20).join(" ")}` : "",
        metadata.captions ? `### Captions\n${metadata.captions}` : "",
      ].filter(Boolean).join("\n");

      content.push({ type: "text", text: metaSummary });

      if (!params.skip_frames) {
        // Extract frames
        const framesDir = join(workDir, "frames");
        mkdirSync(framesDir, { recursive: true });

        let frames;
        try {
          frames = await extractFrames(videoPath, framesDir, {
            fps: effectiveFps,
            maxFrames: params.max_frames,
            startTime: params.start_time,
            endTime: params.end_time,
            resolution: params.resolution,
            format: params.format,
          });
        } catch (err: any) {
          content.push({ type: "text", text: `\n## Frame Extraction Error\n${err.message}` });
          return { content };
        }

        content.push({
          type: "text",
          text: `\n## Frames (${frames.length} extracted at ${effectiveFps} fps)\n*Claude can now analyze each frame visually.*`,
        });

        for (const frame of frames) {
          content.push({ type: "text", text: `**Frame @ ${frame.timestamp}**` });
          content.push({ type: "image", data: frame.image, mimeType: frame.mimeType });
        }
      }

      // Cleanup
      try { rmSync(workDir, { recursive: true, force: true }); } catch { /* best effort */ }

      return { content: content as any };
    },
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
