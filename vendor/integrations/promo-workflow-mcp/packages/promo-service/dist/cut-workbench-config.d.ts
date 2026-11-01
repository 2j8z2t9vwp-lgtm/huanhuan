export interface CutWorkbenchLocalConfig {
    sourceDirectory: string;
    runtimeDirectory: string;
    pythonPath?: string;
    runtimeConfigPath?: string;
}
export declare function localPromoConfigPath(environment?: NodeJS.ProcessEnv): string;
/**
 * Loads only the narrow, user-managed local bridge configuration. Malformed or
 * absent configuration is intentionally equivalent to no optional bridge.
 */
export declare function readCutWorkbenchLocalConfig(environment?: NodeJS.ProcessEnv): CutWorkbenchLocalConfig | undefined;
export declare function configuredCutWorkbench(environment?: NodeJS.ProcessEnv): CutWorkbenchLocalConfig | undefined;
