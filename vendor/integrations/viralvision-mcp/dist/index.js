#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerWatch } from "./tools/watch.js";
import { registerInfo } from "./tools/info.js";
import { registerSetup } from "./tools/setup.js";
import { registerTranscript } from "./tools/transcript.js";
const server = new McpServer({
    name: "viralvision-mcp",
    version: "1.0.0",
    description: "Give Claude eyes on any social video — YouTube, Instagram, TikTok, Twitter, and more",
});
registerWatch(server);
registerInfo(server);
registerSetup(server);
registerTranscript(server);
const transport = new StdioServerTransport();
await server.connect(transport);
