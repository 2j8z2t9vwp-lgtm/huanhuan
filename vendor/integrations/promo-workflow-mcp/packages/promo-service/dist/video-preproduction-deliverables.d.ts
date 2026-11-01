import type { LockedCreativeOutline, VideoTimelineMaster } from "@promo-workflow/contracts";
import type { CompiledRequirementSet } from "./requirements-compiler.js";
/**
 * These are deliberately derived, inspection-ready handoffs. They do not
 * assign people or select production software; Node 6 owns both decisions.
 */
export declare function createOutlineScript(outline: LockedCreativeOutline): Record<string, unknown>;
export declare function createSpokenScript(master: VideoTimelineMaster): Record<string, unknown>;
export declare function createRecordingExecution(master: VideoTimelineMaster): Record<string, unknown>;
export declare function createPreproductionMaterialPlan(master: VideoTimelineMaster, requirements: CompiledRequirementSet): Record<string, unknown>;
