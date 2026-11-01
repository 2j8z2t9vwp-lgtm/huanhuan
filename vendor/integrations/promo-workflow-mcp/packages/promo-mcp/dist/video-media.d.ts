import type { IncomingMessage, ServerResponse } from "node:http";
/** Only a server-resolved, registered preview may enter this function. No client paths. */
export declare function serveVideoMedia(request: IncomingMessage, response: ServerResponse, preview: {
    locator: string;
    sha256: string;
}): Promise<void>;
