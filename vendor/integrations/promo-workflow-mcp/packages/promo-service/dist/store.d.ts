import type { WorkflowStoreData } from "./types.js";
export declare class JsonWorkflowStore {
    private readonly filePath;
    constructor(filePath: string);
    /** Serialize read-modify-write across MCP and review-host processes. Never steal a live lock. */
    exclusive<T>(operation: () => Promise<T>): Promise<T>;
    read(): Promise<WorkflowStoreData>;
    write(data: WorkflowStoreData): Promise<void>;
}
