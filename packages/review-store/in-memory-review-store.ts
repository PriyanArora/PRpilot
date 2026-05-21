import type { BudgetMode, Lane } from "../config/runtime-policy";
import type { CheckRunConclusion } from "../rules/check-run-payload-input";
import type { Coverage } from "../rules/coverage";
import type { ReviewJob, ReviewJobTrigger } from "../queue/review-job";
import {
    buildAttemptId,
    buildAttemptSortKey,
    buildCounterPartitionKey,
    buildCounterSortKey,
    buildDeepLaneLockKey,
    buildDeliverySortKey,
    buildDuplicateDeliverySortKey,
    buildPrPartitionKey,
    buildRunId,
    buildRunIdentityFromJob,
    buildRunSortKey,
    emptySummaryCounts,
    summarizeCoverage,
    type AttemptItem,
    type AttemptStatus,
    type CounterIncrement,
    type CounterItem,
    type CounterScope,
    type DeliveryItem,
    type DeliveryState,
    type LockItem,
    type ReviewStoreItem,
    type RunItem,
    type RunStatus,
    type RunSummaryCounts
} from "./persistence-records";
import { P7_RETENTION_DAYS, toTtlEpochSeconds } from "./retention-policy";

export type RecordDeliveryInput = {
    deliveryId: string;
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
    receivedAt: string;
    senderLogin?: string;
    requestId?: string;
};

export type DeliveryWriteResult =
    | {
        status: "created";
        delivery: DeliveryItem;
    }
    | {
        status: "duplicate";
        original: DeliveryItem;
        duplicateRecord: DeliveryItem;
    };

export type TransitionDeliveryInput = {
    deliveryId: string;
    state: DeliveryState;
    at: string;
    reason?: string;
};

export type StartRunInput = {
    job: ReviewJob;
    checkName: string;
    budgetMode: BudgetMode;
    startedAt?: string;
};

export type FinalizeRunInput = {
    job: ReviewJob;
    status: RunStatus;
    conclusion?: CheckRunConclusion;
    checkRunExternalId?: string;
    completedAt: string;
    summaryCounts: RunSummaryCounts;
    coverage: Coverage[];
    appliedLimits?: string[];
    denialReasons?: string[];
    budgetMode?: BudgetMode;
};

export type RecordAttemptInput = {
    job: ReviewJob;
    attemptNumber: number;
    status: AttemptStatus;
    startedAt: string;
    completedAt?: string;
    queueReceiveCount: number;
    workerRequestId?: string;
    failureReason?: string;
};

export type IncrementCounterInput = {
    scope: CounterScope;
    counterName: string;
    day: string;
    limit: number;
    amount: number;
    reason: string;
    now: Date;
    repositoryId?: number;
    lane?: Lane;
};

export type CounterIncrementResult =
    | {
        accepted: true;
        item: CounterItem;
    }
    | {
        accepted: false;
        reason: "quota_exhausted";
        item: CounterItem;
    };

export type AcquireDeepLaneLockInput = {
    job: ReviewJob;
    runId: string;
    now: Date;
    leaseMs: number;
};

export type LockAcquireResult =
    | {
        acquired: true;
        item: LockItem;
    }
    | {
        acquired: false;
        reason: "lock_held";
        item: LockItem;
    };

export type ReviewStoreBackup = {
    createdAt: string;
    strategy: "local_json_export";
    itemCount: number;
    items: ReviewStoreItem[];
};

function itemKey(pk: string, sk: string): string {
    return `${pk}\u0000${sk}`;
}

function cloneItem<T>(item: T): T {
    return JSON.parse(JSON.stringify(item)) as T;
}

function getDurationMs(start: string, end?: string): number | undefined {
    if (end === undefined) {
        return undefined;
    }

    return new Date(end).getTime() - new Date(start).getTime();
}

