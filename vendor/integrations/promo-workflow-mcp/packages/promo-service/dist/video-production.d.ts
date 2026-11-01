export declare const VIDEO_PRODUCTION_PHASES: readonly [{
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
export type VideoProductionPhase = typeof VIDEO_PRODUCTION_PHASES[number]['id'];
export interface VideoProductionTask {
    id: string;
    phase: VideoProductionPhase;
    title: string;
    owner: 'user' | 'cutbench' | 'promo';
    status: 'todo' | 'doing' | 'blocked' | 'done';
    evidenceArtifactIds: string[];
}
export interface VideoProductionSubmission {
    id: string;
    phase: VideoProductionPhase;
    round: number;
    planArtifactId: string;
    previewId: string | null;
    artifactIds: string[];
    note: string;
}
export interface VideoProductionState {
    node: 6;
    phase: VideoProductionPhase;
    round: number;
    status: 'working' | 'waiting_material' | 'awaiting_review' | 'paused_planning' | 'complete';
    planArtifactId: string;
    tasks: VideoProductionTask[];
    submission: VideoProductionSubmission | null;
    approvals: (VideoProductionSubmission & {
        confirmedAt: string;
        note: string;
    })[];
    planningReturn: {
        node: number;
        reason: string;
        phase: VideoProductionPhase;
    } | null;
    history: {
        id: string;
        at: string;
        action: string;
        reason: string;
        snapshot: Omit<VideoProductionState, 'history'>;
    }[];
}
export declare function createVideoProduction(planArtifactId: string): VideoProductionState;
export interface ProductionChangeEnvironment {
    actor: 'human' | 'agent';
    planArtifactId: string;
    currentPreviewId: string | null;
    unresolvedFeedback: boolean;
}
/** One resident record, many revisioned rounds. Never overwrite a prior decision. */
export declare function changeVideoProduction(original: VideoProductionState, input: Record<string, unknown>, env: ProductionChangeEnvironment): VideoProductionState;
