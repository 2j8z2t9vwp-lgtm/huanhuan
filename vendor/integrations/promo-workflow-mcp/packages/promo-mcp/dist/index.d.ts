import { McpServer } from "@modelcontextprotocol/server";
import { type ProductionAdapterStatus } from "./adapter-registry.js";
import { ProjectRegistry } from './project-registry.js';
import { WorkflowService } from "@promo-workflow/service";
export interface PromoRuntimeStatus {
    adapterStatus: readonly ProductionAdapterStatus[];
    reviewUrl?: string | undefined;
    registry?: ProjectRegistry;
    serviceForDataDirectory?: (directory: string) => WorkflowService;
}
export declare function createPromoServer(service: WorkflowService, runtime?: PromoRuntimeStatus): McpServer;
