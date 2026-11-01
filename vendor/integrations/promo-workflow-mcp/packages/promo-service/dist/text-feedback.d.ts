import type { ArtifactRecord } from "./artifacts/types.js";
export interface TextAnchor {
    field: string;
    start: number;
    end: number;
    quote: string;
    prefix: string;
    suffix: string;
}
export interface TextAnnotation {
    id: string;
    revision: number;
    artifactId: string;
    contentHash: string;
    anchors: TextAnchor[];
    body: string;
    withdrawn: boolean;
    at: string;
}
export interface AnnotationReceipt {
    annotationId: string;
    annotationRevision: number;
    action: "changed" | "explained" | "needs_input";
    reply: string;
    targetArtifactId?: string;
    verification?: string;
    at: string;
}
export interface TextFeedback {
    annotations: TextAnnotation[];
    receipts: AnnotationReceipt[];
}
export declare function feedbackFor(value: unknown): TextFeedback;
export declare function latestAnnotations(feedback: TextFeedback): TextAnnotation[];
export declare function feedbackSnapshot(feedback: TextFeedback): {
    items: {
        receipt: AnnotationReceipt | null;
        status: string;
        id: string;
        revision: number;
        artifactId: string;
        contentHash: string;
        anchors: TextAnchor[];
        body: string;
        withdrawn: boolean;
        at: string;
    }[];
    pending: {
        receipt: AnnotationReceipt | null;
        status: string;
        id: string;
        revision: number;
        artifactId: string;
        contentHash: string;
        anchors: TextAnchor[];
        body: string;
        withdrawn: boolean;
        at: string;
    }[];
    awaitingVerification: {
        receipt: AnnotationReceipt | null;
        status: string;
        id: string;
        revision: number;
        artifactId: string;
        contentHash: string;
        anchors: TextAnchor[];
        body: string;
        withdrawn: boolean;
        at: string;
    }[];
    needsInput: {
        receipt: AnnotationReceipt | null;
        status: string;
        id: string;
        revision: number;
        artifactId: string;
        contentHash: string;
        anchors: TextAnchor[];
        body: string;
        withdrawn: boolean;
        at: string;
    }[];
    instruction: string;
};
/** JSON-pointer keys, UTF-16 offsets, exact source strings: no trimming or Markdown normalization. */
export declare function textFields(value: unknown, path?: string): {
    field: string;
    text: string;
}[];
/**
 * The text desk is an editorial surface, not a JSON inspector.  Keep its
 * allow-list here, next to anchor validation, so the browser cannot expose or
 * accept feedback on IDs, audit records, workflow state, or implementation
 * metadata even if a client is stale or modified.
 */
export declare function annotationFields(kind: string, value: unknown): {
    field: string;
    text: string;
}[];
export declare function isTextArtifact(kind: string): boolean;
export declare function textFamily(kind: string): string;
export declare function validateAnnotation(input: Record<string, unknown>, artifact: ArtifactRecord, previous?: TextAnnotation): TextAnnotation;
/** Conservative remapping. Ambiguous/deleted selections remain on their original version. */
export declare function locateAnchor(anchor: TextAnchor, text: string): {
    start: number;
    end: number;
} | null;
export declare function readReceipts(value: unknown, feedback: TextFeedback, newArtifacts: ArtifactRecord[], originals?: ArtifactRecord[]): AnnotationReceipt[];
