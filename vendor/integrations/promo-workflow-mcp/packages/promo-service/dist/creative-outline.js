import { STORY_ENGINE_SUGGESTIONS, } from "@promo-workflow/contracts";
import { createAgentWorkCapsule, createGuidanceRequest } from "./agent-work.js";
/**
 * The upper end of the agreed question range is the hard Grill cap.  This is
 * deliberately a pure calculation: the state machine owns the count.
 */
export function getOutlineGrillCap(budget) {
    return Math.min(6, budget.targetGrillQuestionRange[1]);
}
export function canAskOutlineGrillQuestion(answeredQuestionCount, budget) {
    assertQuestionCount(answeredQuestionCount);
    return answeredQuestionCount < getOutlineGrillCap(budget);
}
export function assertOutlineGrillCapacity(answeredQuestionCount, budget) {
    if (!canAskOutlineGrillQuestion(answeredQuestionCount, budget)) {
        throw new Error(`Outline Grill limit reached (${getOutlineGrillCap(budget)} questions).`);
    }
}
export function createCreativeOutlineBrief(input) {
    const recommendedStoryEngine = requiredText(input.recommendedStoryEngine ?? STORY_ENGINE_SUGGESTIONS[0], "recommendedStoryEngine");
    return createAgentWorkCapsule({
        stage: "creative_outline",
        inputs: {
            topicId: requiredText(input.topicId, "topicId"),
            baseline: input.baseline,
            selectedMaterials: [...input.selectedMaterials],
            productProfile: input.productProfile,
            budget: input.budget,
            recommendedStoryEngine,
            selectedRoute: input.selectedRoute,
            ...(input.priorDraft ? { priorDraft: input.priorDraft } : {}),
            ...(input.latestDecision ? { latestDecision: input.latestDecision } : {}),
        },
        constraints: [
            "Expand only the user-selected scene-led creative route; do not reopen unrelated routes.",
            "Create one cross-media creative spine before adapting it to the requested carrier.",
            "Use the locked baseline and selected materials as the evidence boundary; list unsupported claims explicitly.",
            `Use ${input.budget.carrier} ${input.budget.tier} budget: ${input.budget.beatRange[0]}-${input.budget.beatRange[1]} beats.`,
            input.budget.carrier === "video"
                ? `Video segment durations must total exactly ${input.budget.targetDurationSeconds} seconds.`
                : "Every article section needs a distinct sectionPurpose, non-empty content, and a section design: content sequence, expand/standard/brief emphasis, expression method, voice and rhythm, attention hook, and handoff to the next section.",
            "Apply geek-product-promo-writing at macro level only; do not write the finished manuscript or shot-by-shot script.",
            "For video, every outline segment must state its narrative task, visible promise, proof target, and transition so the service can issue a standalone outline script.",
            "Ask at most one consequential Grill question at a time, and only when it can change multiple beats or the evidence strategy.",
        ],
        requestedOutput: {
            description: "One selected route, one creative spine, one carrier-specific outline (including the video outline-script inputs), a macro-style review, and at most one scenario Grill question.",
            fields: ["selectedRouteId", "creativeSpine", "outline", "macroStyleReview", "pendingQuestion", "incorporatesDecisionIds"],
        },
        validationRules: [
            "selectedRouteId must equal the user-selected route; all creative-spine and macro-style fields must be non-empty.",
            "Video beat count and final edited duration must match the supplied budget.",
            "Article beat count must match the supplied budget; section ids and purposes must be unique.",
            "Submit through promo_commit(kind=submit_outline_draft).",
        ],
        nextCommitKind: "submit_outline_draft",
        decisionCard: {
            node: 3,
            label: "创意主线与文章/视频大纲",
            known: ["宣传意图和证据边界已锁定。"],
            recommendation: "先比较不同的场景切口，再把用户选中的那一条由宏观追问到可写、可拍的细节。",
            userDecision: "在 2-3 条互斥创意路线中选一条；之后每轮只回答一个会改变多个段落的场景问题。",
            whyItMatters: "路线决定开场张力、证明方式、段落推进与素材优先级。",
            nextArtifact: "03-creative-outline/locked-outline.json",
        },
        deliverable: {
            name: "creative outline",
            workspaceFile: "03-creative-outline/locked-outline.json",
            purpose: "后续扩写、分镜和跨载体改编的结构母版。",
        },
        guidance: createGuidanceRequest(input.budget.carrier === "video"
            ? ["human-language-writing", "promo-writing-supervision", "product-voiceover-campaign", "promo-deliverable-exemplars", "tim-cinematic-video-architecture"]
            : ["article-planning-router", "human-language-writing", "promo-writing-supervision", "product-tweet-human-center-outline"]),
    });
}
/** Parses unknown Agent output into the shared contract and rejects invalid structure. */
export function readCreativeOutlineDraft(value, budget) {
    if (!isRecord(value))
        throw new Error("Outline draft is required.");
    const selectedRouteId = requiredText(value.selectedRouteId, "selectedRouteId");
    const creativeSpine = readCreativeSpine(value.creativeSpine);
    if (creativeSpine.routeId !== selectedRouteId)
        throw new Error("creativeSpine.routeId must equal selectedRouteId.");
    const outline = readCarrierOutline(value.outline, budget);
    const macroStyleReview = readMacroStyleReview(value.macroStyleReview);
    return {
        selectedRouteId,
        creativeSpine,
        outline,
        macroStyleReview,
        pendingQuestion: value.pendingQuestion === null || value.pendingQuestion === undefined
            ? null
            : readScenarioQuestion(value.pendingQuestion),
        incorporatesDecisionIds: readTextArray(value.incorporatesDecisionIds, "outlineDraft.incorporatesDecisionIds"),
    };
}
function readScenarioQuestion(value) {
    if (!isRecord(value) || !Array.isArray(value.options))
        throw new Error("outlineDraft.pendingQuestion must be a scenario Grill question.");
    if (value.options.length < 2 || value.options.length > 3)
        throw new Error("outline Grill requires 2-3 options.");
    const options = value.options.map((option, index) => {
        if (!isRecord(option))
            throw new Error(`outlineDraft.pendingQuestion.options[${index}] must be an object.`);
        return {
            id: requiredText(option.id, `outlineDraft.pendingQuestion.options[${index}].id`),
            label: requiredText(option.label, `outlineDraft.pendingQuestion.options[${index}].label`),
            rationale: requiredText(option.rationale, `outlineDraft.pendingQuestion.options[${index}].rationale`),
        };
    });
    const recommendedOptionId = requiredText(value.recommendedOptionId, "outlineDraft.pendingQuestion.recommendedOptionId");
    if (!options.some((option) => option.id === recommendedOptionId))
        throw new Error("outline Grill recommendation must identify an option.");
    return {
        id: requiredText(value.id, "outlineDraft.pendingQuestion.id"),
        scene: requiredText(value.scene, "outlineDraft.pendingQuestion.scene"),
        tension: requiredText(value.tension, "outlineDraft.pendingQuestion.tension"),
        prompt: requiredText(value.prompt, "outlineDraft.pendingQuestion.prompt"),
        options,
        recommendedOptionId,
        affectedDeliverables: readTextArray(value.affectedDeliverables, "outlineDraft.pendingQuestion.affectedDeliverables"),
    };
}
function readCreativeSpine(value) {
    if (!isRecord(value))
        throw new Error("creativeSpine is required.");
    return {
        routeId: requiredText(value.routeId, "creativeSpine.routeId"),
        creativePremise: requiredText(value.creativePremise, "creativeSpine.creativePremise"),
        storyEngine: requiredText(value.storyEngine, "creativeSpine.storyEngine"),
        narrativeAnchor: requiredText(value.narrativeAnchor, "creativeSpine.narrativeAnchor"),
        openingMove: requiredText(value.openingMove, "creativeSpine.openingMove"),
        progression: requiredText(value.progression, "creativeSpine.progression"),
        proofPlan: requiredText(value.proofPlan, "creativeSpine.proofPlan"),
        endingMove: requiredText(value.endingMove, "creativeSpine.endingMove"),
        macroStyle: readMacroStyleFrame(value.macroStyle),
    };
}
function readMacroStyleFrame(value) {
    if (!isRecord(value))
        throw new Error("creativeSpine.macroStyle is required.");
    return {
        speakerPosition: requiredText(value.speakerPosition, "creativeSpine.macroStyle.speakerPosition"),
        readerRelationship: requiredText(value.readerRelationship, "creativeSpine.macroStyle.readerRelationship"),
        promotionalTemperature: requiredText(value.promotionalTemperature, "creativeSpine.macroStyle.promotionalTemperature"),
        technicalDepth: requiredText(value.technicalDepth, "creativeSpine.macroStyle.technicalDepth"),
        emotionalArc: requiredText(value.emotionalArc, "creativeSpine.macroStyle.emotionalArc"),
        endingAltitude: requiredText(value.endingAltitude, "creativeSpine.macroStyle.endingAltitude"),
    };
}
function readMacroStyleReview(value) {
    if (!isRecord(value))
        throw new Error("macroStyleReview is required.");
    if (value.skill !== "geek-product-promo-writing") {
        throw new Error("macroStyleReview.skill must be geek-product-promo-writing.");
    }
    if (value.scope !== "macro")
        throw new Error("macroStyleReview.scope must be macro.");
    if (typeof value.passed !== "boolean")
        throw new Error("macroStyleReview.passed must be boolean.");
    return {
        skill: "geek-product-promo-writing",
        scope: "macro",
        passed: value.passed,
        findings: readTextArray(value.findings, "macroStyleReview.findings"),
    };
}
function readCarrierOutline(value, budget) {
    if (!isRecord(value))
        throw new Error("outline is required.");
    if (budget.carrier === "video")
        return readVideoOutline(value, budget);
    return readArticleOutline(value, budget);
}
function readVideoOutline(value, budget) {
    if (value.carrier !== "video")
        throw new Error("outline.carrier must be video for a video budget.");
    const segments = readVideoSegments(value.segments);
    assertBeatCount(segments.length, budget, "Video segment");
    const duration = segments.reduce((total, segment) => total + segment.durationSeconds, 0);
    if (duration !== budget.targetDurationSeconds) {
        throw new Error(`Video segment duration must total ${budget.targetDurationSeconds} seconds; received ${duration}.`);
    }
    return {
        carrier: "video",
        hookAndFirstFrame: requiredText(value.hookAndFirstFrame, "outline.hookAndFirstFrame"),
        segments,
        unsupportedClaims: readTextArray(value.unsupportedClaims, "outline.unsupportedClaims"),
        ending: requiredText(value.ending, "outline.ending"),
        primaryCallToAction: nullableText(value.primaryCallToAction, "outline.primaryCallToAction"),
    };
}
function readVideoSegments(value) {
    if (!Array.isArray(value))
        throw new Error("outline.segments must be an array.");
    const ids = new Set();
    return value.map((segment, index) => {
        if (!isRecord(segment))
            throw new Error(`outline.segments[${index}] must be an object.`);
        const id = requiredText(segment.id, `outline.segments[${index}].id`);
        if (ids.has(id))
            throw new Error(`outline.segments contains duplicate id: ${id}.`);
        ids.add(id);
        const durationSeconds = requiredPositiveInteger(segment.durationSeconds, `outline.segments[${index}].durationSeconds`);
        return {
            id,
            durationSeconds,
            segmentPurpose: requiredText(segment.segmentPurpose, `outline.segments[${index}].segmentPurpose`),
            speaker: nullableText(segment.speaker, `outline.segments[${index}].speaker`),
            speakerAction: nullableText(segment.speakerAction, `outline.segments[${index}].speakerAction`),
            spokenFunction: nullableText(segment.spokenFunction, `outline.segments[${index}].spokenFunction`),
            presentation: nullableText(segment.presentation, `outline.segments[${index}].presentation`),
            visualFunction: nullableText(segment.visualFunction, `outline.segments[${index}].visualFunction`),
            evidence: readTextArray(segment.evidence, `outline.segments[${index}].evidence`),
            transition: nullableText(segment.transition, `outline.segments[${index}].transition`),
        };
    });
}
function readArticleOutline(value, budget) {
    if (value.carrier !== "article")
        throw new Error("outline.carrier must be article for an article budget.");
    const sections = readArticleSections(value.sections);
    assertBeatCount(sections.length, budget, "Article section");
    return {
        carrier: "article",
        editorialIntent: readArticleEditorialIntent(value.editorialIntent),
        openingDirection: requiredText(value.openingDirection, "outline.openingDirection"),
        sections,
        titleDirections: readTextArray(value.titleDirections, "outline.titleDirections"),
        unsupportedClaims: readTextArray(value.unsupportedClaims, "outline.unsupportedClaims"),
        ending: requiredText(value.ending, "outline.ending"),
        primaryCallToAction: nullableText(value.primaryCallToAction, "outline.primaryCallToAction"),
    };
}
function readArticleEditorialIntent(value) {
    if (!isRecord(value))
        throw new Error("outline.editorialIntent is required for article workflows.");
    if (value.proseLooseness !== undefined && value.proseLooseness !== null && (typeof value.proseLooseness !== "number" || !Number.isInteger(value.proseLooseness) || value.proseLooseness < 0 || value.proseLooseness > 100))
        throw new Error("proseLooseness must be null or an integer from 0 to 100.");
    return {
        ...(value.proseLooseness === undefined ? {} : { proseLooseness: value.proseLooseness }),
        ...(value.articleForm === undefined ? {} : { articleForm: requiredText(value.articleForm, "outline.editorialIntent.articleForm") }),
        ...(value.narrativeStrategy === undefined ? {} : { narrativeStrategy: requiredText(value.narrativeStrategy, "outline.editorialIntent.narrativeStrategy") }),
        ...(value.voiceAndTone === undefined ? {} : { voiceAndTone: requiredText(value.voiceAndTone, "outline.editorialIntent.voiceAndTone") }),
        ...(value.readerRelationship === undefined ? {} : { readerRelationship: requiredText(value.readerRelationship, "outline.editorialIntent.readerRelationship") }),
        readerDecision: requiredText(value.readerDecision, "outline.editorialIntent.readerDecision"),
        humanCenter: requiredText(value.humanCenter, "outline.editorialIntent.humanCenter"),
        authorStance: requiredText(value.authorStance, "outline.editorialIntent.authorStance"),
        warmThread: requiredText(value.warmThread, "outline.editorialIntent.warmThread"),
        emotionalArc: requiredText(value.emotionalArc, "outline.editorialIntent.emotionalArc"),
        evidencePosture: requiredText(value.evidencePosture, "outline.editorialIntent.evidencePosture"),
    };
}
function readArticleSections(value) {
    if (!Array.isArray(value))
        throw new Error("outline.sections must be an array.");
    const ids = new Set();
    const purposes = new Set();
    return value.map((section, index) => {
        if (!isRecord(section))
            throw new Error(`outline.sections[${index}] must be an object.`);
        const id = requiredText(section.id, `outline.sections[${index}].id`);
        if (ids.has(id))
            throw new Error(`outline.sections contains duplicate id: ${id}.`);
        ids.add(id);
        const sectionPurpose = requiredText(section.sectionPurpose, `outline.sections[${index}].sectionPurpose`);
        const purposeKey = sectionPurpose.toLocaleLowerCase();
        if (purposes.has(purposeKey)) {
            throw new Error(`outline.sections contains duplicate sectionPurpose: ${sectionPurpose}.`);
        }
        purposes.add(purposeKey);
        return {
            id,
            sectionPurpose,
            sceneOrAction: requiredText(section.sceneOrAction, `outline.sections[${index}].sceneOrAction`),
            content: requiredText(section.content, `outline.sections[${index}].content`),
            readerShift: nullableText(section.readerShift, `outline.sections[${index}].readerShift`),
            evidence: readTextArray(section.evidence, `outline.sections[${index}].evidence`),
            authorJudgment: nullableText(section.authorJudgment, `outline.sections[${index}].authorJudgment`),
            avoid: nullableText(section.avoid, `outline.sections[${index}].avoid`),
            transition: nullableText(section.transition, `outline.sections[${index}].transition`),
            visualAsset: nullableText(section.visualAsset, `outline.sections[${index}].visualAsset`),
            design: readArticleSectionDesign(section.design, id, sectionPurpose, section.transition),
        };
    });
}
function readArticleSectionDesign(value, id, purpose, transition) {
    if (value === undefined) {
        return {
            contentSequence: `Legacy outline: retain the existing content sequence for ${purpose}.`,
            emphasis: "standard",
            expressionMethod: "Use the existing scene, evidence and author judgment without adding unsupported material.",
            voiceAndRhythm: "Follow the locked editorial intent and prose looseness setting.",
            attentionHook: `Make this section's distinct purpose (${purpose}) clear to the reader.`,
            handoff: typeof transition === "string" && transition.trim() ? transition.trim() : `Leave the condition that lets the next section follow ${id}.`,
        };
    }
    if (!isRecord(value))
        throw new Error(`outline.sections.${id}.design must be an object.`);
    if (value.emphasis !== "expand" && value.emphasis !== "standard" && value.emphasis !== "brief")
        throw new Error(`outline.sections.${id}.design.emphasis must be expand, standard, or brief.`);
    return {
        contentSequence: requiredText(value.contentSequence, `outline.sections.${id}.design.contentSequence`),
        emphasis: value.emphasis,
        expressionMethod: requiredText(value.expressionMethod, `outline.sections.${id}.design.expressionMethod`),
        voiceAndRhythm: requiredText(value.voiceAndRhythm, `outline.sections.${id}.design.voiceAndRhythm`),
        attentionHook: requiredText(value.attentionHook, `outline.sections.${id}.design.attentionHook`),
        handoff: requiredText(value.handoff, `outline.sections.${id}.design.handoff`),
    };
}
function assertBeatCount(count, budget, label) {
    const [minimum, maximum] = budget.beatRange;
    if (count < minimum || count > maximum) {
        throw new Error(`${label} count must be ${minimum}-${maximum}; received ${count}.`);
    }
}
function assertQuestionCount(value) {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error("answeredQuestionCount must be a non-negative integer.");
    }
}
function requiredText(value, field) {
    if (typeof value !== "string" || !value.trim())
        throw new Error(`${field} must be non-empty text.`);
    return value.trim();
}
function nullableText(value, field) {
    if (value === null || value === undefined)
        return null;
    return requiredText(value, field);
}
function readTextArray(value, field) {
    if (!Array.isArray(value))
        throw new Error(`${field} must be an array.`);
    return value.map((item, index) => requiredText(item, `${field}[${index}]`));
}
function requiredPositiveInteger(value, field) {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
        throw new Error(`${field} must be a positive integer.`);
    }
    return value;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=creative-outline.js.map