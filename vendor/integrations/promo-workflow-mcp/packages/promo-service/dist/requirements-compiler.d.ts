import type { SourceAssetCaptureProtocol } from "@promo-workflow/contracts";
export type RequirementCarrier = "video" | "article";
/**
 * The deliberately small hand-off from Node 4's shared asset plan.  A usage
 * describes why a source asset (or one of its fragments) is needed; it does
 * not prescribe who or which tool will produce it.
 */
export interface MasterAssetUsage {
    captureProtocol?: SourceAssetCaptureProtocol;
    usageId: string;
    sourceAssetId: string;
    materialType: string;
    purpose: string;
    fragmentId?: string | undefined;
    constraints?: string[] | undefined;
    startMs?: number | undefined;
    endMs?: number | undefined;
    spokenText?: string | undefined;
    oneOffJustification?: string | undefined;
}
export interface CompileRequirementsInput {
    carrier: RequirementCarrier;
    assetUsages: MasterAssetUsage[];
    /** Required for video so subtitle bounds can be proven locally. */
    videoDurationMs?: number | undefined;
}
export interface RequirementUsage {
    usageId: string;
    fragmentId?: string | undefined;
    purpose: string;
    startMs?: number | undefined;
    endMs?: number | undefined;
    oneOffJustification?: string | undefined;
}
/** A tool-neutral material request. One requirement may explicitly cover many usages. */
export interface MaterialRequirement {
    captureProtocol?: SourceAssetCaptureProtocol;
    productionProcedure?: string;
    requirementId: string;
    sourceAssetId: string;
    materialType: string;
    constraints: string[];
    usages: RequirementUsage[];
    coverageUsageIds: string[];
    reuseCount: number;
}
export interface SubtitleCue {
    cueId: string;
    sourceUsageId: string;
    startMs: number;
    endMs: number;
    text: string;
}
export interface VideoSubtitles {
    cues: SubtitleCue[];
    srt: string;
}
export interface CompiledRequirementSet {
    schemaVersion: 1;
    carrier: RequirementCarrier;
    inputUsageIds: string[];
    requirements: MaterialRequirement[];
    subtitles?: VideoSubtitles | undefined;
}
/**
 * Compiles Node 4's asset usage plan into the smallest compatible local
 * requirement set. The result is stable for semantically equivalent input:
 * grouping and output ordering do not depend on the incoming array order.
 */
export declare function compileRequirements(input: CompileRequirementsInput): CompiledRequirementSet;
/** Throws when a compiled result omits or double-covers a master usage. */
export declare function validateRequirementCoverage(assetUsages: readonly Pick<MasterAssetUsage, "usageId">[], requirements: readonly Pick<MaterialRequirement, "requirementId" | "coverageUsageIds">[]): void;
/** Throws when an SRT plan is not ordered, non-overlapping, or in duration bounds. */
export declare function validateSubtitles(subtitles: VideoSubtitles, videoDurationMs: number): void;
export declare function serializeSrt(cues: readonly SubtitleCue[]): string;
