import { type CarrierOutline, type ContentBudget, type CreativeRoute, type CreativeSpine, type MacroStyleReview, type PositioningBaseline } from "@promo-workflow/contracts";
import { type AgentWorkCapsule } from "./agent-work.js";
export interface CreateCreativeOutlineBriefInput {
    topicId: string;
    baseline: PositioningBaseline;
    selectedMaterials: readonly string[];
    productProfile: unknown;
    budget: ContentBudget;
    selectedRoute: CreativeRoute;
    recommendedStoryEngine?: string | undefined;
    priorDraft?: CreativeOutlineDraft | undefined;
    latestDecision?: Record<string, unknown> | undefined;
}
export interface CreativeOutlineDraft {
    selectedRouteId: string;
    creativeSpine: CreativeSpine;
    outline: CarrierOutline;
    macroStyleReview: MacroStyleReview;
    pendingQuestion: import("@promo-workflow/contracts").ScenarioGrillQuestion | null;
    incorporatesDecisionIds: readonly string[];
}
/**
 * The upper end of the agreed question range is the hard Grill cap.  This is
 * deliberately a pure calculation: the state machine owns the count.
 */
export declare function getOutlineGrillCap(budget: ContentBudget): number;
export declare function canAskOutlineGrillQuestion(answeredQuestionCount: number, budget: ContentBudget): boolean;
export declare function assertOutlineGrillCapacity(answeredQuestionCount: number, budget: ContentBudget): void;
export declare function createCreativeOutlineBrief(input: CreateCreativeOutlineBriefInput): AgentWorkCapsule;
/** Parses unknown Agent output into the shared contract and rejects invalid structure. */
export declare function readCreativeOutlineDraft(value: unknown, budget: ContentBudget): CreativeOutlineDraft;
