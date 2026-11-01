export interface PromoWorkbenchLink {
    title: "Promo Workflow 工作台";
    url: string | null;
    workflowId: string | null;
    role: string;
    agentAction: string;
}
export declare function reviewUrlFor(baseUrl: string | undefined, workflowId: string | undefined): string | undefined;
export declare function workbenchFor(baseUrl: string | undefined, workflowId?: string | undefined): PromoWorkbenchLink;
