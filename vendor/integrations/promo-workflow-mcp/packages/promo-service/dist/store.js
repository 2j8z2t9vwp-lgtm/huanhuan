import { mkdir, readFile, rename, writeFile, rmdir } from "node:fs/promises";
import { dirname } from "node:path";
const EMPTY_STORE = {
    schemaVersion: 1,
    workflows: {},
};
export class JsonWorkflowStore {
    filePath;
    constructor(filePath) {
        this.filePath = filePath;
    }
    /** Serialize read-modify-write across MCP and review-host processes. Never steal a live lock. */
    async exclusive(operation) {
        await mkdir(dirname(this.filePath), { recursive: true });
        const lock = `${this.filePath}.lock`;
        const deadline = Date.now() + 10000;
        for (;;) {
            try {
                await mkdir(lock);
                break;
            }
            catch (error) {
                if (error.code !== "EEXIST")
                    throw error;
                if (Date.now() >= deadline)
                    throw new Error(`Workflow store busy (${lock}); retry, or inspect an abandoned lock after a crashed writer.`);
                await new Promise(resolve => setTimeout(resolve, 40));
            }
        }
        try {
            return await operation();
        }
        finally {
            await rmdir(lock);
        }
    }
    async read() {
        try {
            const source = await readFile(this.filePath, "utf8");
            const parsed = JSON.parse(source);
            if (!isStore(parsed)) {
                throw new Error("invalid workflow store shape");
            }
            return parsed;
        }
        catch (error) {
            if (isMissingFile(error)) {
                return structuredClone(EMPTY_STORE);
            }
            throw new Error(`Cannot read workflow store: ${messageOf(error)}`);
        }
    }
    async write(data) {
        await mkdir(dirname(this.filePath), { recursive: true });
        const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
        await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
        await rename(temporaryPath, this.filePath);
    }
}
function isStore(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value;
    return candidate.schemaVersion === 1 && typeof candidate.workflows === "object";
}
function isMissingFile(error) {
    return typeof error === "object" && error !== null && error.code === "ENOENT";
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=store.js.map