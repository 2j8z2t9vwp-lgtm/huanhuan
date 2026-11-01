import type { ArtifactStore } from "./artifacts/store.js";
import type { ArtifactRef } from "./artifacts/types.js";
import type { WorkflowEvent, WorkflowRecord } from "./types.js";
export interface HumanReviewPacket {
    schemaVersion: 1;
    workflowId: string;
    carrier: "video" | "article";
    requestedRevision: number;
    requestedAt: string;
    reason: string;
    requiredDecision: readonly ("approve" | "revise" | "reject")[];
    sections: Array<{
        node: number | "control";
        title: string;
        artifacts: ArtifactRef[];
    }>;
    events: WorkflowEvent[];
    markdown: string;
}
/**
 * Freezes all passed upstream material into one reader-first packet. The
 * structured artifact remains machine-traceable, while markdown is deliberately
 * translated into a decision document rather than exposing storage JSON.
 */
export declare function createHumanReviewPacket(input: {
    record: WorkflowRecord;
    artifacts: ArtifactStore;
    requestedRevision: number;
    reason: string;
}): Promise<HumanReviewPacket>;
