import type { ArticleAssetManifest, ArticleAssetRoute, ArticleAssemblerReference, ArticleManuscriptMaster, ArticlePlatformBranch, PlatformArticleDocument, PlatformProfile } from "@promo-workflow/contracts";
import { type ArticlePreviewAnalogue } from "./production.js";
/**
 * A concrete, reviewed material result for exactly one Node 4 article usage.
 * Its source artifacts are retained in the manifest; Promo does not need to
 * know whether the material came from a human, a generator, or a local step.
 */
export interface AcceptedArticleAssetResult {
    assetUsageId: string;
    assetId: string;
    route: ArticleAssetRoute;
    sourceArtifactIds: readonly string[];
}
export interface BuildArticleAssemblerOutputInput {
    /** Immutable Node 4 content master. */
    master: ArticleManuscriptMaster;
    /** Must be the locked master revision named by the branch. */
    masterArtifactId: string;
    platformProfile: PlatformProfile;
    branch: ArticlePlatformBranch;
    acceptedAssets: readonly AcceptedArticleAssetResult[];
    documentId: string;
    documentRevision: number;
    createdAt: string;
}
/** The three JSON-ready contents that the workflow later writes as artifacts. */
export interface ArticleAssemblerOutput {
    reference: ArticleAssemblerReference;
    document: PlatformArticleDocument;
    assetManifest: ArticleAssetManifest;
    preview: ArticlePreviewAnalogue;
}
/**
 * Builds the lightweight article backend output with no renderer or platform
 * API. Existing production primitives remain the single source of truth for
 * document, manifest, platform-profile, and preview validation.
 */
export declare function buildArticleAssemblerOutput(input: BuildArticleAssemblerOutputInput): ArticleAssemblerOutput;
/** Builds the narrow, stable reference Promo stores in its production capsule. */
export declare function createArticleAssemblerReference(branch: ArticlePlatformBranch, revision: number): ArticleAssemblerReference;
