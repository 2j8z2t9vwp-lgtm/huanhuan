import type { ArtifactStore } from "./artifacts/store.js";
import type { ArtifactKind, ArtifactRef } from "./artifacts/types.js";
import { type WorkspaceScope } from "./workspace-scope.js";
export interface WorkspaceDeliverableRef {
    artifactId: string;
    kind: ArtifactKind;
    path: string;
    versionPath: string;
}
export interface SyncWorkflowWorkspaceInput {
    workflowId: string;
    carrier: "video" | "article";
    displayName?: string | undefined;
    rootDirectory?: string | undefined;
    state: string;
    revision: number;
    summary: string;
    artifactRefs: readonly ArtifactRef[];
    workspaceScope?: WorkspaceScope | undefined;
}
/**
 * Projects immutable internal artifacts into stable, human-readable workspace
 * paths. Agents can load the current file by name; the version file preserves
 * the exact revision that produced it.
 */
export declare class WorkspaceDeliverables {
    private readonly directory;
    private readonly artifacts;
    constructor(directory: string, artifacts: ArtifactStore);
    /** Returns the stable root for a legacy workflow that predates the gate. */
    scopeFor(workflowId: string, carrier: "video" | "article"): WorkspaceScope;
    /** Creates the per-workflow directory contract before any content node runs. */
    initialize(input: {
        workflowId: string;
        carrier: "video" | "article";
    }): Promise<WorkspaceScope>;
    /** Remove generated deliverables from one content node onward. User-owned
     * reference directories remain outside this operation. */
    clearFromNode(workflowId: string, node: number): Promise<void>;
    /** Move generated current views out of the active lineage before a rollback.
     * Immutable artifact records remain in the artifact store; this preserves the
     * exact pre-rollback workspace projection for later inspection or restore. */
    archiveFromNode(workflowId: string, node: number, archiveId: string): Promise<void>;
    sync(input: SyncWorkflowWorkspaceInput): Promise<WorkspaceDeliverableRef[]>;
    private ensureLayout;
    private writeGuide;
    private writeUserGuides;
}
