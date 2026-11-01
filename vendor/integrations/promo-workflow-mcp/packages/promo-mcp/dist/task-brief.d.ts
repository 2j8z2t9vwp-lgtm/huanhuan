/** User-facing guidance is deliberately separate from the agent's tool schema. */
export declare function readableTaskBrief(node: number, carrier: string, production: Record<string, unknown> | null): {
    status: string;
    doing: string;
    output: string;
    check: string;
};
