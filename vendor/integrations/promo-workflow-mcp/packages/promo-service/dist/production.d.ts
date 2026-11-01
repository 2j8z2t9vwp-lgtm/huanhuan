import { type ArticleAssetManifest, type ArticleAssetManifestItem, type ArticleContentBlock, type ArticlePlatformBranch, type ArticleProductionArtifacts, type PendingProductionAction, type PlatformArticleDocument, type PlatformProfile, type ProductionRoute, type ProductionUnit, type ProductionUnitStatus } from "@promo-workflow/contracts";
import type { ArtifactRef } from "./artifacts/types.js";
import type { MaterialRequirement } from "./requirements-compiler.js";
export declare const PRODUCTION_ROUTES: readonly ["human", "generative", "local"];
export declare const PRODUCTION_UNIT_STATUSES: readonly ["queued", "active", "waiting_human", "review", "accepted", "needs_replan"];
export interface ProductionRouteHint {
    requirementId: string;
    route: ProductionRoute;
    dependencies?: readonly string[] | undefined;
    instruction?: string | undefined;
}
export interface CreateProductionUnitsInput {
    requirements: readonly MaterialRequirement[];
    /** Existing material that is already accepted is reused, not wrapped in a new unit. */
    acceptedSourceAssetIds?: readonly string[] | undefined;
    /** An Agent or backend can make a route choice explicit without changing the requirement. */
    routeHints?: readonly ProductionRouteHint[] | undefined;
    /** Routes actually available in this local deployment. Defaults to all lightweight routes. */
    supportedRoutes?: readonly ProductionRoute[] | undefined;
}
export interface CapabilityGap {
    requirementId: string;
    reason: string;
    availableCapabilities: readonly string[];
    preservedConstraints: readonly string[];
}
export interface ProductionUnitPlan {
    requirements?: readonly MaterialRequirement[];
    units: readonly ProductionUnit[];
    reusedRequirementIds: readonly string[];
    capabilityGaps: readonly CapabilityGap[];
}
export interface ProductionControl {
    pendingAction: PendingProductionAction | null;
    blockers: readonly string[];
    complete: boolean;
}
/**
 * Create the small production-unit view owned by Promo. It deliberately does
 * not model renderer jobs, video timelines, or editorial application state.
 */
export declare function createProductionUnitPlan(input: CreateProductionUnitsInput): ProductionUnitPlan;
/** Enforces the intentionally small, monotonic unit lifecycle. */
export declare function transitionProductionUnit(unit: ProductionUnit, nextStatus: ProductionUnitStatus): ProductionUnit;
/**
 * Derives the single user-facing action and blockers from an otherwise
 * backend-owned set of units. Agent/local work is intentionally not exposed
 * as a human action.
 */
export declare function getProductionControl(units: readonly ProductionUnit[], instructions?: Readonly<Record<string, string>>): ProductionControl;
export interface ArticleReviewInput {
    units: readonly ProductionUnit[];
    document: PlatformArticleDocument;
    manifest: ArticleAssetManifest;
    hardConstraintFailures?: readonly string[] | undefined;
    semanticDrift?: readonly string[] | undefined;
    uncertainty?: Partial<Record<ArticleReviewTrigger, boolean>> | undefined;
    previewAccepted: boolean;
}
export declare const ARTICLE_REVIEW_TRIGGERS: readonly ["product_identity", "people", "brand_expression", "ai_authenticity", "factual_evidence", "paid_generation", "new_human_capture"];
export type ArticleReviewTrigger = (typeof ARTICLE_REVIEW_TRIGGERS)[number];
export interface ArticleReviewGate {
    pendingAction: PendingProductionAction | null;
    blockers: readonly string[];
    canLock: boolean;
}
/**
 * The complete preview review is mandatory. Risk triggers only make the
 * review instruction more explicit; they never add a second user action.
 */
export declare function getArticleReviewGate(input: ArticleReviewInput): ArticleReviewGate;
export interface CreateArticleDocumentInput {
    id: string;
    revision: number;
    branch: ArticlePlatformBranch;
    blocks: readonly ArticleContentBlock[];
    createdAt: string;
}
export declare function createArticleDocument(input: CreateArticleDocumentInput): PlatformArticleDocument;
export declare function createArticleAssetManifest(document: PlatformArticleDocument, items: readonly ArticleAssetManifestItem[]): ArticleAssetManifest;
export interface ArticlePreviewAnalogue {
    schemaVersion: 1;
    documentId: string;
    documentRevision: number;
    platform: string;
    profileId: string;
    profileVersion: string;
    renderPresetId: string;
    html: string;
}
/** Builds a portable local review surface, deliberately not a platform clone. */
export declare function renderArticlePreview(document: PlatformArticleDocument, profile: PlatformProfile): ArticlePreviewAnalogue;
export interface CreateArticleProductionArtifactsInput {
    documentArtifact: ArtifactRef;
    previewArtifact: ArtifactRef;
    assetManifestArtifact: ArtifactRef;
    documentRevision: number;
    previewDocumentRevision: number;
    assetManifestDocumentRevision: number;
}
/** Validates the three immutable Article Assembler outputs as one revision. */
export declare function createArticleProductionArtifacts(input: CreateArticleProductionArtifactsInput): ArticleProductionArtifacts;
