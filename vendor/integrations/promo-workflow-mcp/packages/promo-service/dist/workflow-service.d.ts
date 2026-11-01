import { type GuidanceId } from "./agent-work.js";
import { type EditorialIssueCode } from "./editorial-problem-guidance.js";
import { type ArticlePlanningIssueCode } from "./article-planning-guidance.js";
import { ArtifactStore } from "./artifacts/store.js";
import type { ArtifactKind } from "./artifacts/types.js";
import { type CutWorkbenchBridge } from "./cut-workbench-bridge.js";
import { type VectCutBridge } from "./vectcut-bridge.js";
import type { SelectionEngine } from "./selection/types.js";
import { JsonWorkflowStore } from "./store.js";
import { WorkspaceDeliverables } from "./workspace-deliverables.js";
import type { WorkflowCarrier, WorkflowSnapshot } from "./types.js";
declare const COMMIT_TRANSITIONS: {
    readonly submit_fetched_topics: {
        readonly from: "FETCHING";
        readonly to: "MATCHING";
        readonly event: "fetched_topics_submitted";
    };
    readonly select_topic: {
        readonly from: "AWAITING_SELECTION";
        readonly to: "TOPIC_LOCKED";
        readonly event: "topic_selected";
    };
    readonly propose_baseline: {
        readonly from: "ALIGNING_BASELINE";
        readonly to: "ALIGNING_BASELINE";
        readonly event: "baseline_proposed";
    };
    readonly answer_baseline_grill: {
        readonly from: "ALIGNING_BASELINE";
        readonly to: "ALIGNING_BASELINE";
        readonly event: "baseline_grill_answered";
    };
    readonly lock_baseline: {
        readonly from: "ALIGNING_BASELINE";
        readonly to: "BASELINE_LOCKED";
        readonly event: "baseline_locked";
    };
    readonly propose_creative_routes: {
        readonly from: "ALIGNING_OUTLINE";
        readonly to: "ALIGNING_OUTLINE";
        readonly event: "creative_routes_proposed";
    };
    readonly select_creative_route: {
        readonly from: "ALIGNING_OUTLINE";
        readonly to: "ALIGNING_OUTLINE";
        readonly event: "creative_route_selected";
    };
    readonly submit_outline_draft: {
        readonly from: "ALIGNING_OUTLINE";
        readonly to: "ALIGNING_OUTLINE";
        readonly event: "outline_draft_submitted";
    };
    readonly answer_outline_grill: {
        readonly from: "ALIGNING_OUTLINE";
        readonly to: "ALIGNING_OUTLINE";
        readonly event: "outline_grill_answered";
    };
    readonly lock_outline: {
        readonly from: "ALIGNING_OUTLINE";
        readonly to: "OUTLINE_LOCKED";
        readonly event: "outline_locked";
    };
    readonly submit_master_draft: {
        readonly from: "ALIGNING_MASTER";
        readonly to: "ALIGNING_MASTER";
        readonly event: "master_draft_submitted";
    };
    readonly render_manuscript_preview: {
        readonly from: "ALIGNING_MASTER";
        readonly to: "ALIGNING_MASTER";
        readonly event: "manuscript_preview_rendered";
    };
    readonly answer_master_grill: {
        readonly from: "ALIGNING_MASTER";
        readonly to: "ALIGNING_MASTER";
        readonly event: "master_grill_answered";
    };
    readonly lock_master: {
        readonly from: "ALIGNING_MASTER";
        readonly to: "MASTER_LOCKED";
        readonly event: "master_locked";
    };
    readonly submit_requirement_details: {
        readonly from: "REQUIREMENTS_READY";
        readonly to: "REQUIREMENTS_READY";
        readonly event: "requirements_detailed";
    };
    readonly update_production_units: {
        readonly from: "PRODUCING";
        readonly to: "PRODUCING";
        readonly event: "production_units_updated";
    };
    readonly lock_production: {
        readonly from: "PRODUCING";
        readonly to: "PRODUCTION_LOCKED";
        readonly event: "production_locked";
    };
    readonly submit_release_package: {
        readonly from: "PACKAGING";
        readonly to: "PACKAGING";
        readonly event: "release_package_submitted";
    };
    readonly select_release_package: {
        readonly from: "PACKAGING";
        readonly to: "RELEASE_READY";
        readonly event: "release_locked";
    };
};
export type CommitKind = keyof typeof COMMIT_TRANSITIONS | "rollback_to_node" | "reply_annotations" | "request_text_revision" | "save_note" | "confirm_workspace" | "submit_workspace_progress_audit" | "confirm_start_position" | "answer_workspace_grill" | "submit_human_review" | "submit_competition_report";
export interface CreateWorkflowInput {
    carrier: WorkflowCarrier;
    summary: string;
    displayName?: string | undefined;
    rootDirectory?: string | undefined;
    context: Record<string, unknown>;
    idempotencyKey: string;
    /** Optional 1–7 node from which an existing project is being continued. */
    startAtNode?: number | undefined;
}
export interface RunWorkflowInput {
    workflowId: string;
    expectedRevision: number;
    idempotencyKey: string;
}
export interface CommitWorkflowInput {
    workflowId: string;
    expectedRevision: number;
    kind: CommitKind;
    summary: string;
    context: Record<string, unknown>;
    idempotencyKey: string;
}
export declare class WorkflowService {
    private readonly store;
    private readonly artifacts;
    private readonly selectionEngine;
    private readonly cutWorkbenchBridge;
    private readonly vectCutBridge;
    private readonly workspace?;
    constructor(store: JsonWorkflowStore, artifacts: ArtifactStore, selectionEngine?: SelectionEngine, cutWorkbenchBridge?: CutWorkbenchBridge, vectCutBridge?: VectCutBridge, workspace?: WorkspaceDeliverables | undefined);
    create(input: CreateWorkflowInput): Promise<WorkflowSnapshot>;
    private createUnlocked;
    get(workflowId: string): Promise<WorkflowSnapshot>;
    list(): Promise<WorkflowSnapshot[]>;
    /** Resolves only the full MCP-owned guidance declared by the current node. */
    guidance(workflowId: string, requestedIds?: readonly GuidanceId[], issueCodes?: readonly EditorialIssueCode[], planningIssueCodes?: readonly ArticlePlanningIssueCode[]): Promise<Record<string, unknown>>;
    run(input: RunWorkflowInput): Promise<WorkflowSnapshot>;
    private runUnlocked;
    commit(input: CommitWorkflowInput): Promise<WorkflowSnapshot>;
    private commitUnlocked;
    saveAnnotation(workflowId: string, input: Record<string, unknown>): Promise<{
        items: {
            receipt: import("./text-feedback.js").AnnotationReceipt | null;
            status: string;
            id: string;
            revision: number;
            artifactId: string;
            contentHash: string;
            anchors: import("./text-feedback.js").TextAnchor[];
            body: string;
            withdrawn: boolean;
            at: string;
        }[];
        pending: {
            receipt: import("./text-feedback.js").AnnotationReceipt | null;
            status: string;
            id: string;
            revision: number;
            artifactId: string;
            contentHash: string;
            anchors: import("./text-feedback.js").TextAnchor[];
            body: string;
            withdrawn: boolean;
            at: string;
        }[];
        awaitingVerification: {
            receipt: import("./text-feedback.js").AnnotationReceipt | null;
            status: string;
            id: string;
            revision: number;
            artifactId: string;
            contentHash: string;
            anchors: import("./text-feedback.js").TextAnchor[];
            body: string;
            withdrawn: boolean;
            at: string;
        }[];
        needsInput: {
            receipt: import("./text-feedback.js").AnnotationReceipt | null;
            status: string;
            id: string;
            revision: number;
            artifactId: string;
            contentHash: string;
            anchors: import("./text-feedback.js").TextAnchor[];
            body: string;
            withdrawn: boolean;
            at: string;
        }[];
        instruction: string;
    }>;
    textReview(workflowId: string): Promise<{
        workflowId: string;
        revision: number;
        feedback: {
            items: {
                mappedTo: {
                    artifactId: string;
                    anchors: {
                        start: number;
                        end: number;
                        field: string;
                        quote: string;
                        prefix: string;
                        suffix: string;
                    }[];
                } | null;
                receipt: import("./text-feedback.js").AnnotationReceipt | null;
                status: string;
                id: string;
                revision: number;
                artifactId: string;
                contentHash: string;
                anchors: import("./text-feedback.js").TextAnchor[];
                body: string;
                withdrawn: boolean;
                at: string;
            }[];
            pending: {
                receipt: import("./text-feedback.js").AnnotationReceipt | null;
                status: string;
                id: string;
                revision: number;
                artifactId: string;
                contentHash: string;
                anchors: import("./text-feedback.js").TextAnchor[];
                body: string;
                withdrawn: boolean;
                at: string;
            }[];
            awaitingVerification: {
                receipt: import("./text-feedback.js").AnnotationReceipt | null;
                status: string;
                id: string;
                revision: number;
                artifactId: string;
                contentHash: string;
                anchors: import("./text-feedback.js").TextAnchor[];
                body: string;
                withdrawn: boolean;
                at: string;
            }[];
            needsInput: {
                receipt: import("./text-feedback.js").AnnotationReceipt | null;
                status: string;
                id: string;
                revision: number;
                artifactId: string;
                contentHash: string;
                anchors: import("./text-feedback.js").TextAnchor[];
                body: string;
                withdrawn: boolean;
                at: string;
            }[];
            instruction: string;
        };
        history: import("./text-feedback.js").TextFeedback;
        artifacts: {
            family: string;
            fields: {
                field: string;
                text: string;
            }[];
            schemaVersion: 1;
            content: unknown;
            artifactId: string;
            kind: ArtifactKind;
            mediaType: string;
            contentHash: string;
            revision: number;
            createdAt: string;
            parentArtifactIds: string[];
        }[];
    }>;
    videoReview(workflowId: string): Promise<{
        previews: import("@promo-workflow/contracts").VideoPreview[];
        currentPreviewId: string | null;
        annotations: import("@promo-workflow/contracts").VideoAnnotation[];
        history: import("@promo-workflow/contracts").VideoAnnotation[];
        workflowId: string;
        revision: number;
    }>;
    videoProduction(workflowId: string): Promise<{
        workflowId: string;
        revision: number;
        workflowState: "NEEDS_PROFILE" | "READY" | "FETCHING" | "MATCHING" | "AWAITING_SELECTION" | "TOPIC_LOCKED" | "ALIGNING_BASELINE" | "BASELINE_LOCKED" | "GENERATING_CREATIVE" | "ALIGNING_OUTLINE" | "OUTLINE_LOCKED" | "GENERATING_MASTER" | "ALIGNING_MASTER" | "MASTER_LOCKED" | "COMPILING_REQUIREMENTS" | "REQUIREMENTS_READY" | "AWAITING_HUMAN_REVIEW" | "REJECTED" | "PRODUCING" | "PRODUCTION_LOCKED" | "PACKAGING" | "RELEASE_READY";
        production: import("./video-production.js").VideoProductionState | null;
        phases: readonly [{
            readonly id: "materials";
            readonly label: "素材检查";
            readonly output: "素材目录、分镜对应关系、可用片段和补录清单";
            readonly checks: readonly ["文件能正常打开", "重要观点有画面支撑", "隐私位置已标记"];
            readonly instruction: "复用完整录屏和口播中的片段，不为每个分镜重复拍摄。对外展示前先处理隐私。";
        }, {
            readonly id: "rough_cut";
            readonly label: "故事粗剪";
            readonly output: "完整粗剪视频、可编辑工程、带时间的问题清单";
            readonly checks: readonly ["不用特效也能看懂", "没有重复和无效等待", "关键结论有真实画面"];
            readonly instruction: "口播视频可先剪人声，再搭主画面。先讲通故事，不急着做精细效果。";
        }, {
            readonly id: "audio";
            readonly label: "声音整理";
            readonly output: "最终人声音轨、句子时间位置、补录清单";
            readonly checks: readonly ["没有口误", "语速与音量合适", "声音和画面同步"];
            readonly instruction: "整理句间节奏、替换错读，确认最终声音；不要让音乐盖住人声。";
        }, {
            readonly id: "fine_cut";
            readonly label: "画面精剪";
            readonly output: "精剪视频、可编辑工程、遗留问题清单";
            readonly checks: readonly ["重要画面清楚", "文字和放大位置正确", "隐私已处理且效果不过量"];
            readonly instruction: "用相关辅助画面遮剪切，完成必要放大、重点文字和打码。整篇口播改动需重新检查声音与字幕。";
        }, {
            readonly id: "subtitles";
            readonly label: "字幕校对";
            readonly output: "带字幕审片视频、独立字幕文件";
            readonly checks: readonly ["字幕与实际人声一致", "名称数字正确", "时间正确且不挡重点"];
            readonly instruction: "依据最终听到的声音制作字幕，不直接复制早期脚本。";
        }, {
            readonly id: "delivery";
            readonly label: "终版交付";
            readonly output: "所需发布视频、字幕、可编辑工程和交付说明";
            readonly checks: readonly ["完整播放无异常", "音画字幕同步且无漏打码", "所需比例清晰度正确且工程可打开"];
            readonly instruction: "依次看故事、事实、细节；仅导出实际需要的版本，不默认复制横竖版和无字幕版。";
        }];
        videoReview: import("@promo-workflow/contracts").VideoReviewState;
        submissionArtifacts: import("./artifacts/types.js").ArtifactRecord[];
    }>;
    updateVideoProduction(input: Record<string, unknown>, actor?: 'human' | 'agent'): Promise<{
        workflowId: string;
        revision: number;
        production: import("./video-production.js").VideoProductionState | undefined;
        workflowState?: never;
    } | {
        workflowId: string;
        revision: number;
        workflowState: "PRODUCING";
        production: import("./video-production.js").VideoProductionState;
    }>;
    videoAnnotate(input: Record<string, unknown>): Promise<{
        previews: import("@promo-workflow/contracts").VideoPreview[];
        currentPreviewId: string | null;
        annotations: import("@promo-workflow/contracts").VideoAnnotation[];
        history: import("@promo-workflow/contracts").VideoAnnotation[];
        workflowId: string;
        revision: number;
    }>;
    private returnToTextNode;
    private contextForMatching;
    private createBaselineBrief;
    private budgetFor;
    private createCreativeRouteBrief;
    private createCreativeOutlineBrief;
    private creativeRoutesFor;
    private selectedCreativeRouteFor;
    private createMasterDevelopmentBrief;
    private baselineFor;
    private outlineDraftFor;
    private creativeOutlineFor;
    private masterDraftFor;
    private contentMasterFor;
    private compileRequirements;
    private requirementSetFor;
    private createProductionPlan;
    private productionPlanFor;
    private productionFor;
    private productionResultsFor;
    private assembleArticle;
    private lockAssembledArticle;
    private runVideoBridge;
    private lockVideoProduction;
    private releasePackageDraftFor;
    private readArtifactContent;
    private toSnapshot;
    private syncWorkspace;
    /** Durable commit precedes its read-only workspace projection; retry does not duplicate the mutation. */
    private persistAndProject;
    private editorialContextFor;
    private currentRequirementsFor;
    private workspaceScopeForRecord;
    private topicMatchFor;
}
export {};
