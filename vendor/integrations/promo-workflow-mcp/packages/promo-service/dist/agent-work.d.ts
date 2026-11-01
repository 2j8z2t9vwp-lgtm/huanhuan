export type AgentWorkStage = "workspace_intake" | "topic_fetch" | "baseline_alignment" | "creative_outline" | "master_development" | "production" | "release_packaging";
export interface AgentWorkCapsule {
    taskId: string;
    stage: AgentWorkStage;
    inputs: Record<string, unknown>;
    constraints: string[];
    requestedOutput: {
        description: string;
        fields: string[];
    };
    validationRules: string[];
    nextCommitKind: string;
    decisionCard?: DecisionCard | undefined;
    deliverable?: DeliverableTarget | undefined;
    guidance?: GuidanceRequest | undefined;
}
/** The human-facing part of a state-machine node. Keep this short and actionable. */
export interface DecisionCard {
    node: number;
    label: string;
    known: string[];
    recommendation: string;
    userDecision: string | null;
    whyItMatters: string;
    nextArtifact: string;
}
export interface DeliverableTarget {
    name: string;
    workspaceFile: string;
    purpose: string;
}
export declare const GUIDANCE_IDS: readonly ["article-planning-router", "editorial-problem-router", "human-language-writing", "promo-writing-supervision", "product-tweet-article-contract", "product-tweet-human-center-outline", "product-tweet-manuscript-proof", "product-tweet-visual-proof", "product-tweet-preview-review", "product-tweet-release-packaging", "promo-storyboard-supervision", "product-voiceover-campaign", "promo-deliverable-exemplars", "tim-cinematic-video-intent", "tim-cinematic-video-architecture", "tim-cinematic-video-proof-plan"];
export type GuidanceId = (typeof GUIDANCE_IDS)[number];
/** A host-installable package that supplies the focused Skill for this guide. */
export type GuidancePluginId = "promo-human-language-writing" | "promo-product-writing" | "promo-product-tweet-editor" | "promo-video-preproduction" | "promo-tim-cinematic-storycraft";
export type GuidancePriority = "high" | "normal";
export interface GuidancePolicy {
    id: GuidanceId;
    plugin: GuidancePluginId;
    priority: GuidancePriority;
    overview: string;
    loadWhen: string;
}
/**
 * A compact routing contract.  It deliberately contains no long prompt: the
 * Agent calls promo_guidance with the current workflow id to load the full,
 * MCP-owned instructions for the listed guides.
 */
export interface GuidanceRequest {
    router: "promo_guidance";
    policies: GuidancePolicy[];
}
export interface CreateAgentWorkCapsuleInput {
    stage: AgentWorkStage;
    inputs: Record<string, unknown>;
    constraints: string[];
    requestedOutput: AgentWorkCapsule["requestedOutput"];
    validationRules: string[];
    nextCommitKind: string;
    decisionCard?: DecisionCard | undefined;
    deliverable?: DeliverableTarget | undefined;
    guidance?: GuidanceRequest | undefined;
}
export declare function createAgentWorkCapsule(input: CreateAgentWorkCapsuleInput): AgentWorkCapsule;
export declare function createGuidanceRequest(ids?: readonly GuidanceId[]): GuidanceRequest;
