import { z } from "zod";
import { execFileAsync } from "../utils/exec.js";
import { rmSync, mkdirSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { detectPlatform, getPlatformEmoji } from "../utils/platform.js";

export function registerTranscript(server: McpServer): void {
  server.tool(
    "vv_transcript",
    "Extract the transcript/captions from a YouTube, TikTok, or Instagram video WITHOUT downloading the full video file. Returns the full text with timestamps. Much faster than vv_watch — no video download needed. Great for summarizing long videos, extracting quotes, or analyzing what was said.",
    {
      url: z.string().describe("YouTube URL, TikTok URL, or other supported URL"),
      language: z.string().default("en").describe("Language code for captions (default: en)"),
      include_timestamps: z.boolean().default(true).describe("Include timestamps in output"),
    },
    async (params) => {
      const platformInfo = detectPlatform(params.url);
      const emoji = getPlatformEmoji(platformInfo.platform);

      const workDir = join(tmpdir(), `svt-${Date.now()}`);
      mkdirSync(workDir, { recursive: true });

      try {
        // Try to get auto-captions first, then manual
        await execFileAsync("yt-dlp", [
          params.url,
          "--skip-download",
          "--write-auto-subs",
          "--write-subs",
          "--sub-langs", params.language,
          "--sub-format", "vtt",
          "--output", join(workDir, "video"),
          "--quiet",
          "--no-warnings",
        ], {
          timeout: 30_000,
          maxBuffer: 10 * 1024 * 1024,
        });

        const files = readdirSync(workDir).filter(f => f.endsWith(".vtt"));

        if (files.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: `## ${emoji} No Transcript Found\n\n**URL:** ${params.url}\n**Platform:** ${platformInfo.platform}\n\nNo captions or auto-captions found in language: ${params.language}\n\n**Try:** Using \`vv_watch\` to extract frames and analyze the video visually instead.`,
            }],
          };
        }

        const vttContent = readFileSync(join(workDir, files[0]), "utf-8");
        const transcript = parseVTT(vttContent, params.include_timestamps);

        const wordCount = transcript.replace(/\[\d{2}:\d{2}:\d{2}\]/g, "").split(/\s+/).length;

        return {
          content: [{
            type: "text" as const,
            text: `## ${emoji} Transcript\n\n**URL:** ${params.url}\n**Word count:** ~${wordCount} words\n**Language:** ${params.language}\n\n---\n\n${transcript}`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `## ${emoji} Transcript Failed\n\n**URL:** ${params.url}\n**Error:** ${err?.stderr?.slice(0, 300) || err?.message}\n\n**Tips:**\n- YouTube videos need auto-captions enabled by the creator\n- TikTok auto-captions are often available\n- Use \`vv_watch\` to analyze the video visually if no transcript is available`,
          }],
        };
      } finally {
        try { rmSync(workDir, { recursive: true, force: true }); } catch { /* best effort */ }
      }
    },
  );
}

function parseVTT(vtt: string, includeTimestamps: boolean): string {
  const lines = vtt.split("\n");
  const segments: { time: string; text: string }[] = [];
  let currentTime = "";
  let currentText: string[] = [];

  for (const line of lines) {
    // Timestamp line: 00:00:01.000 --> 00:00:04.000
    const tsMatch = line.match(/^(\d{2}:\d{2}:\d{2})\.\d{3} --> /);
    if (tsMatch) {
      if (currentText.length > 0) {
        segments.push({ time: currentTime, text: currentText.join(" ") });
      }
      currentTime = tsMatch[1];
      currentText = [];
      continue;
    }

    // Skip WEBVTT header, NOTE lines, empty lines
    if (line.startsWith("WEBVTT") || line.startsWith("NOTE") || line.trim() === "" || line.match(/^\d+$/)) {
      continue;
    }

    // Remove VTT tags like <c>, </c>, <00:00:01.000>
    const cleanLine = line.replace(/<[^>]+>/g, "").trim();
    if (cleanLine) currentText.push(cleanLine);
  }

  if (currentText.length > 0) {
    segments.push({ time: currentTime, text: currentText.join(" ") });
  }

  // Deduplicate consecutive identical text (VTT often has overlapping captions)
  const deduped: { time: string; text: string }[] = [];
  for (const seg of segments) {
    const last = deduped[deduped.length - 1];
    if (!last || !last.text.endsWith(seg.text)) {
      deduped.push(seg);
    }
  }

  if (includeTimestamps) {
    return deduped.map(s => `[${s.time}] ${s.text}`).join("\n");
  }
  return deduped.map(s => s.text).join(" ");
}
