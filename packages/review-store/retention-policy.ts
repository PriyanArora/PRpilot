import type { ReviewStoreRecordKind } from "./persistence-records";

export type RetentionPolicy = Record<ReviewStoreRecordKind, number>;

export const P7_RETENTION_DAYS: RetentionPolicy = {
    DELIVERY: 14,
    RUN: 30,
    ATTEMPT: 14,
    COUNTER: 2,
    LOCK: 1
};

export const p7RetentionWindows = {
    delivery: "14 days for webhook idempotency and duplicate-delivery audit visibility.",
    run: "30 days for recent PR review history and lightweight troubleshooting.",
    attempt: "14 days for retry and worker failure investigation.",
    counter: "2 days because quota counters reset daily and only need a small overlap window.",
    lock: "1 day because deep-lane locks are short-lived operational guards."
} as const;

export function toTtlEpochSeconds(now: Date, retentionDays: number): number {
    return Math.floor(now.getTime() / 1000) + retentionDays * 24 * 60 * 60;
}
