import type { CutWorkbenchBridge, CutWorkbenchBridgeInput, CutWorkbenchProductionResult } from "./cut-workbench-bridge.js";
export interface CutWorkbenchStdioBridgeOptions {
    command: string;
    args: readonly string[];
    cwd?: string | undefined;
    env?: NodeJS.ProcessEnv | undefined;
}
/**
 * A local-only bridge to Cut Workbench's public stdio MCP surface.  Promo
 * starts this command only while reconciling its production node; the normal
 * Agent-facing Workbench MCP remains a separate process and owns every edit,
 * review, artifact, and delivery decision.
 */
export declare class CutWorkbenchStdioBridge implements CutWorkbenchBridge {
    private readonly options;
    constructor(options: CutWorkbenchStdioBridgeOptions);
    static fromEnvironment(environment?: NodeJS.ProcessEnv): CutWorkbenchStdioBridge | undefined;
    run(input: CutWorkbenchBridgeInput): Promise<CutWorkbenchProductionResult>;
    private inspectOrCreate;
}
