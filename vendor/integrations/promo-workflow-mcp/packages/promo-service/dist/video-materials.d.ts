import type { ArtifactStore } from "./artifacts/store.js";
import type { ProductionUnitAcceptanceResult } from "./production-results.js";
export interface VideoMaterial {
    unitId: string;
    artifactId: string;
    artifactContentHash: string;
    locator: string;
    sha256: string;
    provenance: string;
}
/** Only documented locator keys in material containers are interpreted as files. Prose is never a path. */
export declare function resolveVideoMaterials(results: readonly ProductionUnitAcceptanceResult[], store: ArtifactStore): Promise<{
    assets: VideoMaterial[];
    blockers: string[];
}>;
