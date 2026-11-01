/** Safe default: the optional local VectCut service is never started by Promo. */
export class UnavailableVectCutBridge {
    async run(_input) {
        return {
            kind: "capability_gap",
            capability: "vectcut",
            reason: "No local VectCut endpoint is configured.",
            remediation: "Start VectCut locally, then construct WorkflowService with VectCutHttpBridge({ baseUrl }).",
        };
    }
}
export const unavailableVectCutBridge = new UnavailableVectCutBridge();
/**
 * Minimal HTTP adapter for the public VectCut API.  It creates an editable
 * CapCut/JianYing draft; it never represents the draft as an exported video.
 */
export class VectCutHttpBridge {
    baseUrl;
    width;
    height;
    request;
    constructor(options) {
        this.baseUrl = trimBaseUrl(options.baseUrl);
        this.width = options.width ?? 1080;
        this.height = options.height ?? 1920;
        this.request = options.fetch ?? globalThis.fetch;
    }
    async run(input) {
        assertVectCutBridgeInput(input);
        const draft = await this.post("create_draft", { width: this.width, height: this.height });
        const draftId = requiredText(readOutputField(draft, "draft_id"), "VectCut create_draft output.draft_id");
        const master = input.lockedMaster.master;
        const sources = sourceMap(input.mediaSources);
        const importedUsageIds = [];
        for (const shot of master.shots) {
            for (const usageId of shot.assetUsageIds) {
                const source = sources.get(usageId);
                if (!source)
                    throw new Error(`No VectCut media source was supplied for locked usage ${usageId}.`);
                const startSeconds = source.sourceStartSeconds ?? 0;
                const targetStartSeconds = shot.timeRange.startMs / 1000;
                const durationSeconds = shotDurationSeconds(shot.timeRange.startMs, shot.timeRange.endMs);
                const endSeconds = source.sourceEndSeconds ?? startSeconds + durationSeconds;
                if (endSeconds <= startSeconds)
                    throw new Error(`VectCut source ${usageId} has an invalid source range.`);
                await this.post("add_video", {
                    draft_id: draftId,
                    video_url: source.videoUrl,
                    start: startSeconds,
                    end: endSeconds,
                    target_start: targetStartSeconds,
                    duration: durationSeconds,
                });
                importedUsageIds.push(usageId);
            }
        }
        const srt = input.requirementSet.subtitles?.srt;
        if (typeof srt !== "string" || !srt.trim())
            throw new Error("VectCut requires compiled SRT subtitles.");
        await this.post("add_subtitle", { draft_id: draftId, srt });
        const saved = await this.post("save_draft", { draft_id: draftId });
        const draftUrl = optionalText(readOutputField(saved, "draft_url")) ?? optionalText(readOutputField(draft, "draft_url"));
        return {
            kind: "draft_result",
            reference: { draftId, draftUrl, revision: 1 },
            importedUsageIds,
            subtitleImported: true,
            savedAt: new Date().toISOString(),
        };
    }
    async post(path, body) {
        const response = await this.request(`${this.baseUrl}/${path}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!response.ok)
            throw new Error(`VectCut ${path} failed with HTTP ${response.status}.`);
        const payload = await response.json();
        if (!isRecord(payload) || payload.success !== true || !isRecord(payload.output)) {
            throw new Error(`VectCut ${path} returned an unsuccessful response.`);
        }
        return payload;
    }
}
export async function runVectCutBridge(bridge, input) {
    assertVectCutBridgeInput(input);
    const result = await bridge.run(input);
    assertVectCutBridgeResult(result);
    return result;
}
export function assertVectCutBridgeInput(input) {
    if (!isRecord(input) || !isRecord(input.lockedMaster))
        throw new Error("VectCut bridge requires a locked video master.");
    if (input.lockedMaster.master?.carrier !== "video" || input.lockedMaster.budget?.carrier !== "video") {
        throw new Error("VectCut bridge requires a locked video master and video budget.");
    }
    if (!isRecord(input.requirementSet) || input.requirementSet.carrier !== "video") {
        throw new Error("VectCut bridge requires a video requirement set.");
    }
    if (!Array.isArray(input.acceptedProductionResults))
        throw new Error("VectCut acceptedProductionResults must be an array.");
    if (!Array.isArray(input.mediaSources))
        throw new Error("VectCut mediaSources must be an array.");
    sourceMap(input.mediaSources);
    const usageIds = new Set();
    for (const shot of input.lockedMaster.master.shots)
        for (const usageId of shot.assetUsageIds)
            usageIds.add(usageId);
    for (const usageId of usageIds) {
        if (!input.mediaSources.some((source) => source.usageId === usageId)) {
            throw new Error(`VectCut requires a media source for locked usage ${usageId}.`);
        }
    }
}
export function assertVectCutBridgeResult(result) {
    if (!isRecord(result))
        throw new Error("VectCut bridge returned no result.");
    if (result.kind === "capability_gap") {
        if (result.capability !== "vectcut")
            throw new Error("Capability gap must identify vectcut.");
        requiredText(result.reason, "VectCut capability gap reason");
        requiredText(result.remediation, "VectCut capability gap remediation");
        return;
    }
    if (result.kind !== "draft_result" || !isRecord(result.reference))
        throw new Error("VectCut bridge returned an unknown result kind.");
    requiredText(result.reference.draftId, "VectCut draft ID");
    if (result.reference.draftUrl !== null)
        requiredText(result.reference.draftUrl, "VectCut draft URL");
    if (!Number.isInteger(result.reference.revision) || result.reference.revision < 1)
        throw new Error("VectCut draft revision must be positive.");
    if (!Array.isArray(result.importedUsageIds) || result.importedUsageIds.length === 0)
        throw new Error("VectCut draft must import at least one usage.");
    if (!result.subtitleImported)
        throw new Error("VectCut draft must import subtitles.");
    requiredText(result.savedAt, "VectCut savedAt");
}
function sourceMap(sources) {
    const mapped = new Map();
    for (const source of sources) {
        requiredText(source.usageId, "VectCut media source usageId");
        requiredText(source.videoUrl, "VectCut media source videoUrl");
        if (mapped.has(source.usageId))
            throw new Error(`Duplicate VectCut media source for ${source.usageId}.`);
        mapped.set(source.usageId, source);
    }
    return mapped;
}
function trimBaseUrl(value) {
    return requiredText(value, "VectCut baseUrl").replace(/\/+$/, "");
}
function shotDurationSeconds(startMs, endMs) {
    const duration = (endMs - startMs) / 1000;
    if (!Number.isFinite(duration) || duration <= 0)
        throw new Error("VectCut shot timing must be positive.");
    return duration;
}
function readOutputField(payload, field) {
    return isRecord(payload.output) ? payload.output[field] : undefined;
}
function optionalText(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function requiredText(value, field) {
    if (typeof value !== "string" || !value.trim())
        throw new Error(`${field} must be non-empty text.`);
    return value.trim();
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=vectcut-bridge.js.map