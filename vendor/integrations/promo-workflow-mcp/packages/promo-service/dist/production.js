import { ARTICLE_BLOCK_TYPES, } from "@promo-workflow/contracts";
export const PRODUCTION_ROUTES = ["human", "generative", "local"];
export const PRODUCTION_UNIT_STATUSES = [
    "queued",
    "active",
    "waiting_human",
    "review",
    "accepted",
    "needs_replan",
];
/**
 * Create the small production-unit view owned by Promo. It deliberately does
 * not model renderer jobs, video timelines, or editorial application state.
 */
export function createProductionUnitPlan(input) {
    const requirements = uniqueRequirements(input.requirements);
    const acceptedAssets = new Set(input.acceptedSourceAssetIds ?? []);
    const supportedRoutes = validSupportedRoutes(input.supportedRoutes);
    const hints = indexHints(input.routeHints ?? [], requirements);
    const units = [];
    const reusedRequirementIds = [];
    const capabilityGaps = [];
    for (const requirement of requirements) {
        if (acceptedAssets.has(requirement.sourceAssetId)) {
            reusedRequirementIds.push(requirement.requirementId);
            continue;
        }
        const hint = hints.get(requirement.requirementId);
        const route = hint?.route ?? chooseRoute(requirement, supportedRoutes);
        if (!route || !supportedRoutes.has(route)) {
            capabilityGaps.push({
                requirementId: requirement.requirementId,
                reason: hint
                    ? `The requested ${hint.route} route is not available.`
                    : "No available route can satisfy this requirement while preserving its constraints.",
                availableCapabilities: [...supportedRoutes].sort(),
                preservedConstraints: requirement.constraints,
            });
            continue;
        }
        units.push({
            id: productionUnitId(requirement.requirementId),
            requirementIds: [requirement.requirementId],
            route,
            status: route === "human" ? "waiting_human" : "queued",
            dependencies: hint?.dependencies ? [...hint.dependencies] : [],
        });
    }
    assertProductionUnits(units);
    return {
        units: units.sort((left, right) => left.id.localeCompare(right.id)),
        requirements,
        reusedRequirementIds: reusedRequirementIds.sort(),
        capabilityGaps: capabilityGaps.sort((left, right) => left.requirementId.localeCompare(right.requirementId)),
    };
}
/** Enforces the intentionally small, monotonic unit lifecycle. */
export function transitionProductionUnit(unit, nextStatus) {
    assertProductionUnits([unit]);
    if (unit.status === nextStatus)
        return { ...unit, requirementIds: [...unit.requirementIds], dependencies: [...unit.dependencies] };
    const permitted = TRANSITIONS[unit.status];
    if (!permitted.includes(nextStatus)) {
        throw new Error(`Production unit ${unit.id} cannot move from ${unit.status} to ${nextStatus}.`);
    }
    return { ...unit, status: nextStatus, requirementIds: [...unit.requirementIds], dependencies: [...unit.dependencies] };
}
/**
 * Derives the single user-facing action and blockers from an otherwise
 * backend-owned set of units. Agent/local work is intentionally not exposed
 * as a human action.
 */
export function getProductionControl(units, instructions = {}) {
    assertProductionUnits(units);
    const replans = units.filter((unit) => unit.status === "needs_replan");
    if (replans.length > 0) {
        return {
            pendingAction: {
                id: `resolve_${replans[0]?.id}`,
                kind: "resolve",
                instruction: instructions[replans[0]?.id ?? ""] ?? "Resolve the capability gap or return this requirement to planning.",
            },
            blockers: replans.map((unit) => `Production unit ${unit.id} needs replan.`),
            complete: false,
        };
    }
    const waitingHuman = units.find((unit) => unit.status === "waiting_human");
    if (waitingHuman) {
        return {
            pendingAction: {
                id: `produce_${waitingHuman.id}`,
                kind: "produce",
                instruction: instructions[waitingHuman.id] ?? "Provide or confirm the required real material for this production unit.",
            },
            blockers: [],
            complete: false,
        };
    }
    const review = units.find((unit) => unit.status === "review");
    if (review) {
        return {
            pendingAction: {
                id: `review_${review.id}`,
                kind: "review",
                instruction: instructions[review.id] ?? "Review the uncertain evidence or production result for this unit.",
            },
            blockers: [],
            complete: false,
        };
    }
    return { pendingAction: null, blockers: [], complete: units.every((unit) => unit.status === "accepted") };
}
export const ARTICLE_REVIEW_TRIGGERS = [
    "product_identity",
    "people",
    "brand_expression",
    "ai_authenticity",
    "factual_evidence",
    "paid_generation",
    "new_human_capture",
];
/**
 * The complete preview review is mandatory. Risk triggers only make the
 * review instruction more explicit; they never add a second user action.
 */
