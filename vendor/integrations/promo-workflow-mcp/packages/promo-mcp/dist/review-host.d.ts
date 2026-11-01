import { type Server } from "node:http";
import { ProjectRegistry } from './project-registry.js';
interface ReviewHostOptions {
    dataDirectory: string;
    registry?: ProjectRegistry;
    host?: string | undefined;
    port?: number | undefined;
}
/**
 * Local review server. Read surfaces use workflow-scoped artifacts and registered
 * media; annotation writes require a same-origin session token. No directory is static.
 */
export declare function createReviewHost(options: ReviewHostOptions): Server;
export declare function startReviewHost(options: ReviewHostOptions): Promise<Server>;
export {};
