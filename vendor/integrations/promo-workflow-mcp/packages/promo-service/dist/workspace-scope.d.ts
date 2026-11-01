import type { WorkflowCarrier } from "./types.js";
export declare const WORKFLOW_WORKSPACE_DIRECTORIES: readonly [{
    readonly relativePath: "00-control";
    readonly owner: "promo";
    readonly purpose: "流程状态、审核包、决策与版本控制。";
}, {
    readonly relativePath: "01-selection";
    readonly owner: "promo";
    readonly purpose: "选材、来源与匹配结果。";
}, {
    readonly relativePath: "02-campaign-intent";
    readonly owner: "promo";
    readonly purpose: "宣传意图、读者对象与表达边界。";
}, {
    readonly relativePath: "03-creative-outline";
    readonly owner: "promo";
    readonly purpose: "创意路线与锁定大纲。";
}, {
    readonly relativePath: "04-master";
    readonly owner: "promo";
    readonly purpose: "文章主稿、分镜与审校记录。";
}, {
    readonly relativePath: "05-requirements";
    readonly owner: "promo";
    readonly purpose: "素材需求、证据计划与前期执行包。";
}, {
    readonly relativePath: "06-production";
    readonly owner: "promo";
    readonly purpose: "制作单元、预览与验收结果。";
}, {
    readonly relativePath: "07-release";
    readonly owner: "promo";
    readonly purpose: "标题、封面、简介与发布包。";
}];
export declare const USER_WORKSPACE_DIRECTORIES: readonly [{
    readonly relativePath: "10-user-materials";
    readonly purpose: "用户放置可阅读的项目资料、截图、录屏和脱敏素材。";
}, {
    readonly relativePath: "11-references";
    readonly purpose: "用户明确授权给本项目使用的参考资料。";
}];
export type WorkspacePathMode = "read" | "write";
export interface WorkspaceScope {
    schemaVersion: 1;
    workflowId: string;
    carrier: WorkflowCarrier;
    root: string;
    guidePath: string;
    scopePath: string;
    userMaterialsPath: string;
    referencesPath: string;
    allowedReadRoots: readonly string[];
    allowedWriteRoots: readonly string[];
    userManagedRoots: readonly string[];
    setupConfirmed: boolean;
    setupConfirmedAt: string | null;
}
export declare function createWorkspaceScope(input: {
    workflowId: string;
    carrier: WorkflowCarrier;
    root: string;
    setupConfirmed?: boolean;
    setupConfirmedAt?: string | null;
}): WorkspaceScope;
export declare function isWorkspaceScope(value: unknown): value is WorkspaceScope;
export declare function confirmWorkspaceScope(scope: WorkspaceScope, confirmedAt: string): WorkspaceScope;
/**
 * Validates a path supplied by an Agent or user against the current workflow's
 * explicit boundary. URLs are intentionally handled by the caller because
 * they are sources, not local filesystem references.
 */
export declare function assertWorkspacePath(scope: WorkspaceScope, candidate: string, mode: WorkspacePathMode, label?: string): string;
/**
 * Walks commit context and rejects local references that escape the active
 * workflow. HTTP(S) URLs remain valid source references and are not treated as
 * filesystem paths.
 */
export declare function validateWorkspaceReferences(value: unknown, scope: WorkspaceScope, label?: string): void;
