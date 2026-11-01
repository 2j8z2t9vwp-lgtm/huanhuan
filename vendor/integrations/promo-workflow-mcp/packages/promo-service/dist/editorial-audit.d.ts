import type { MasterReview } from "@promo-workflow/contracts";
/** Shared canonical hash for requirements, submitted text and audit receipts. */
export declare function contentHash(value: unknown): string;
export declare function readAudit(value: unknown): NonNullable<MasterReview["audit"]> | undefined;
export declare function validateEditorialAudit(review: MasterReview, master: unknown, requirements: unknown): void;
