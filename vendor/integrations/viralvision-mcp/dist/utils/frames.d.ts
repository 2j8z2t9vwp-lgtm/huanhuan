export interface Frame {
    timestamp: string;
    image: string;
    mimeType: string;
}
export interface ExtractFramesOptions {
    fps: number;
    maxFrames?: number;
    startTime?: string;
    endTime?: string;
    resolution?: number;
    format?: "jpeg" | "webp";
}
export declare function extractFrames(videoPath: string, outputDir: string, opts: ExtractFramesOptions): Promise<Frame[]>;
