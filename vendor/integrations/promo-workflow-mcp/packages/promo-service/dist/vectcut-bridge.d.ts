import type { LockedVideoMaster, AcceptedProductionResult } from "./cut-workbench-bridge.js";
import type { CompiledRequirementSet } from "./requirements-compiler.js";
/**
 * A concrete source supplied by the production plane for one locked asset
 * usage.  Promo deliberately passes URLs only: fetching, upload, and local
 * editor setup remain outside the workflow state machine.
 */
export interface VectCutMediaSource {
    usageId: string;
    videoUrl: string;
    sourceStartSeconds?: number;
    sourceEndSeconds?: number;
}
export interface VectCutBridgeInput {
    lockedMaster: LockedVideoMaster;
    requirementSet: CompiledRequirementSet;
    acceptedProductionResults: readonly AcceptedProductionResult[];
    mediaSources: readonly VectCutMediaSource[];
}
export interface VectCutDraftReference {
    draftId: string;
    draftUrl: string | null;
    revision: number;
}
export interface VectCutDraftResult {
    kind: "draft_result";
    reference: VectCutDraftReference;
    importedUsageIds: readonly string[];
    subtitleImported: boolean;
    savedAt: string;
}
export interface VectCutCapabilityGap {
    kind: "capability_gap";
    capability: "vectcut";
    reason: string;
    remediation: string;
}
export type VectCutBridgeResult = VectCutDraftResult | VectCutCapabilityGap;
export interface VectCutBridge {
    run(input: VectCutBridgeInput): Promise<VectCutBridgeResult>;
}
/** Safe default: the optional local VectCut service is never started by Promo. */
export declare class UnavailableVectCutBridge implements VectCutBridge {
    run(_input: VectCutBridgeInput): Promise<VectCutCapabilityGap>;
}
export declare const unavailableVectCutBridge: VectCutBridge;
export interface VectCutHttpBridgeOptions {
    baseUrl: string;
    width?: number;
    height?: number;
    fetch?: typeof globalThis.fetch;
}
/**
 * Minimal HTTP adapter for the public VectCut API.  It creates an editable
 * CapCut/JianYing draft; it never represents the draft as an exported video.
 */
export declare class VectCutHttpBridge implements VectCutBridge {
    private readonly baseUrl;
    private readonly width;
    private readonly height;
    private readonly request;
    constructor(options: VectCutHttpBridgeOptions);
    run(input: VectCutBridgeInput): Promise<VectCutDraftResult>;
    private post;
}
export declare function runVectCutBridge(bridge: VectCutBridge, input: VectCutBridgeInput): Promise<VectCutBridgeResult>;
export declare function assertVectCutBridgeInput(input: VectCutBridgeInput): void;
export declare function assertVectCutBridgeResult(result: VectCutBridgeResult): void;
