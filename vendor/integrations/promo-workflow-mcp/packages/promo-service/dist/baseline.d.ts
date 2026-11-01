import type { ArticleEditorialIntent, CampaignIntentCard, ScenarioGrillQuestion } from "@promo-workflow/contracts";
import { type AgentWorkCapsule } from "./agent-work.js";
import type { TopicCandidate } from "./selection/types.js";
export interface BaselineProposal {
    coreMessage: string;
    guidanceIntent: string;
    campaignIntent: CampaignIntentCard;
    articleEditorialIntent?: ArticleEditorialIntent | undefined;
    pendingQuestion?: ScenarioGrillQuestion | undefined;
    incorporatesDecisionIds: readonly string[];
}
export interface CreateBaselineBriefInput {
    carrier: "video" | "article";
    topic: TopicCandidate;
    productProfile: unknown;
    selectedMaterials: unknown;
}
export declare function createBaselineBrief(input: CreateBaselineBriefInput): AgentWorkCapsule;
export declare function readBaselineProposal(value: unknown): BaselineProposal;
