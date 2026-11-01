export type ProductionAdapterCapability = "cut_workbench" | "vectcut";
export interface ProductionAdapterDescriptor {
    schemaVersion: 1;
    id: string;
    capability: ProductionAdapterCapability;
    displayName: string;
    requiredEnv: readonly string[];
    optionalEnv: readonly string[];
    remediation: string;
}
export interface ProductionAdapterStatus {
    id: string;
    capability: ProductionAdapterCapability;
    displayName: string;
    installed: boolean;
    configured: boolean;
    available: boolean;
    mode: "plugin" | "manual" | "unavailable";
    configurationSource: "environment" | "local_config" | "missing";
    missingEnvironment: readonly string[];
    remediation: string;
}
export interface DiscoverAdapterStatusOptions {
    environment?: NodeJS.ProcessEnv;
    adapterDirs?: readonly string[];
    codexHome?: string;
}
/**
 * Reports adapter capability without loading arbitrary plugin code. Adapters
 * declare a small JSON contract; the MCP keeps ownership of process startup,
 * network calls, state transitions, and capability-gap behavior.
 */
export declare function discoverAdapterStatus(options?: DiscoverAdapterStatusOptions): readonly ProductionAdapterStatus[];
