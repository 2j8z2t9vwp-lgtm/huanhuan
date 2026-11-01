export type Platform = "youtube" | "instagram" | "tiktok" | "twitter" | "facebook" | "reddit" | "local" | "other";
export interface PlatformInfo {
    platform: Platform;
    url: string;
    videoId?: string;
    username?: string;
    isShortForm: boolean;
    isStory: boolean;
}
export declare function detectPlatform(input: string): PlatformInfo;
export declare function getPlatformEmoji(platform: Platform): string;
export declare function getOptimalFps(info: PlatformInfo, durationSeconds: number): number;
