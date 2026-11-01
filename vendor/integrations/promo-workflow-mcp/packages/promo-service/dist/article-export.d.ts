import type { ArticleManuscriptMaster } from "@promo-workflow/contracts";
/**
 * Two portable projections of an article master. Markdown remains the useful
 * text-first handoff; HTML is a self-contained visual reference that can be
 * opened locally or copied into a rich-text editor without the workbench.
 */
export interface ArticleExport {
    markdown: string;
    html: string;
    /** Inline-styled fragment intended for rich-text clipboard handoff. */
    feishuHtml: string;
}
export declare function exportArticle(master: ArticleManuscriptMaster, sourceArtifactId: string, sourceContentHash: string): ArticleExport;
