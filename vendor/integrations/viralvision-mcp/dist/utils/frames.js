import { execFileAsync } from "./exec.js";
import { mkdirSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
export async function extractFrames(videoPath, outputDir, opts) {
    mkdirSync(outputDir, { recursive: true });
    const fps = opts.fps;
    const format = opts.format || "jpeg";
    const ext = format === "webp" ? "webp" : "jpg";
    const mimeType = format === "webp" ? "image/webp" : "image/jpeg";
    const maxFrames = opts.maxFrames || 60;
    const resolution = opts.resolution || 720;
    const ffmpegArgs = ["-i", videoPath];
    if (opts.startTime)
        ffmpegArgs.push("-ss", opts.startTime);
    if (opts.endTime)
        ffmpegArgs.push("-to", opts.endTime);
    const vfFilters = [
        `fps=${fps}`,
        `scale=${resolution}:-2:flags=lanczos`,
    ];
    if (format === "jpeg") {
        ffmpegArgs.push("-vf", vfFilters.join(","), "-q:v", "3", "-frames:v", String(maxFrames), join(outputDir, `frame_%05d.${ext}`));
    }
    else {
        ffmpegArgs.push("-vf", vfFilters.join(","), "-frames:v", String(maxFrames), join(outputDir, `frame_%05d.${ext}`));
    }
    ffmpegArgs.push("-hide_banner", "-loglevel", "error");
    try {
        await execFileAsync("ffmpeg", ffmpegArgs, {
            timeout: 120_000,
            maxBuffer: 200 * 1024 * 1024,
        });
    }
    catch (err) {
        throw new Error(`Frame extraction failed: ${err?.message || String(err)}`);
    }
    // Read frames and build timestamps
    const frameFiles = readdirSync(outputDir)
        .filter(f => f.startsWith("frame_") && f.endsWith(`.${ext}`))
        .sort();
    const secondsPerFrame = 1 / fps;
    const startOffset = opts.startTime ? parseTimestamp(opts.startTime) : 0;
    return frameFiles.map((file, idx) => {
        const seconds = startOffset + idx * secondsPerFrame;
        const timestamp = formatTimestamp(seconds);
        const imageData = readFileSync(join(outputDir, file));
        return {
            timestamp,
            image: imageData.toString("base64"),
            mimeType,
        };
    });
}
function parseTimestamp(ts) {
    const parts = ts.split(":").map(Number);
    if (parts.length === 3)
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2)
        return parts[0] * 60 + parts[1];
    return parts[0];
}
function formatTimestamp(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