export function getArticleReviewGate(input) {
    assertArticleDocument(input.document);
    assertArticleAssetManifest(input.manifest, input.document);
    const unitControl = getProductionControl(input.units);
    if (!unitControl.complete) {
        return { pendingAction: unitControl.pendingAction, blockers: unitControl.blockers, canLock: false };
    }
    const hardFailures = [...new Set(input.hardConstraintFailures ?? [])].filter(hasText);
    const drift = [...new Set(input.semanticDrift ?? [])].filter(hasText);
    const triggers = [...new Set([
            ...ARTICLE_REVIEW_TRIGGERS.filter((trigger) => input.uncertainty?.[trigger] === true),
            ...reviewTriggersFromManifest(input.manifest),
        ])];
    const blockers = [
        ...hardFailures.map((failure) => `Hard platform constraint: ${failure}`),
        ...drift.map((finding) => `Semantic drift: ${finding}`),
    ];
    if (blockers.length > 0) {
        return {
            pendingAction: {
                id: `review_document_${input.document.id}_${input.document.revision}`,
                kind: "review",
                instruction: `Resolve the preview blockers before approval. ${[...hardFailures, ...drift].join(" ")}`.trim(),
            },
            blockers,
            canLock: false,
        };
    }
    if (!input.previewAccepted) {
        const emphasis = triggers.length > 0 ? ` Pay particular attention to: ${triggers.join(", ")}.` : "";
        return {
            pendingAction: {
                id: `review_document_${input.document.id}_${input.document.revision}`,
                kind: "review",
                instruction: `Review the complete local preview analogue, including structure, assets, captions, references, links, and CTA.${emphasis}`,
            },
            blockers: [],
            canLock: false,
        };
    }
    return { pendingAction: null, blockers: [], canLock: true };
}
export function createArticleDocument(input) {
    const document = {
        id: input.id,
        revision: input.revision,
        branch: { ...input.branch },
        blocks: input.blocks.map((block) => ({ ...block })),
        createdAt: input.createdAt,
    };
    assertArticleDocument(document);
    return document;
}
export function createArticleAssetManifest(document, items) {
    const manifest = { documentRevision: document.revision, items: items.map((item) => ({ ...item, sourceArtifactIds: [...item.sourceArtifactIds], constraints: [...item.constraints] })) };
    assertArticleAssetManifest(manifest, document);
    return manifest;
}
/** Builds a portable local review surface, deliberately not a platform clone. */
export function renderArticlePreview(document, profile) {
    assertArticleDocument(document);
    assertProfileMatchesBranch(profile, document.branch);
    const html = [
        `<article data-platform="${escapeHtml(profile.platform)}" data-preview-preset="${escapeHtml(profile.renderPreset.id)}">`,
        ...document.blocks.map(renderArticleBlock),
        "</article>",
    ].join("\n");
    return {
        schemaVersion: 1,
        documentId: document.id,
        documentRevision: document.revision,
        platform: profile.platform,
        profileId: profile.id,
        profileVersion: profile.version,
        renderPresetId: profile.renderPreset.id,
        html,
    };
}
/** Validates the three immutable Article Assembler outputs as one revision. */
export function createArticleProductionArtifacts(input) {
    if (input.documentArtifact.kind !== "article_document")
        throw new Error("documentArtifact must be an article_document artifact.");
    if (input.previewArtifact.kind !== "preview")
        throw new Error("previewArtifact must be a preview artifact.");
    if (input.assetManifestArtifact.kind !== "asset_manifest")
        throw new Error("assetManifestArtifact must be an asset_manifest artifact.");
    assertPositiveInteger(input.documentRevision, "documentRevision");
    if (input.previewDocumentRevision !== input.documentRevision || input.assetManifestDocumentRevision !== input.documentRevision) {
        throw new Error("Article document, preview, and asset manifest must reference the same document revision.");
    }
    if (!input.previewArtifact.parentArtifactIds.includes(input.documentArtifact.artifactId)) {
        throw new Error("Preview artifact must reference the article document artifact as a parent.");
    }
    if (!input.assetManifestArtifact.parentArtifactIds.includes(input.documentArtifact.artifactId)) {
        throw new Error("Asset manifest artifact must reference the article document artifact as a parent.");
    }
    return {
        documentArtifactId: input.documentArtifact.artifactId,
        previewArtifactId: input.previewArtifact.artifactId,
        assetManifestArtifactId: input.assetManifestArtifact.artifactId,
    };
}
function chooseRoute(requirement, supportedRoutes) {
    if (requiresRealMaterial(requirement))
        return supportedRoutes.has("human") ? "human" : undefined;
    if (isDeterministicTransformation(requirement))
        return supportedRoutes.has("local") ? "local" : undefined;
    if (supportedRoutes.has("generative"))
        return "generative";
    return supportedRoutes.has("human") ? "human" : undefined;
}
function requiresRealMaterial(requirement) {
    const text = `${requirement.materialType} ${requirement.constraints.join(" ")}`.toLowerCase();
    return /\b(real|actual|person|people|product|evidence|interview|screen[ -]?capture|recording)\b|真实|实拍|真人|人物|产品|证据|访谈|录屏/.test(text);
}
function isDeterministicTransformation(requirement) {
    const text = `${requirement.materialType} ${requirement.constraints.join(" ")}`.toLowerCase();
    return /\b(trim|crop|resize|transcode|subtitle|caption|format|convert)\b|裁剪|转码|字幕|格式转换/.test(text);
}
function indexHints(hints, requirements) {
    const requirementIds = new Set(requirements.map((requirement) => requirement.requirementId));
    const indexed = new Map();
    for (const hint of hints) {
        if (!requirementIds.has(hint.requirementId))
            throw new Error(`Route hint references unknown requirement ${hint.requirementId}.`);
        if (indexed.has(hint.requirementId))
            throw new Error(`Duplicate route hint for ${hint.requirementId}.`);
        if (!PRODUCTION_ROUTES.includes(hint.route))
            throw new Error(`Invalid route for ${hint.requirementId}.`);
        indexed.set(hint.requirementId, hint);
    }
    return indexed;
}
function uniqueRequirements(requirements) {
    if (requirements.length === 0)
        throw new Error("Production requires at least one material requirement.");
    const ids = new Set();
    for (const requirement of requirements) {
        if (!hasText(requirement.requirementId) || !hasText(requirement.sourceAssetId))
            throw new Error("Each material requirement needs an ID and source asset ID.");
        if (ids.has(requirement.requirementId))
            throw new Error(`Duplicate material requirement ${requirement.requirementId}.`);
        ids.add(requirement.requirementId);
    }
    return [...requirements].sort((left, right) => left.requirementId.localeCompare(right.requirementId));
}
function validSupportedRoutes(routes) {
    const selected = new Set(routes ?? PRODUCTION_ROUTES);
    for (const route of selected)
        if (!PRODUCTION_ROUTES.includes(route))
            throw new Error(`Unknown production route ${route}.`);
    return selected;
}
function productionUnitId(requirementId) {
    return `unit_${requirementId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}
function assertProductionUnits(units) {
    const ids = new Set();
    for (const unit of units) {
        if (!hasText(unit.id) || ids.has(unit.id))
            throw new Error("Production unit IDs must be non-empty and unique.");
        ids.add(unit.id);
        if (!PRODUCTION_ROUTES.includes(unit.route))
            throw new Error(`Production unit ${unit.id} has an invalid route.`);
        if (!PRODUCTION_UNIT_STATUSES.includes(unit.status))
            throw new Error(`Production unit ${unit.id} has an invalid status.`);
        if (unit.requirementIds.length === 0 || unit.requirementIds.some((id) => !hasText(id)))
            throw new Error(`Production unit ${unit.id} needs requirement references.`);
        if (unit.dependencies.includes(unit.id))
            throw new Error(`Production unit ${unit.id} cannot depend on itself.`);
    }
}
function assertArticleDocument(document) {
    if (!hasText(document.id))
        throw new Error("Article document requires an ID.");
    assertPositiveInteger(document.revision, "Article document revision");
    if (!hasText(document.createdAt))
        throw new Error("Article document requires createdAt.");
    assertBranch(document.branch);
    if (document.blocks.length === 0)
        throw new Error("Article document needs at least one block.");
    const blockIds = new Set();
    for (const block of document.blocks) {
        if (!hasText(block.id) || blockIds.has(block.id))
            throw new Error("Article block IDs must be non-empty and unique.");
        blockIds.add(block.id);
        if (!ARTICLE_BLOCK_TYPES.includes(block.type))
            throw new Error(`Article block ${block.id} has an unsupported type.`);
        if (!hasText(block.sourceMasterRef))
            throw new Error(`Article block ${block.id} requires a source master reference.`);
        if (block.type === "image" && !hasText(block.assetId))
            throw new Error(`Image block ${block.id} requires an asset ID.`);
        if (block.type !== "divider" && block.type !== "image" && !hasText(block.content)) {
            throw new Error(`Article block ${block.id} requires content.`);
        }
    }
}
function assertArticleAssetManifest(manifest, document) {
    if (manifest.documentRevision !== document.revision)
        throw new Error("Asset manifest revision must match the article document.");
    const expectedAssetIds = document.blocks.filter((block) => block.type === "image").map((block) => block.assetId).sort();
    const actualAssetIds = manifest.items.map((item) => item.assetId).sort();
    if (new Set(actualAssetIds).size !== actualAssetIds.length)
        throw new Error("Asset manifest item asset IDs must be unique.");
    if (expectedAssetIds.join("\n") !== actualAssetIds.join("\n"))
        throw new Error("Asset manifest must cover exactly the article image assets.");
    for (const item of manifest.items) {
        if (!hasText(item.assetId) || !hasText(item.evidenceRole))
            throw new Error("Asset manifest items require assetId and evidenceRole.");
        if (!item.sourceArtifactIds.every(hasText))
            throw new Error(`Asset manifest item ${item.assetId} has an invalid source artifact ID.`);
    }
}
function assertProfileMatchesBranch(profile, branch) {
    if (profile.renderPreset.mode !== "preview_analogue")
        throw new Error("Article profile requires a preview_analogue render preset.");
    if (profile.platform !== branch.platform || profile.id !== branch.platformProfileId || profile.version !== branch.platformProfileVersion) {
        throw new Error("Article platform profile does not match this production branch.");
    }
}
/**
 * Product identity, people, and factual evidence are never silently accepted
 * by a generative/local path. Their manifest role keeps them visible in the
 * single complete-preview review action.
 */
function reviewTriggersFromManifest(manifest) {
    const text = manifest.items.map((item) => `${item.evidenceRole} ${item.constraints.join(" ")}`).join(" ").toLowerCase();
    const triggers = [];
    if (/\b(product|identity|brand)\b|产品|品牌|身份/.test(text))
        triggers.push("product_identity");
    if (/\b(person|people|portrait|founder|interview)\b|人物|真人|创始人|访谈/.test(text))
        triggers.push("people");
    if (/\b(evidence|fact|metric|data|result)\b|证据|事实|数据|指标|结果/.test(text))
        triggers.push("factual_evidence");
    return triggers;
}
function assertBranch(branch) {
    if (!hasText(branch.id) || !hasText(branch.parentMasterRevision) || !hasText(branch.platform) || !hasText(branch.platformProfileId) || !hasText(branch.platformProfileVersion) || !hasText(branch.createdAt)) {
        throw new Error("Article platform branch is incomplete.");
    }
}
function renderArticleBlock(block) {
    const id = escapeHtml(block.id);
    const source = escapeHtml(block.sourceMasterRef);
    const content = escapeHtml(block.content ?? "").replace(/\n/g, "<br>");
    const asset = block.assetId ? ` data-asset-id="${escapeHtml(block.assetId)}"` : "";
    switch (block.type) {
        case "heading": return `<h2 id="${id}" data-source-master="${source}">${content}</h2>`;
        case "paragraph": return `<p id="${id}" data-source-master="${source}">${content}</p>`;
        case "image": return `<figure id="${id}" data-source-master="${source}"${asset}><div class="asset-placeholder">${content || "Image asset"}</div></figure>`;
        case "quote": return `<blockquote id="${id}" data-source-master="${source}">${content}</blockquote>`;
        case "callout": return `<aside id="${id}" data-source-master="${source}">${content}</aside>`;
        case "code": return `<pre id="${id}" data-source-master="${source}"><code>${content}</code></pre>`;
        case "table": return `<div id="${id}" data-source-master="${source}" class="table-placeholder">${content}</div>`;
        case "divider": return `<hr id="${id}" data-source-master="${source}">`;
        case "cta": return `<p id="${id}" data-source-master="${source}" class="cta">${content}</p>`;
    }
}
function escapeHtml(value) {
    return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}
function hasText(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function assertPositiveInteger(value, label) {
    if (!Number.isInteger(value) || value <= 0)
        throw new Error(`${label} must be a positive integer.`);
}
const TRANSITIONS = {
    queued: ["active", "waiting_human", "needs_replan"],
    active: ["waiting_human", "review", "accepted", "needs_replan"],
    waiting_human: ["active", "review", "accepted", "needs_replan"],
    review: ["active", "accepted", "needs_replan"],
    accepted: [],
    needs_replan: ["queued"],
};
//# sourceMappingURL=production.js.map