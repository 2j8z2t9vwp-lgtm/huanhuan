import type { ArtifactRecord, ArtifactRef, WriteArtifactInput } from "./types.js";
export declare class ArtifactStore {
    private readonly directory;
    constructor(directory: string);
    write(input: WriteArtifactInput): Promise<ArtifactRef>;
    read(artifactId: string): Promise<ArtifactRecord>;
    remove(artifactIds: readonly string[]): Promise<void>;
    private pathFor;
}
