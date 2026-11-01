import type { ContentMaster, MasterReview } from "@promo-workflow/contracts";
export declare const EDITORIAL_CHECK_IDS: readonly ["paragraph_contribution", "adjacency_basis", "narrative_claims", "objection_targets", "reader_prerequisites"];
export interface EditorialLoopBase {
    artifactId: string;
    master: ContentMaster;
}
export declare function validateEditorialLoop(review: Pick<MasterReview, "passed" | "editorialDiagnostic">, master: ContentMaster, base?: EditorialLoopBase): void;
