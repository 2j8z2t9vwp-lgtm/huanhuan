import type { ArticleManuscriptMaster } from "@promo-workflow/contracts";
/**
 * The reviewable, source-bound projection used before article production.
 * Markdown remains canonical; this object is deliberately an immutable view.
 */
export interface ManuscriptRender {
    schemaVersion: 1;
    renderer: "promo-md2html";
    renderProfile: "workbench";
    sourceArtifactId: string;
    sourceContentHash: string;
    title: string;
    stage?: "text" | "planned" | "release";
    html: string;
    blocks: readonly ManuscriptRenderBlock[];
}
export interface ManuscriptRenderBlock {
    id: string;
    kind: "heading" | "paragraph" | "quote" | "list" | "code" | "divider";
    sourceLineStart: number;
    sourceLineEnd: number;
}
export declare function renderManuscript(master: ArticleManuscriptMaster, sourceArtifactId: string, sourceContentHash: string): ManuscriptRender;
/** Node 5 shows the same manuscript with actual-size material reservations. */
export declare function renderMaterialPreview(master: ArticleManuscriptMaster, sourceArtifactId: string, sourceContentHash: string, requirements: readonly {
    materialType: string;
    usages: readonly {
        usageId: string;
        purpose: string;
    }[];
}[]): ManuscriptRender;
/** Node 7 adds the selected publishing package without modifying N6 content. */
export declare function renderReleasePreview(preview: {
    html: string;
}, sourceArtifactId: string, title: string, summary: string, coverArtifactId: string): ManuscriptRender;
