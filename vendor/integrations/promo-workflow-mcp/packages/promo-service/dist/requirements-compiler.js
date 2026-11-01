import { createHash } from "node:crypto";
/**
 * Compiles Node 4's asset usage plan into the smallest compatible local
 * requirement set. The result is stable for semantically equivalent input:
 * grouping and output ordering do not depend on the incoming array order.
 */
export function compileRequirements(input) {
    const usages = validateInput(input);
    const grouped = new Map();
    for (const usage of usages) {
        const key = compatibilityKey(usage);
        const members = grouped.get(key);
        if (members)
            members.push(usage);
        else
            grouped.set(key, [usage]);
    }
    const requirements = [...grouped.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, members]) => toRequirement(key, members));
    const result = {
        schemaVersion: 1,
        carrier: input.carrier,
        inputUsageIds: usages.map((usage) => usage.usageId).sort(),
        requirements,
        ...(input.carrier === "video" ? { subtitles: compileSubtitles(usages, input.videoDurationMs) } : {}),
    };
    validateRequirementCoverage(input.assetUsages, result.requirements);
    if (result.subtitles)
        validateSubtitles(result.subtitles, input.videoDurationMs);
    return result;
}
/** Throws when a compiled result omits or double-covers a master usage. */
export function validateRequirementCoverage(assetUsages, requirements) {
    const inputIds = assetUsages.map((usage) => usage.usageId);
    const uniqueInputIds = new Set(inputIds);
    if (uniqueInputIds.size !== inputIds.length)
        throw new Error("Master asset usage IDs must be unique.");
    const coverage = new Map();
    for (const requirement of requirements) {
        for (const usageId of requirement.coverageUsageIds) {
            if (!uniqueInputIds.has(usageId)) {
                throw new Error(`Requirement ${requirement.requirementId} covers unknown usage ${usageId}.`);
            }
            const previous = coverage.get(usageId);
            if (previous) {
                throw new Error(`Usage ${usageId} is covered by both ${previous} and ${requirement.requirementId}.`);
            }
            coverage.set(usageId, requirement.requirementId);
        }
    }
    for (const usageId of inputIds) {
        if (!coverage.has(usageId))
            throw new Error(`Usage ${usageId} is not covered by a material requirement.`);
    }
}
/** Throws when an SRT plan is not ordered, non-overlapping, or in duration bounds. */
export function validateSubtitles(subtitles, videoDurationMs) {
    assertPositiveInteger(videoDurationMs, "videoDurationMs");
    let previousEnd = 0;
    for (const cue of subtitles.cues) {
        if (!cue.cueId || !cue.sourceUsageId || !cue.text.trim()) {
            throw new Error("Subtitle cues require cueId, sourceUsageId, and non-empty text.");
        }
        assertTimestampRange(cue.startMs, cue.endMs, `Subtitle cue ${cue.cueId}`);
        if (cue.endMs > videoDurationMs) {
            throw new Error(`Subtitle cue ${cue.cueId} exceeds video duration.`);
        }
        if (cue.startMs < previousEnd) {
            throw new Error(`Subtitle cue ${cue.cueId} overlaps or precedes the prior cue.`);
        }
        previousEnd = cue.endMs;
    }
    if (subtitles.srt !== serializeSrt(subtitles.cues)) {
        throw new Error("Subtitle SRT does not match its structured cues.");
    }
}
export function serializeSrt(cues) {
    return cues.map((cue, index) => `${index + 1}\n${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}\n${cue.text}`)
        .join("\n\n");
}
function validateInput(input) {
    if (input.carrier !== "video" && input.carrier !== "article") {
        throw new Error("carrier must be video or article.");
    }
    if (!Array.isArray(input.assetUsages) || input.assetUsages.length === 0) {
        throw new Error("assetUsages must contain at least one planned usage.");
    }
    if (input.carrier === "video")
        assertPositiveInteger(input.videoDurationMs, "videoDurationMs");
    const ids = new Set();
    return input.assetUsages.map((usage) => {
        assertText(usage.usageId, "usageId");
        if (ids.has(usage.usageId))
            throw new Error(`Duplicate usageId: ${usage.usageId}.`);
        ids.add(usage.usageId);
        assertText(usage.sourceAssetId, `sourceAssetId for ${usage.usageId}`);
        assertText(usage.materialType, `materialType for ${usage.usageId}`);
        assertText(usage.purpose, `purpose for ${usage.usageId}`);
        if (usage.fragmentId !== undefined)
            assertText(usage.fragmentId, `fragmentId for ${usage.usageId}`);
        const constraints = normalizedConstraints(usage.constraints, usage.usageId);
        const spokenText = usage.spokenText?.trim();
        if (usage.spokenText !== undefined && !spokenText) {
            throw new Error(`spokenText for ${usage.usageId} must be non-empty when supplied.`);
        }
        if (usage.oneOffJustification !== undefined)
            assertText(usage.oneOffJustification, `oneOffJustification for ${usage.usageId}`);
        if (usage.startMs !== undefined || usage.endMs !== undefined) {
            assertTimestampRange(usage.startMs, usage.endMs, `Usage ${usage.usageId}`);
            if (input.carrier === "video" && usage.endMs > input.videoDurationMs) {
                throw new Error(`Usage ${usage.usageId} exceeds video duration.`);
            }
        }
        if (spokenText && (usage.startMs === undefined || usage.endMs === undefined)) {
            throw new Error(`Spoken usage ${usage.usageId} requires startMs and endMs.`);
        }
        return {
            ...usage,
            materialType: usage.materialType.trim(),
            purpose: usage.purpose.trim(),
            constraints,
            ...(spokenText ? { spokenText } : {}),
        };
    });
}
function toRequirement(key, members) {
    const first = members[0];
    if (!first)
        throw new Error("Cannot compile an empty requirement group.");
    if (members.some(member => JSON.stringify(member.captureProtocol) !== JSON.stringify(first.captureProtocol)))
        throw new Error("Conflicting capture protocols for the same requirement.");
    const usages = members
        .map((usage) => ({
        usageId: usage.usageId,
        ...(usage.fragmentId ? { fragmentId: usage.fragmentId } : {}),
        purpose: usage.purpose,
        ...(usage.startMs !== undefined ? { startMs: usage.startMs } : {}),
        ...(usage.endMs !== undefined ? { endMs: usage.endMs } : {}),
        ...(usage.oneOffJustification ? { oneOffJustification: usage.oneOffJustification.trim() } : {}),
    }))
        .sort((left, right) => left.usageId.localeCompare(right.usageId));
    return {
        requirementId: `req_${shortHash(key)}`,
        sourceAssetId: first.sourceAssetId,
        ...(first.captureProtocol ? { captureProtocol: first.captureProtocol } : {}),
        materialType: first.materialType,
        constraints: normalizedConstraints(first.constraints, first.usageId),
        usages,
        coverageUsageIds: usages.map((usage) => usage.usageId),
        reuseCount: usages.length,
    };
}
function compileSubtitles(usages, videoDurationMs) {
    const cues = usages
        .filter((usage) => (typeof usage.spokenText === "string" && usage.startMs !== undefined && usage.endMs !== undefined))
        .map((usage) => ({
        cueId: `cue_${shortHash(usage.usageId)}`,
        sourceUsageId: usage.usageId,
        startMs: usage.startMs,
        endMs: usage.endMs,
        text: usage.spokenText,
    }))
        .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || left.sourceUsageId.localeCompare(right.sourceUsageId));
    const subtitles = { cues, srt: serializeSrt(cues) };
    validateSubtitles(subtitles, videoDurationMs);
    return subtitles;
}
function compatibilityKey(usage) {
    return JSON.stringify({
        sourceAssetId: usage.sourceAssetId,
        materialType: usage.materialType.trim(),
        constraints: normalizedConstraints(usage.constraints, usage.usageId),
    });
}
function normalizedConstraints(constraints, usageId) {
    if (constraints === undefined)
        return [];
    if (!Array.isArray(constraints))
        throw new Error(`constraints for ${usageId} must be an array.`);
    return [...new Set(constraints.map((constraint) => {
            assertText(constraint, `constraint for ${usageId}`);
            return constraint.trim();
        }))].sort();
}
function formatSrtTimestamp(milliseconds) {
    const hours = Math.floor(milliseconds / 3_600_000);
    const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
    const seconds = Math.floor((milliseconds % 60_000) / 1_000);
    const remainder = milliseconds % 1_000;
    return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(remainder, 3)}`;
}
function pad(value, width) {
    return String(value).padStart(width, "0");
}
function assertTimestampRange(startMs, endMs, label) {
    assertNonNegativeInteger(startMs, `${label} startMs`);
    assertPositiveInteger(endMs, `${label} endMs`);
    if (endMs <= startMs)
        throw new Error(`${label} endMs must be greater than startMs.`);
}
function assertNonNegativeInteger(value, label) {
    if (!Number.isInteger(value) || value < 0)
        throw new Error(`${label} must be a non-negative integer.`);
}
function assertPositiveInteger(value, label) {
    if (!Number.isInteger(value) || value <= 0)
        throw new Error(`${label} must be a positive integer.`);
}
function assertText(value, label) {
    if (typeof value !== "string" || !value.trim())
        throw new Error(`${label} must be non-empty text.`);
}
function shortHash(value) {
    return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
//# sourceMappingURL=requirements-compiler.js.map