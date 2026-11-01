export const WORKFLOW_STATES = [
    "NEEDS_PROFILE",
    "READY",
    "FETCHING",
    "MATCHING",
    "AWAITING_SELECTION",
    "TOPIC_LOCKED",
    "ALIGNING_BASELINE",
    "BASELINE_LOCKED",
    "GENERATING_CREATIVE",
    "ALIGNING_OUTLINE",
    "OUTLINE_LOCKED",
    "GENERATING_MASTER",
    "ALIGNING_MASTER",
    "MASTER_LOCKED",
    "COMPILING_REQUIREMENTS",
    "REQUIREMENTS_READY",
    "AWAITING_HUMAN_REVIEW",
    "REJECTED",
    "PRODUCING",
    "PRODUCTION_LOCKED",
    "PACKAGING",
    "RELEASE_READY",
];
export const STORY_ENGINE_SUGGESTIONS = [
    "single-task-evidence-chain",
    "before-after-workflow",
    "stress-test-ladder",
    "engineering-origin-story",
];
export const CONTENT_BUDGETS = {
    video: {
        short: {
            carrier: "video",
            tier: "short",
            targetMinutes: 2,
            targetDurationSeconds: 120,
            beatRange: [4, 4],
            targetGrillQuestionRange: [2, 3],
        },
        standard: {
            carrier: "video",
            tier: "standard",
            targetMinutes: 5,
            targetDurationSeconds: 300,
            beatRange: [5, 7],
            targetGrillQuestionRange: [3, 5],
        },
        long: {
            carrier: "video",
            tier: "long",
            targetMinutes: 10,
            targetDurationSeconds: 600,
            beatRange: [7, 8],
            targetGrillQuestionRange: [4, 6],
        },
    },
    article: {
        short: {
            carrier: "article",
            tier: "short",
            targetChineseCharacterRange: [800, 1500],
            beatRange: [4, 4],
            targetGrillQuestionRange: [2, 3],
        },
        standard: {
            carrier: "article",
            tier: "standard",
            targetChineseCharacterRange: [2000, 3500],
            beatRange: [5, 7],
            targetGrillQuestionRange: [3, 5],
        },
        long: {
            carrier: "article",
            tier: "long",
            targetChineseCharacterRange: [4000, 6000],
            beatRange: [7, 8],
            targetGrillQuestionRange: [4, 6],
        },
    },
};
export const MASTER_GRILL_LIMITS = {
    short: 2,
    standard: 3,
    long: 4,
};
//# sourceMappingURL=workflow.js.map