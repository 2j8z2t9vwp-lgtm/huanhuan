import type { ProductionUnit } from "@promo-workflow/contracts";
import type { ArtifactRef } from "./artifacts/types.js";
export type AcceptedArtifactRef = Omit<ArtifactRef, "parentArtifactIds"> & {
    parentArtifactIds: readonly string[];
};
/**
 * The small immutable hand-off from a carrier backend back to Promo. It
 * carries evidence only; route, requirements, dependencies, and unit status
 * remain owned by the production plan.
 */
export interface ProductionUnitAcceptanceResult {
    unitId: string;
    acceptedArtifactRefs: readonly AcceptedArtifactRef[];
    provenanceNote: string;
    backendRevision: number;
}
export interface ValidateProductionResultsInput {
    /** The original plan whose route/requirements/dependencies are authoritative. */
    plannedUnits: readonly ProductionUnit[];
    /** The backend's current view. Only status may differ from the plan. */
    currentUnits: readonly ProductionUnit[];
    results: readonly ProductionUnitAcceptanceResult[];
    /**
     * Required inputs expressed as artifact IDs. Each must be present either as
     * an accepted output or in an accepted output's immutable parent lineage.
     */
    requiredSourceArtifactIdsByUnit?: Readonly<Record<string, readonly string[]>> | undefined;
}
/**
 * Validates a production result batch and returns a detached immutable value.
 * A result is allowed only for a known, accepted unit; all accepted units
 * require exactly one result. This keeps carrier evidence auditable without
 * importing a second backend state machine into Promo.
 */
export declare function validateProductionResults(input: ValidateProductionResultsInput): readonly ProductionUnitAcceptanceResult[];
