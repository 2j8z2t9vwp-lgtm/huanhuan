import { execFile, execFileSync } from "child_process";
import { promisify } from "util";
import { mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { tmpdir } from "os";
import type { Platform, PlatformInfo } from "./platform.js";

const execFileAsync = promisify(execFile);

export interface VideoMetadata {
  title: string;
  description: string;
  duration_seconds: number;
  uploader: string;
  upload_date: string;
  view_count: number;
  like_count: number;
  thumbnail: string;
  tags: string[];
  hashtags: string[];
  captions: string | null;
  platform: Platform;
  original_url: string;
  width: number;
  height: number;
  fps: number;
}

export interface DownloadResult {
  videoPath: string;
  metadata: VideoMetadata;
  workDir: string;
}

function ytdlpArgs(url: string, platform: PlatformInfo, outputTemplate: string): string[] {
  const args = [
    url,
    "--output", outputTemplate,
    "--no-playlist",
    "--write-info-json",
    "--no-write-thumbnail",
    "--quiet",
    "--no-warnings",
    // Format: best video+audio under 720p for speed
    "--format", "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best",
    "--merge-output-format", "mp4",
  ];

  // TikTok: remove watermark
  if (platform.platform === "tiktok") {
    args.push("--extractor-args", "tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com");
  }

  // Instagram: may need cookies if private — warn gracefully
  if (platform.platform === "instagram") {
    // yt-dlp handles public IG posts/reels natively
    args.push("--extractor-args", "instagram:api=1");
  }

  return args;
}

export async function downloadVideo(platformInfo: PlatformInfo): Promise<DownloadResult> {
  const workDir = join(tmpdir(), `svmcp-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });

  const outputTemplate = join(workDir, "%(id)s.%(ext)s");

  if (platformInfo.platform === "local") {
    // Local file — just get metadata via ffprobe
    const metadata = await getLocalMetadata(platformInfo.url, platformInfo.platform);
    return { videoPath: platformInfo.url, metadata, workDir };
  }

  const args = ytdlpArgs(platformInfo.url, platformInfo, outputTemplate);

  try {
    await execFileAsync("yt-dlp", args, {
      timeout: 120_000,
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (err: any) {
    const msg = err?.stderr || err?.message || String(err);
    throw new Error(`Download failed: ${msg.slice(0, 500)}`);
  }

  // Find downloaded video file
  const files = readdirSync(workDir).filter(f => f.endsWith(".mp4") || f.endsWith(".webm") || f.endsWith(".mkv"));
  if (files.length === 0) throw new Error("No video file found after download");
  const videoPath = join(workDir, files[0]);

  // Parse yt-dlp info JSON
  const infoFiles = readdirSync(workDir).filter(f => f.endsWith(".info.json"));
  let metadata: VideoMetadata;

  if (infoFiles.length > 0) {
    const { readFileSync } = await import("fs");
    const raw = JSON.parse(readFileSync(join(workDir, infoFiles[0]), "utf-8"));
    metadata = parseYtdlpInfo(raw, platformInfo.platform, platformInfo.url);
  } else {
    metadata = await getLocalMetadata(videoPath, platformInfo.platform);
    metadata.original_url = platformInfo.url;
  }

  return { videoPath, metadata, workDir };
}

function parseYtdlpInfo(raw: any, platform: Platform, url: string): VideoMetadata {
  const tags: string[] = raw.tags || [];
  const description: string = raw.description || "";

  // Extract hashtags from description or tags
  const hashtagsFromDesc = (description.match(/#\w+/g) || []);
  const hashtagsFromTags = tags.filter((t: string) => t.startsWith("#"));
  const allHashtags = [...new Set([...hashtagsFromDesc, ...hashtagsFromTags])];

  return {
    title: raw.title || raw.fulltitle || "Untitled",
    description: raw.description || "",
    duration_seconds: raw.duration || 0,
    uploader: raw.uploader || raw.creator || raw.channel || "Unknown",
    upload_date: raw.upload_date || "",
    view_count: raw.view_count || 0,
    like_count: raw.like_count || 0,
    thumbnail: raw.thumbnail || "",
    tags,
    hashtags: allHashtags,
    captions: extractCaptions(raw),
    platform,
    original_url: url,
    width: raw.width || 0,
    height: raw.height || 0,
    fps: raw.fps || 30,
  };
}

function extractCaptions(raw: any): string | null {
  // Try auto-captions or manual subtitles
  const subs = raw.subtitles || {};
  const autoSubs = raw.automatic_captions || {};

  const allSubs = { ...subs, ...autoSubs };
  const engSubs = allSubs["en"] || allSubs["en-US"] || allSubs["en-GB"] || Object.values(allSubs)[0];

  if (!engSubs || !Array.isArray(engSubs)) return null;

  // Find JSON3 or VTT format for text extraction
  const jsonFormat = engSubs.find((s: any) => s.ext === "json3" || s.ext === "vtt");
  if (!jsonFormat) return null;

  // Return the URL — we'll note captions are available
  return `[Captions available: ${jsonFormat.url?.slice(0, 80) || "embedded"}]`;
}

async function getLocalMetadata(videoPath: string, platform: Platform): Promise<VideoMetadata> {
  const { execFileSync } = await import("child_process");
  try {
    const result = execFileSync("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format", "-show_streams",
      videoPath,
    ], { encoding: "utf-8" });

    const probe = JSON.parse(result);
    const videoStream = probe.streams?.find((s: any) => s.codec_type === "video");
    const duration = parseFloat(probe.format?.duration || "0");

    return {
      title: videoPath.split("/").pop() || "Local Video",
      description: "",
      duration_seconds: duration,
      uploader: "Local",
      upload_date: "",
      view_count: 0,
      like_count: 0,
      thumbnail: "",
      tags: [],
      hashtags: [],
      captions: null,
      platform,
      original_url: videoPath,
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      fps: eval(videoStream?.r_frame_rate || "30/1") || 30,
    };
  } catch {
    return {
      title: videoPath.split("/").pop() || "Local Video",
      description: "", duration_seconds: 0, uploader: "Local",
      upload_date: "", view_count: 0, like_count: 0, thumbnail: "",
      tags: [], hashtags: [], captions: null,
      platform, original_url: videoPath, width: 0, height: 0, fps: 30,
    };
  }
}

export function checkDependencies(): { ytdlp: boolean; ffmpeg: boolean; errors: string[] } {
  const errors: string[] = [];
  let ytdlp = false;
  let ffmpeg = false;

  try {
    execFileSync("yt-dlp", ["--version"], { encoding: "utf-8" });
    ytdlp = true;
  } catch {
    errors.push("yt-dlp not found. Install: brew install yt-dlp (Mac) or pip install yt-dlp");
  }

  try {
    execFileSync("ffmpeg", ["-version"], { encoding: "utf-8" });
    ffmpeg = true;
  } catch {
    errors.push("ffmpeg not found. Install: brew install ffmpeg (Mac) or apt install ffmpeg");
  }

  return { ytdlp, ffmpeg, errors };
}
