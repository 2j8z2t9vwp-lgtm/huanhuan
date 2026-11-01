import type { SelectionEngine, TopicFetchBrief, TopicMatchRun } from "./types.js";
export declare class TopicMatchingEngine implements SelectionEngine {
    run(context: Record<string, unknown>): Promise<TopicMatchRun>;
}
export declare function createFetchBrief(context: Record<string, unknown>): TopicFetchBrief;
