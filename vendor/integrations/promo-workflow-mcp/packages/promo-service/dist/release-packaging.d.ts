import type { ProductionLockedCapsule } from "@promo-workflow/contracts";
import { type AgentWorkCapsule } from "./agent-work.js";
/**
 * A release claim is deliberately linked to production evidence rather than
 * asking the service to infer whether marketing wording is true.  Semantic
 * review stays with the Agent/user; this module makes the evidence boundary
 * mechanically auditable.
 */
export interface ReleaseEvidenceSource {
    artifactId: string;
    description: string;
}
export interface ReleaseTitleDraft {
    id: string;
    title: string;
    sourceArtifactIds: readonly string[];
}
export interface ReleaseCoverDraft {
    id: string;
    artifactId: string;
    sourceArtifactIds: readonly string[];
    brief: string;
}
export interface ReleaseTextDraft {
    text: string;
    sourceArtifactIds: readonly string[];
}
export interface VideoReleasePackagingDraft {
    carrier: "video";
    titleCandidates: readonly ReleaseTitleDraft[];
    coverCandidates: readonly ReleaseCoverDraft[];
    introductionDraft: ReleaseTextDraft;
}
export interface ArticleReleasePackagingDraft {
    carrier: "article";
    titleCandidates: readonly ReleaseTitleDraft[];
    coverCandidates: readonly ReleaseCoverDraft[];
    summaryDraft: ReleaseTextDraft;
}
export type ReleasePackagingDraft = VideoReleasePackagingDraft | ArticleReleasePackagingDraft;
export interface CreateReleasePackagingBriefInput {
    production: ProductionLockedCapsule;
    evidenceSources: readonly ReleaseEvidenceSource[];
    platformContext?: unknown;
}
export interface ReleasePackagingValidationInput {
    /** Extra evidence is allowed only when it was explicitly provided to the capsule. */
    allowedEvidenceArtifactIds?: readonly string[];
}
export interface ReleasePackagingValidation {
    passed: boolean;
    errors: readonly string[];
    warnings: readonly string[];
}
/**
 * Creates the final soft-work request.  The server never generates covers or
 * marketing copy; it gives the host a small, evidence-bounded target shape.
 */
export declare function createReleasePackagingBrief(input: CreateReleasePackagingBriefInput): AgentWorkCapsule;
/** Parses untrusted Agent output into the carrier-specific release draft. */
export declare function readReleasePackagingDraft(value: unknown): ReleasePackagingDraft;
/**
 * Applies only deterministic guards.  It cannot prove a claim true, but it
 * rejects candidates whose supplied lineage is absent, empty, or foreign.
 */
export declare function validateReleasePackagingDraft(draft: ReleasePackagingDraft, input?: ReleasePackagingValidationInput): ReleasePackagingValidation;
/** Returns the evidence artifacts directly produced by the locked Node 6 branch. */
export declare function getProductionArtifactIds(production: ProductionLockedCapsule): readonly string[];
