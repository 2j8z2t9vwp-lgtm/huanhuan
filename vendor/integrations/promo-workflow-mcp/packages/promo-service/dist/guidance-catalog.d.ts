import type { GuidanceId } from "./agent-work.js";
import { type EditorialIssueCode } from "./editorial-problem-guidance.js";
import { type ArticlePlanningIssueCode } from "./article-planning-guidance.js";
export interface GuidanceResource {
    id: string;
    title: string;
    content: string;
}
export interface GuidanceGuide {
    id: GuidanceId;
    title: string;
    /** Canonical full skill text, not a condensed prompt summary. */
    content: string;
    resources: readonly GuidanceResource[];
}
export declare function loadGuidance(ids: readonly GuidanceId[], options?: {
    issueCodes?: readonly EditorialIssueCode[];
    planningIssueCodes?: readonly ArticlePlanningIssueCode[];
}): GuidanceGuide[];
