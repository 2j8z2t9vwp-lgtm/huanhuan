import type { ContentBudget, ContentMaster, LockedCreativeOutline } from "@promo-workflow/contracts";
import { type AgentWorkCapsule } from "./agent-work.js";
export interface CreateMasterDevelopmentBriefInput {
    currentRequirements?: unknown;
    creativeOutline: LockedCreativeOutline;
    selectedMaterials: readonly string[];
    productContext: unknown;
}
export interface MasterDraftValidationInput {
    budget?: ContentBudget | undefined;
}
export interface MasterDraftValidation {
    passed: boolean;
    errors: readonly string[];
    warnings: readonly string[];
}
/**
 * Creates the soft-work capsule for Node 4. The Agent writes the master; this
 * service module only gives it a stable target shape and validates the result.
 */
export declare function createMasterDevelopmentBrief(input: CreateMasterDevelopmentBriefInput): AgentWorkCapsule;
/** Parses untrusted Agent output into the contract's carrier-specific master. */
export declare function readMasterDraft(value: unknown): ContentMaster;
/** Deterministic structural validation used before a draft can enter Grill/lock. */
export declare function validateMasterDraft(master: ContentMaster, input?: MasterDraftValidationInput): MasterDraftValidation;
