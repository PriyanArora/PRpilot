import type { BudgetMode, Lane } from "../config/runtime-policy";
import type { CheckRunConclusion } from "../rules/check-run-payload-input";
import type { Coverage, CoverageStatus } from "../rules/coverage";
import type { ReviewJob, ReviewJobTrigger } from "../queue/review-job";

export type ReviewStoreRecordKind = "DELIVERY" | "RUN" | "ATTEMPT" | "COUNTER" | "LOCK";

export type ReviewStoreBaseItem = {
    pk: string;
    sk: string;
    entityType: ReviewStoreRecordKind;
    createdAt: string;
    updatedAt: string;
    ttl: number;
    retentionDays: number;
};

export type DeliveryState =
    | "RECEIVED"
    | "REJECTED"
    | "DUPLICATE"
    | "SUPERSEDED"
    | "ENQUEUED"
    | "PROCESSING"
    | "PUBLISHED"
    | "FAILED";

export type DeliveryTransition = {
    state: DeliveryState;
    at: string;
    reason?: string;
};

export type DeliveryItem = ReviewStoreBaseItem & {
    entityType: "DELIVERY";
    deliveryId: string;
    state: DeliveryState;
    eventName: string;
    action: string;
    trigger: ReviewJobTrigger;
    repositoryId: number;
    repositoryFullName: string;
    installationId: number;
    prNumber: number;
    lane: Lane;
    headSha: string;
    baseSha: string;
    senderLogin?: string;
    requestId?: string;
    firstSeenAt: string;
    lastSeenAt: string;
    receivedAt: string;
    enqueuedAt?: string;
    processingAt?: string;
    publishedAt?: string;
    failedAt?: string;
    duplicateCount: number;
    duplicateOfDeliveryId?: string;
    transitionHistory: DeliveryTransition[];
};

export type RunStatus = "queued" | "processing" | "published" | "failed" | "superseded" | "denied";

export type RunSummaryCounts = {
    blockingFindings: number;
    advisoryFindings: number;
    coverageGaps: number;
    inlineAnnotations: number;
    overflowFindings: number;
};

export type CoverageSummary = {
    total: number;
    byStatus: Partial<Record<CoverageStatus, number>>;
};

export type RunTimingMetrics = {
    queuedAt: string;
    startedAt?: string;
    completedAt?: string;
    queueLatencyMs?: number;
    durationMs?: number;
};

export type RunItem = ReviewStoreBaseItem & {
    entityType: "RUN";
    runId: string;
    repositoryId: number;
    repositoryFullName: string;
    installationId: number;
    prNumber: number;
    lane: Lane;
    headSha: string;
    baseSha: string;
    status: RunStatus;
    checkName: string;
    conclusion?: CheckRunConclusion;
    checkRunExternalId?: string;
    timing: RunTimingMetrics;
    summaryCounts: RunSummaryCounts;
    coverageSummary: CoverageSummary;
    appliedLimits: string[];
    denialReasons: string[];
    budgetMode: BudgetMode;
};

export type AttemptStatus = "started" | "succeeded" | "failed" | "sent_to_dlq" | "superseded" | "denied";

export type AttemptItem = ReviewStoreBaseItem & {
    entityType: "ATTEMPT";
    runId: string;
    attemptId: string;
    attemptNumber: number;
    jobId: string;
    deliveryId: string;
    repositoryId: number;
    prNumber: number;
    lane: Lane;
    headSha: string;
    status: AttemptStatus;
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
    queueReceiveCount: number;
    workerRequestId?: string;
    failureReason?: string;
};

export type CounterScope = "repo_day" | "global_day" | "deep_day";

export type CounterItem = ReviewStoreBaseItem & {
    entityType: "COUNTER";
    counterName: string;
    scope: CounterScope;
    day: string;
    repositoryId?: number;
    lane?: Lane;
    count: number;
    limit: number;
    resetAt: string;
    increments: CounterIncrement[];
};

export type CounterIncrement = {
    amount: number;
    at: string;
    reason: string;
};

export type LockState = "held" | "released" | "expired";

export type LockItem = ReviewStoreBaseItem & {
    entityType: "LOCK";
    lockName: "deep-lane-global";
    state: LockState;
    ownerJobId: string;
    ownerRunId: string;
    acquiredAt: string;
    expiresAt: string;
    releasedAt?: string;
};

export type ReviewStoreItem = DeliveryItem | RunItem | AttemptItem | CounterItem | LockItem;

export type PrPartitionInput = {
    repositoryId: number;
    prNumber: number;
};

export type RunIdentityInput = PrPartitionInput & {
    lane: Lane;
    headSha: string;
};

export function buildPrPartitionKey(input: PrPartitionInput): string {
    return `REPO#${input.repositoryId}#PR#${input.prNumber}`;
}

export function buildDeliverySortKey(receivedAt: string, deliveryId: string): string {
    return `DELIVERY#${receivedAt}#${deliveryId}`;
}

export function buildDuplicateDeliverySortKey(seenAt: string, deliveryId: string): string {
    return `DELIVERY_DUPLICATE#${seenAt}#${deliveryId}`;
}

export function buildRunId(input: RunIdentityInput): string {
    return `run:${input.repositoryId}:${input.prNumber}:${input.lane}:${input.headSha}`;
}

export function buildRunSortKey(input: RunIdentityInput): string {
    return `RUN#${input.lane}#${input.headSha}`;
}

export function buildAttemptId(input: RunIdentityInput & { attemptNumber: number }): string {
    return `${buildRunId(input)}:attempt:${input.attemptNumber}`;
}

export function buildAttemptSortKey(input: RunIdentityInput & { attemptNumber: number }): string {
    return `${buildRunSortKey(input)}#ATTEMPT#${String(input.attemptNumber).padStart(6, "0")}`;
}

export function buildCounterPartitionKey(input: {
    scope: CounterScope;
    day: string;
    repositoryId?: number;
}): string {
    if (input.scope === "repo_day") {
        if (input.repositoryId === undefined) {
            throw new Error("repo_day counter requires repositoryId");
        }

        return `COUNTER#REPO#${input.repositoryId}#DAY#${input.day}`;
    }

    return `COUNTER#${input.scope.toUpperCase()}#DAY#${input.day}`;
}

export function buildCounterSortKey(counterName: string, lane?: Lane): string {
    return lane === undefined ? `COUNTER#${counterName}` : `COUNTER#${counterName}#${lane}`;
}

export function buildDeepLaneLockKey(): Pick<LockItem, "pk" | "sk"> {
    return {
        pk: "LOCK#DEEP_LANE",
        sk: "LOCK#GLOBAL"
    };
}

export function summarizeCoverage(coverage: Coverage[]): CoverageSummary {
    const byStatus: Partial<Record<CoverageStatus, number>> = {};

    for (const record of coverage) {
        byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
    }

    return {
        total: coverage.length,
        byStatus
    };
}

export function emptySummaryCounts(): RunSummaryCounts {
    return {
        blockingFindings: 0,
        advisoryFindings: 0,
        coverageGaps: 0,
        inlineAnnotations: 0,
        overflowFindings: 0
    };
}

export function buildRunIdentityFromJob(job: ReviewJob): RunIdentityInput {
    return {
        repositoryId: job.repositoryId,
        prNumber: job.prNumber,
        lane: job.lane,
        headSha: job.headSha
    };
}
