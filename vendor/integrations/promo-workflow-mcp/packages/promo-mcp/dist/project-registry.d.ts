type RecordValue = Record<string, any>;
export interface RegisteredProject {
    projectId: string;
    rootDirectory: string;
    dataDirectory: string;
    registeredAt: string;
}
export interface ProjectCheck extends RegisteredProject {
    status: 'ready' | 'attention' | 'unavailable';
    issues: string[];
    workflows: RecordValue[];
}
export declare function defaultRegistryPath(): string;
/** Stores locations only. Scanning never advances a workflow or rewrites its data. */
export declare class ProjectRegistry {
    readonly filePath: string;
    readonly localDataDirectory: string;
    constructor(filePath: string, localDataDirectory: string);
    entries(): Promise<RegisteredProject[]>;
    register(rootDirectory: string, dataDirectory?: string): Promise<RegisteredProject>;
    records(dataDirectory: string): Promise<RecordValue[]>;
    private matchesRoot;
    /** Bootstrap known workspaces from the active store; no recursive directory discovery. */
    discoverCurrent(): Promise<string[]>;
    scan(): Promise<{
        checkedAt: string;
        projects: ProjectCheck[];
    }>;
    locations(): Promise<Map<string, string[]>>;
    locate(workflowId: string): Promise<string>;
}
export {};
