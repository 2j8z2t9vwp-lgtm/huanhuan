import type { Platform, PlatformInfo } from "./platform.js";
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
export declare function downloadVideo(platformInfo: PlatformInfo): Promise<DownloadResult>;
export declare function checkDependencies(): {
    ytdlp: boolean;
    ffmpeg: boolean;
    errors: string[];
};
