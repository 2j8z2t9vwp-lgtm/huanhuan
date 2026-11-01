/**
 * Safe default for a lightweight Promo installation.  It runs no process,
 * does not inspect local projects, and never invents a Cut Workbench project
 * or render output.
 */
export class UnavailableCutWorkbenchBridge {
    async run(_input) {
        return {
            kind: "capability_gap",
            capability: "cut_workbench",
            reason: "No compatible Cut Workbench bridge is configured; its local/API interface has not been verified for this installation.",
            remediation: "Configure a compatible local Cut Workbench bridge before starting video production.",
        };
    }
}
export const unavailableCutWorkbenchBridge = new UnavailableCutWorkbenchBridge();
/**
 * Wraps a configured bridge with the minimal input/output checks Promo needs.
 * A real integration can be replaced by a test fake without importing any
 * Cut Workbench dependency into this package.
 */
export async function runCutWorkbenchBridge(bridge, input) {
    assertCutWorkbenchBridgeInput(input);
    const result = await bridge.run(input);
    assertCutWorkbenchBridgeResult(result);
    return result;
}
export function assertCutWorkbenchBridgeInput(input) {
    if (!isRecord(input))
        throw new Error("Cut Workbench bridge input is required.");
    if (!isRecord(input.lockedMaster))
        throw new Error("lockedMaster is required.");
    if (input.lockedMaster.budget?.carrier !== "video" || input.lockedMaster.master?.carrier !== "video") {
        throw new Error("Cut Workbench bridge requires a locked video master and video budget.");
    }
    assertText(input.lockedMaster.topicId, "lockedMaster.topicId");
    assertText(input.lockedMaster.confirmedAt, "lockedMaster.confirmedAt");
    if (!isRecord(input.requirementSet) || input.requirementSet.carrier !== "video") {
        throw new Error("Cut Workbench bridge requires a video requirement set.");
    }
    if (!Array.isArray(input.acceptedProductionResults)) {
        throw new Error("acceptedProductionResults must be an array.");
    }
    const unitIds = new Set();
    for (const result of input.acceptedProductionResults) {
        assertText(result.unitId, "acceptedProductionResults[].unitId");
        if (unitIds.has(result.unitId))
            throw new Error(`Duplicate accepted production result for unit ${result.unitId}.`);
        unitIds.add(result.unitId);
        if (!Array.isArray(result.artifactIds))
            throw new Error(`Accepted production result ${result.unitId} requires artifactIds.`);
        assertUniqueTextArray(result.artifactIds, `accepted production result ${result.unitId} artifactIds`);
        assertText(result.provenance, `accepted production result ${result.unitId} provenance`);
    }
}
export function assertCutWorkbenchBridgeResult(result) {
    if (!isRecord(result))
        throw new Error("Cut Workbench bridge returned no result.");
    if (result.kind === "capability_gap") {
        if (result.capability !== "cut_workbench")
            throw new Error("Capability gap must identify cut_workbench.");
        assertText(result.reason, "capability gap reason");
        assertText(result.remediation, "capability gap remediation");
        return;
    }
    if (result.kind !== "production_result")
        throw new Error("Cut Workbench bridge returned an unknown result kind.");
    assertText(result.projectId, "Cut Workbench projectId");
    if (!Number.isInteger(result.revision) || result.revision < 1) {
        throw new Error("Cut Workbench revision must be a positive integer.");
    }
    assertUnitStatuses(result.unitStatuses);
    assertUniqueTextArray(result.verifiedOutputArtifactIds, "verified output artifact IDs");
    if (result.finalSubtitleArtifactId !== null)
        assertText(result.finalSubtitleArtifactId, "final subtitle artifact ID");
    assertFinalGate(result.finalGate);
    if (result.finalGate.passed) {
        if (result.finalGate.blockers.length || !result.finalGate.verifiedAt)
            throw new Error("A passed final gate requires current verification and no blockers.");
        if (!result.finalSubtitleArtifactId) {
            throw new Error("A passed Cut Workbench final gate requires a final subtitle artifact ID.");
        }
        if (result.verifiedOutputArtifactIds.length === 0) {
            throw new Error("A passed Cut Workbench final gate requires verified output artifact IDs.");
        }
    }
}
function assertUnitStatuses(value) {
    if (!Array.isArray(value))
        throw new Error("Cut Workbench unitStatuses must be an array.");
    const unitIds = new Set();
    const allowedStatuses = [
        "queued", "active", "waiting_human", "review", "accepted", "needs_replan",
    ];
    for (const status of value) {
        if (!isRecord(status))
            throw new Error("Cut Workbench unit status must be an object.");
        assertText(status.unitId, "Cut Workbench unit status unitId");
        if (unitIds.has(status.unitId))
            throw new Error(`Duplicate Cut Workbench unit status for ${status.unitId}.`);
        unitIds.add(status.unitId);
        if (!allowedStatuses.includes(status.status)) {
            throw new Error(`Unknown Cut Workbench unit status for ${status.unitId}.`);
        }
    }
}
function assertFinalGate(value) {
    if (!isRecord(value) || typeof value.passed !== "boolean") {
        throw new Error("Cut Workbench finalGate requires a boolean passed value.");
    }
    assertUniqueTextArray(value.blockers, "Cut Workbench final gate blockers");
    if (value.verifiedAt !== null)
        assertText(value.verifiedAt, "Cut Workbench final gate verifiedAt");
}
function assertUniqueTextArray(value, field) {
    if (!Array.isArray(value))
        throw new Error(`${field} must be an array.`);
    const values = new Set();
    for (const item of value) {
        assertText(item, `${field} item`);
        if (values.has(item))
            throw new Error(`${field} contains duplicate value ${item}.`);
        values.add(item);
    }
}
function assertText(value, field) {
    if (typeof value !== "string" || !value.trim())
        throw new Error(`${field} must be non-empty text.`);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=cut-workbench-bridge.js.map