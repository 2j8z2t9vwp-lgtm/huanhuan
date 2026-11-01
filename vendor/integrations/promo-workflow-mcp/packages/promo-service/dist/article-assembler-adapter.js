import { createArticleAssetManifest, createArticleDocument, renderArticlePreview, } from "./production.js";
/**
 * Builds the lightweight article backend output with no renderer or platform
 * API. Existing production primitives remain the single source of truth for
 * document, manifest, platform-profile, and preview validation.
 */
export function buildArticleAssemblerOutput(input) {
    assertText(input.masterArtifactId, "masterArtifactId");
    if (input.branch.parentMasterRevision !== input.masterArtifactId) {
        throw new Error("Article branch parentMasterRevision must equal masterArtifactId.");
    }
    assertPositiveInteger(input.documentRevision, "documentRevision");
    assertText(input.documentId, "documentId");
    assertText(input.createdAt, "createdAt");
    const acceptedByUsageId = indexAcceptedAssets(input.acceptedAssets, input.master);
    const blocks = buildArticleBlocks(input.master, input.masterArtifactId, acceptedByUsageId);
    const document = createArticleDocument({
        id: input.documentId.trim(),
        revision: input.documentRevision,
        branch: input.branch,
        blocks,
        createdAt: input.createdAt.trim(),
    });
    const assetManifest = createArticleAssetManifest(document, buildManifestItems(input.master, acceptedByUsageId));
    const preview = renderArticlePreview(document, input.platformProfile);
    return {
        reference: createArticleAssemblerReference(input.branch, input.documentRevision),
        document,
        assetManifest,
        preview,
    };
}
/** Builds the narrow, stable reference Promo stores in its production capsule. */
export function createArticleAssemblerReference(branch, revision) {
    assertPositiveInteger(revision, "Article Assembler revision");
    assertText(branch.id, "Article branch id");
    assertText(branch.parentMasterRevision, "Article branch parentMasterRevision");
    assertText(branch.platform, "Article branch platform");
    assertText(branch.platformProfileId, "Article branch platformProfileId");
    assertText(branch.platformProfileVersion, "Article branch platformProfileVersion");
    return {
        branchId: branch.id.trim(),
        revision,
        parentMasterRevision: branch.parentMasterRevision.trim(),
        platform: branch.platform.trim(),
        platformProfileId: branch.platformProfileId.trim(),
        platformProfileVersion: branch.platformProfileVersion.trim(),
    };
}
function indexAcceptedAssets(results, master) {
    if (!Array.isArray(results))
        throw new Error("acceptedAssets must be an array.");
    const usages = new Map(master.assetPlan.usages.map((usage) => [usage.id, usage]));
    const byUsageId = new Map();
    const concreteAssetIds = new Set();
    for (const result of results) {
        if (!isRecord(result))
            throw new Error("acceptedAssets entries must be objects.");
        const assetUsageId = requiredText(result.assetUsageId, "acceptedAssets.assetUsageId");
        if (byUsageId.has(assetUsageId))
            throw new Error(`Accepted assets contain duplicate usage ${assetUsageId}.`);
        const usage = usages.get(assetUsageId);
        if (!usage || usage.carrier !== "article") {
            throw new Error(`Accepted asset ${assetUsageId} does not map to an article master usage.`);
        }
        const assetId = requiredText(result.assetId, `accepted asset ${assetUsageId}.assetId`);
        if (concreteAssetIds.has(assetId)) {
            throw new Error(`Accepted assets must provide a distinct concrete assetId per placement; duplicate ${assetId}.`);
        }
        concreteAssetIds.add(assetId);
        const route = readRoute(result.route, `accepted asset ${assetUsageId}.route`);
        const sourceArtifactIds = readTextArray(result.sourceArtifactIds, `accepted asset ${assetUsageId}.sourceArtifactIds`);
        if (sourceArtifactIds.length === 0)
            throw new Error(`Accepted asset ${assetUsageId} needs at least one source artifact.`);
        if (new Set(sourceArtifactIds).size !== sourceArtifactIds.length)
            throw new Error(`Accepted asset ${assetUsageId} has duplicate source artifacts.`);
        byUsageId.set(assetUsageId, { assetUsageId, assetId, route, sourceArtifactIds });
    }
    for (const placement of master.assetPlacements) {
        if (!byUsageId.has(placement.assetUsageId)) {
            throw new Error(`Article placement ${placement.id} is missing an accepted asset for usage ${placement.assetUsageId}.`);
        }
    }
    if (byUsageId.size !== master.assetPlacements.length) {
        throw new Error("Accepted assets must correspond exactly to the article's asset placements.");
    }
    return byUsageId;
}
function buildArticleBlocks(master, masterArtifactId, acceptedByUsageId) {
    const textBlocks = markdownToBlocks(master.bodyMarkdown, masterArtifactId);
    const placementsByBlockIndex = new Map();
    for (const placement of master.assetPlacements) {
        const blockIndex = textBlocks.findIndex((block) => (block.content ?? "").includes(placement.anchor));
        if (blockIndex < 0) {
            throw new Error(`Article placement ${placement.id} anchor does not occur in a renderable content block.`);
        }
        const accepted = acceptedByUsageId.get(placement.assetUsageId);
        if (!accepted)
            throw new Error(`Article placement ${placement.id} has no accepted asset.`);
        const imageBlock = {
            id: `asset_${placement.id}`,
            type: "image",
            content: placement.editorialPurpose,
            assetId: accepted.assetId,
            sourceMasterRef: `${masterArtifactId}:placement:${placement.id}`,
        };
        const blockPlacements = placementsByBlockIndex.get(blockIndex) ?? [];
        blockPlacements.push(imageBlock);
        placementsByBlockIndex.set(blockIndex, blockPlacements);
    }
    const blocks = [{
            id: "title",
            type: "heading",
            content: master.title,
            assetId: null,
            sourceMasterRef: `${masterArtifactId}:title`,
        }];
    for (const [index, block] of textBlocks.entries()) {
        blocks.push(block);
        blocks.push(...(placementsByBlockIndex.get(index) ?? []));
    }
    if (master.primaryCallToAction) {
        blocks.push({
            id: "primary_cta",
            type: "cta",
            content: master.primaryCallToAction,
            assetId: null,
            sourceMasterRef: `${masterArtifactId}:primary-cta`,
        });
    }
    return blocks;
}
function buildManifestItems(master, acceptedByUsageId) {
    const sourcesById = new Map(master.assetPlan.sourceAssets.map((source) => [source.id, source]));
    return master.assetPlacements.map((placement) => {
        const usage = master.assetPlan.usages.find((candidate) => candidate.id === placement.assetUsageId);
        const accepted = acceptedByUsageId.get(placement.assetUsageId);
        if (!usage || !accepted)
            throw new Error(`Cannot build manifest for placement ${placement.id}.`);
        const source = sourcesById.get(usage.sourceAssetId);
        if (!source)
            throw new Error(`Article usage ${usage.id} has no source asset.`);
        return {
            assetId: accepted.assetId,
            route: accepted.route,
            sourceArtifactIds: [...accepted.sourceArtifactIds],
            evidenceRole: source.evidenceRole,
            constraints: [...source.constraints],
        };
    });
}
function markdownToBlocks(markdown, masterArtifactId) {
    const lines = requiredText(markdown, "master.bodyMarkdown").replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let paragraph = [];
    let code;
    let sequence = 0;
    const push = (type, content) => {
        sequence += 1;
        blocks.push({
            id: `body_${sequence}`,
            type,
            content,
            assetId: null,
            sourceMasterRef: `${masterArtifactId}:body:${sequence}`,
        });
    };
    const flushParagraph = () => {
        if (paragraph.length > 0)
            push("paragraph", paragraph.join("\n").trim());
        paragraph = [];
    };
    for (const line of lines) {
        if (line.trim().startsWith("```")) {
            flushParagraph();
            if (code === undefined)
                code = [];
            else {
                push("code", code.join("\n"));
                code = undefined;
            }
            continue;
        }
        if (code !== undefined) {
            code.push(line);
            continue;
        }
        const heading = /^(#{1,6})\s+(.+)$/.exec(line);
        if (heading) {
            flushParagraph();
            push("heading", heading[2]?.trim() ?? "");
            continue;
        }
        if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
            flushParagraph();
            push("divider", null);
            continue;
        }
        if (/^>\s?/.test(line)) {
            flushParagraph();
            push("quote", line.replace(/^>\s?/, "").trim());
            continue;
        }
        if (!line.trim()) {
            flushParagraph();
            continue;
        }
        paragraph.push(line.trim());
    }
    if (code !== undefined)
        throw new Error("master.bodyMarkdown has an unclosed code fence.");
    flushParagraph();
    return blocks;
}
function readRoute(value, field) {
    if (value === "accepted" || value === "human" || value === "generative" || value === "local")
        return value;
    throw new Error(`${field} must be accepted, human, generative, or local.`);
}
function readTextArray(value, field) {
    if (!Array.isArray(value))
        throw new Error(`${field} must be an array.`);
    return value.map((item, index) => requiredText(item, `${field}[${index}]`));
}
function requiredText(value, field) {
    if (typeof value !== "string" || !value.trim())
        throw new Error(`${field} must be non-empty text.`);
    return value.trim();
}
function assertText(value, field) {
    requiredText(value, field);
}
function assertPositiveInteger(value, field) {
    if (!Number.isInteger(value) || value <= 0)
        throw new Error(`${field} must be a positive integer.`);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=article-assembler-adapter.js.map