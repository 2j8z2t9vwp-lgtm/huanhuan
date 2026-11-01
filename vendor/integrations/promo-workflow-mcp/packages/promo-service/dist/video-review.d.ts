import type { VideoPreview, VideoReviewState, VideoSelection } from "@promo-workflow/contracts";
export declare function videoReviewFor(state?: VideoReviewState): VideoReviewState;
export declare function validateVideoPreview(preview: VideoPreview): void;
export declare function mergeVideoPreviews(state: VideoReviewState, previews: readonly VideoPreview[], currentPreviewId: string | null): VideoReviewState;
export declare function changeVideoAnnotation(state: VideoReviewState, input: Record<string, unknown>, allowedUnitIds: readonly string[]): VideoReviewState;
export declare function validateSelections(value: unknown, durationMs: number): VideoSelection[];