function nextUtcMidnight(day: string): string {
    const start = new Date(`${day}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) {
        throw new Error(`Invalid counter day: ${day}`);
    }

    return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

export class InMemoryReviewStore {
    private readonly items = new Map<string, ReviewStoreItem>();
    private readonly deliveryIndex = new Map<string, string>();

    static restoreFromBackup(backup: ReviewStoreBackup): InMemoryReviewStore {
        const store = new InMemoryReviewStore();

        for (const item of backup.items) {
            store.putInternal(cloneItem(item));
            if (item.entityType === "DELIVERY" && item.state !== "DUPLICATE") {
                store.deliveryIndex.set(item.deliveryId, itemKey(item.pk, item.sk));
            }
        }

        return store;
    }

    recordDeliveryReceived(input: RecordDeliveryInput): DeliveryWriteResult {
        const existingKey = this.deliveryIndex.get(input.deliveryId);
        const now = new Date(input.receivedAt);

        if (existingKey !== undefined) {
            const original = this.getInternal(existingKey);
            if (original?.entityType !== "DELIVERY") {
                throw new Error(`Delivery index pointed to non-delivery item: ${input.deliveryId}`);
            }

            const updatedOriginal: DeliveryItem = {
                ...original,
                duplicateCount: original.duplicateCount + 1,
                lastSeenAt: input.receivedAt,
                updatedAt: input.receivedAt,
                transitionHistory: [
                    ...original.transitionHistory,
                    {
                        state: "DUPLICATE",
                        at: input.receivedAt,
                        reason: "repeat_github_delivery_id"
                    }
                ]
            };
            this.putInternal(updatedOriginal);

            const duplicateRecord = this.buildDeliveryItem(input, {
                state: "DUPLICATE",
                sk: buildDuplicateDeliverySortKey(input.receivedAt, input.deliveryId),
                duplicateOfDeliveryId: input.deliveryId,
                now,
                transitionReason: "duplicate_of_existing_delivery"
            });
            this.putInternal(duplicateRecord);

            return {
                status: "duplicate",
                original: cloneItem(updatedOriginal),
                duplicateRecord: cloneItem(duplicateRecord)
            };
        }

        const delivery = this.buildDeliveryItem(input, {
            state: "RECEIVED",
            sk: buildDeliverySortKey(input.receivedAt, input.deliveryId),
            now
        });
        this.putInternal(delivery);
        this.deliveryIndex.set(input.deliveryId, itemKey(delivery.pk, delivery.sk));

        return {
            status: "created",
            delivery: cloneItem(delivery)
        };
    }

    transitionDelivery(input: TransitionDeliveryInput): DeliveryItem {
        const key = this.deliveryIndex.get(input.deliveryId);
        if (key === undefined) {
            throw new Error(`Cannot transition missing delivery: ${input.deliveryId}`);
        }

        const delivery = this.getInternal(key);
        if (delivery?.entityType !== "DELIVERY") {
            throw new Error(`Delivery index pointed to non-delivery item: ${input.deliveryId}`);
        }

        const updated: DeliveryItem = {
            ...delivery,
            state: input.state,
            updatedAt: input.at,
            lastSeenAt: input.at,
            enqueuedAt: input.state === "ENQUEUED" ? input.at : delivery.enqueuedAt,
            processingAt: input.state === "PROCESSING" ? input.at : delivery.processingAt,
            publishedAt: input.state === "PUBLISHED" ? input.at : delivery.publishedAt,
            failedAt: input.state === "FAILED" ? input.at : delivery.failedAt,
            transitionHistory: [
                ...delivery.transitionHistory,
                {
                    state: input.state,
                    at: input.at,
                    reason: input.reason
                }
            ]
        };

        this.putInternal(updated);
        return cloneItem(updated);
    }

    startRun(input: StartRunInput): RunItem {
        const startedAt = input.startedAt ?? input.job.enqueuedAt;
        const runIdentity = buildRunIdentityFromJob(input.job);
        const run: RunItem = {
            pk: buildPrPartitionKey(input.job),
            sk: buildRunSortKey(runIdentity),
            entityType: "RUN",
            createdAt: startedAt,
            updatedAt: startedAt,
            ttl: toTtlEpochSeconds(new Date(startedAt), P7_RETENTION_DAYS.RUN),
            retentionDays: P7_RETENTION_DAYS.RUN,
            runId: buildRunId(runIdentity),
            repositoryId: input.job.repositoryId,
            repositoryFullName: input.job.repositoryFullName,
            installationId: input.job.installationId,
            prNumber: input.job.prNumber,
            lane: input.job.lane,
            headSha: input.job.headSha,
            baseSha: input.job.baseSha,
            status: "processing",
            checkName: input.checkName,
            timing: {
                queuedAt: input.job.enqueuedAt,
                startedAt,
                queueLatencyMs: new Date(startedAt).getTime() - new Date(input.job.enqueuedAt).getTime()
            },
            summaryCounts: emptySummaryCounts(),
            coverageSummary: {
                total: 0,
                byStatus: {}
            },
            appliedLimits: [],
            denialReasons: [],
            budgetMode: input.budgetMode
        };

        this.putInternal(run);
        return cloneItem(run);
    }

    finalizeRun(input: FinalizeRunInput): RunItem {
        const runIdentity = buildRunIdentityFromJob(input.job);
        const key = itemKey(buildPrPartitionKey(input.job), buildRunSortKey(runIdentity));
        const existing = this.getInternal(key);
        if (existing?.entityType !== "RUN") {
            throw new Error(`Cannot finalize missing run: ${buildRunId(runIdentity)}`);
        }

        const startedAt = existing.timing.startedAt ?? existing.timing.queuedAt;
        const updated: RunItem = {
            ...existing,
            status: input.status,
            conclusion: input.conclusion,
            checkRunExternalId: input.checkRunExternalId,
            updatedAt: input.completedAt,
            timing: {
                ...existing.timing,
                completedAt: input.completedAt,
                durationMs: new Date(input.completedAt).getTime() - new Date(startedAt).getTime()
            },
            summaryCounts: input.summaryCounts,
            coverageSummary: summarizeCoverage(input.coverage),
            appliedLimits: input.appliedLimits ?? [],
            denialReasons: input.denialReasons ?? [],
            budgetMode: input.budgetMode ?? existing.budgetMode
        };

        this.putInternal(updated);
        return cloneItem(updated);
    }

    recordAttempt(input: RecordAttemptInput): AttemptItem {
        const runIdentity = buildRunIdentityFromJob(input.job);
        const attempt: AttemptItem = {
            pk: buildPrPartitionKey(input.job),
            sk: buildAttemptSortKey({
                ...runIdentity,
                attemptNumber: input.attemptNumber
            }),
            entityType: "ATTEMPT",
            createdAt: input.startedAt,
            updatedAt: input.completedAt ?? input.startedAt,
            ttl: toTtlEpochSeconds(new Date(input.startedAt), P7_RETENTION_DAYS.ATTEMPT),
            retentionDays: P7_RETENTION_DAYS.ATTEMPT,
            runId: buildRunId(runIdentity),
            attemptId: buildAttemptId({
                ...runIdentity,
                attemptNumber: input.attemptNumber
            }),
            attemptNumber: input.attemptNumber,
            jobId: input.job.jobId,
            deliveryId: input.job.deliveryId,
            repositoryId: input.job.repositoryId,
            prNumber: input.job.prNumber,
            lane: input.job.lane,
            headSha: input.job.headSha,
            status: input.status,
            startedAt: input.startedAt,
            completedAt: input.completedAt,
            durationMs: getDurationMs(input.startedAt, input.completedAt),
            queueReceiveCount: input.queueReceiveCount,
            workerRequestId: input.workerRequestId,
            failureReason: input.failureReason
        };

        this.putInternal(attempt);
        return cloneItem(attempt);
    }

    incrementCounter(input: IncrementCounterInput): CounterIncrementResult {
        const pk = buildCounterPartitionKey(input);
        const sk = buildCounterSortKey(input.counterName, input.lane);
        const key = itemKey(pk, sk);
        const existing = this.getInternal(key);
        const increment: CounterIncrement = {
            amount: input.amount,
            at: input.now.toISOString(),
            reason: input.reason
        };

        const item: CounterItem = existing?.entityType === "COUNTER"
            ? existing
            : {
                pk,
                sk,
                entityType: "COUNTER",
                createdAt: input.now.toISOString(),
                updatedAt: input.now.toISOString(),
                ttl: toTtlEpochSeconds(input.now, P7_RETENTION_DAYS.COUNTER),
                retentionDays: P7_RETENTION_DAYS.COUNTER,
                counterName: input.counterName,
                scope: input.scope,
                day: input.day,
                repositoryId: input.repositoryId,
                lane: input.lane,
                count: 0,
                limit: input.limit,
                resetAt: nextUtcMidnight(input.day),
                increments: []
            };

        if (item.count + input.amount > input.limit) {
            return {
                accepted: false,
                reason: "quota_exhausted",
                item: cloneItem(item)
            };
        }

        const updated: CounterItem = {
            ...item,
            count: item.count + input.amount,
            limit: input.limit,
            updatedAt: input.now.toISOString(),
            increments: [
                ...item.increments,
                increment
            ]
        };
        this.putInternal(updated);

        return {
            accepted: true,
            item: cloneItem(updated)
        };
    }

    acquireDeepLaneLock(input: AcquireDeepLaneLockInput): LockAcquireResult {
        const keyParts = buildDeepLaneLockKey();
        const key = itemKey(keyParts.pk, keyParts.sk);
        const existing = this.getInternal(key);

        if (existing?.entityType === "LOCK"
            && existing.state === "held"
            && new Date(existing.expiresAt).getTime() > input.now.getTime()) {
            return {
                acquired: false,
                reason: "lock_held",
                item: cloneItem(existing)
            };
        }

        const expiresAt = new Date(input.now.getTime() + input.leaseMs).toISOString();
        const lock: LockItem = {
            ...keyParts,
            entityType: "LOCK",
            createdAt: input.now.toISOString(),
            updatedAt: input.now.toISOString(),
            ttl: toTtlEpochSeconds(input.now, P7_RETENTION_DAYS.LOCK),
            retentionDays: P7_RETENTION_DAYS.LOCK,
            lockName: "deep-lane-global",
            state: "held",
            ownerJobId: input.job.jobId,
            ownerRunId: input.runId,
            acquiredAt: input.now.toISOString(),
            expiresAt
        };
        this.putInternal(lock);

        return {
            acquired: true,
            item: cloneItem(lock)
        };
    }

    releaseDeepLaneLock(ownerJobId: string, now: Date): LockItem {
        const keyParts = buildDeepLaneLockKey();
        const key = itemKey(keyParts.pk, keyParts.sk);
        const existing = this.getInternal(key);
        if (existing?.entityType !== "LOCK") {
            throw new Error("Cannot release missing deep-lane lock");
        }

        if (existing.ownerJobId !== ownerJobId) {
            throw new Error(`Cannot release deep-lane lock owned by ${existing.ownerJobId}`);
        }

        const released: LockItem = {
            ...existing,
            state: "released",
            releasedAt: now.toISOString(),
            updatedAt: now.toISOString()
        };
        this.putInternal(released);

        return cloneItem(released);
    }

    getDeliveryByDeliveryId(deliveryId: string): DeliveryItem | null {
        const key = this.deliveryIndex.get(deliveryId);
        if (key === undefined) {
            return null;
        }

        const item = this.getInternal(key);
        return item?.entityType === "DELIVERY" ? cloneItem(item) : null;
    }

    queryPrRecords(input: { repositoryId: number; prNumber: number }): ReviewStoreItem[] {
        const pk = buildPrPartitionKey(input);

        return [...this.items.values()]
            .filter((item) => item.pk === pk)
            .sort((left, right) => left.sk.localeCompare(right.sk))
            .map((item) => cloneItem(item));
    }

    getAllRecords(): ReviewStoreItem[] {
        return [...this.items.values()]
            .sort((left, right) => `${left.pk}#${left.sk}`.localeCompare(`${right.pk}#${right.sk}`))
            .map((item) => cloneItem(item));
    }

    purgeExpired(now: Date): number {
        const nowEpochSeconds = Math.floor(now.getTime() / 1000);
        let removed = 0;

        for (const [key, item] of this.items) {
            if (item.ttl <= nowEpochSeconds) {
                this.items.delete(key);
                removed += 1;

                if (item.entityType === "DELIVERY" && item.state !== "DUPLICATE") {
                    this.deliveryIndex.delete(item.deliveryId);
                }
            }
        }

        return removed;
    }

    exportBackup(createdAt = new Date()): ReviewStoreBackup {
        const items = this.getAllRecords();

        return {
            createdAt: createdAt.toISOString(),
            strategy: "local_json_export",
            itemCount: items.length,
            items
        };
    }

    private buildDeliveryItem(
        input: RecordDeliveryInput,
        options: {
            state: DeliveryState;
            sk: string;
            now: Date;
            duplicateOfDeliveryId?: string;
            transitionReason?: string;
        }
    ): DeliveryItem {
        return {
            pk: buildPrPartitionKey(input),
            sk: options.sk,
            entityType: "DELIVERY",
            createdAt: input.receivedAt,
            updatedAt: input.receivedAt,
            ttl: toTtlEpochSeconds(options.now, P7_RETENTION_DAYS.DELIVERY),
            retentionDays: P7_RETENTION_DAYS.DELIVERY,
            deliveryId: input.deliveryId,
            state: options.state,
            eventName: input.eventName,
            action: input.action,
            trigger: input.trigger,
            repositoryId: input.repositoryId,
            repositoryFullName: input.repositoryFullName,
            installationId: input.installationId,
            prNumber: input.prNumber,
            lane: input.lane,
            headSha: input.headSha,
            baseSha: input.baseSha,
            senderLogin: input.senderLogin,
            requestId: input.requestId,
            firstSeenAt: input.receivedAt,
            lastSeenAt: input.receivedAt,
            receivedAt: input.receivedAt,
            duplicateCount: 0,
            duplicateOfDeliveryId: options.duplicateOfDeliveryId,
            transitionHistory: [
                {
                    state: options.state,
                    at: input.receivedAt,
                    reason: options.transitionReason
                }
            ]
        };
    }

    private putInternal(item: ReviewStoreItem): void {
        this.items.set(itemKey(item.pk, item.sk), item);
    }

    private getInternal(key: string): ReviewStoreItem | undefined {
        return this.items.get(key);
    }
}
