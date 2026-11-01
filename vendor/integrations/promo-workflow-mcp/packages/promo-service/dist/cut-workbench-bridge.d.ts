import type { ProductionUnitStatus, VideoContentBudget, VideoTimelineMaster } from "@promo-workflow/contracts";
import type { CompiledRequirementSet } from "./requirements-compiler.js";
/**
 * The only master shape this bridge accepts.  It deliberately exposes no
 * Cut Workbench job, editor, or generation-provider details.
 */
export interface LockedVideoMaster {
    topicId: string;
    budget: VideoContentBudget;
    master: VideoTimelineMaster;
    confirmedAt: string;
}
/** A durable result already accepted through Promo's production-unit control plane. */
export interface AcceptedProductionResult {
    unitId: string;
    artifactIds: readonly string[];
    provenance: string;
}
export interface CutWorkbenchBridgeInput {
    productionControl?: {
        phase: string;
        round: number;
        tasks: readonly import('./video-production.js').VideoProductionTask[];
        instruction: string;
    } | undefined;
    mediaAssets?: readonly import("./video-materials.js").VideoMaterial[];
    materialBlockers?: readonly string[];
    videoAnnotations?: readonly import("@promo-workflow/contracts").VideoAnnotation[];
    lockedMaster: LockedVideoMaster;
    requirementSet: CompiledRequirementSet;
    acceptedProductionResults: readonly AcceptedProductionResult[];
}
export interface CutWorkbenchUnitStatus {
    unitId: string;
    status: ProductionUnitStatus;
}
export interface CutWorkbenchFinalGate {
    passed: boolean;
    blockers: readonly string[];
    verifiedAt: string | null;
}
export interface CutWorkbenchProductionResult {
    annotationUpdates?: readonly {
        id: string;
        status: string;
        targetPreviewId?: string;
        reply?: string;
    }[];
    protocolId?: "cut-production-v2";
    previews?: readonly import("@promo-workflow/contracts").VideoPreview[];
    currentPreviewId?: string | null;
    kind: "production_result";
    projectId: string;
    revision: number;
    unitStatuses: readonly CutWorkbenchUnitStatus[];
    verifiedOutputArtifactIds: readonly string[];
    finalSubtitleArtifactId: string | null;
    finalGate: CutWorkbenchFinalGate;
}
/**
 * A capability gap is an expected, explicit result on machines without a
 * compatible Cut Workbench bridge.  It is not a successful production result.
 */
export interface CutWorkbenchCapabilityGap {
    kind: "capability_gap";
    capability: "cut_workbench";
    reason: string;
    remediation: string;
}
export type CutWorkbenchBridgeResult = CutWorkbenchProductionResult | CutWorkbenchCapabilityGap;
export interface CutWorkbenchBridge {
    run(input: CutWorkbenchBridgeInput): Promise<CutWorkbenchBridgeResult>;
}
/**
 * Safe default for a lightweight Promo installation.  It runs no process,
 * does not inspect local projects, and never invents a Cut Workbench project
 * or render output.
 */
export declare class UnavailableCutWorkbenchBridge implements CutWorkbenchBridge {
    run(_input: CutWorkbenchBridgeInput): Promise<CutWorkbenchCapabilityGap>;
}
export declare const unavailableCutWorkbenchBridge: CutWorkbenchBridge;
/**
 * Wraps a configured bridge with the minimal input/output checks Promo needs.
 * A real integration can be replaced by a test fake without importing any
 * Cut Workbench dependency into this package.
 */
export declare function runCutWorkbenchBridge(bridge: CutWorkbenchBridge, input: CutWorkbenchBridgeInput): Promise<CutWorkbenchBridgeResult>;
export declare function assertCutWorkbenchBridgeInput(input: CutWorkbenchBridgeInput): void;
export declare function assertCutWorkbenchBridgeResult(result: CutWorkbenchBridgeResult): void;
