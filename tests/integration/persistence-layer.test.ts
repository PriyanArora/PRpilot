import { describe, expect, it } from "vitest";
import type { Coverage } from "../../packages/rules/coverage";
import type { ReviewJob } from "../../packages/queue/review-job";
import { buildCheckRunExternalId } from "../../packages/checks/check-run-identity";
import { getCheckRunName } from "../../packages/checks/check-run-identity";
import {
    buildAttemptSortKey,
    buildCounterPartitionKey,
    buildDeepLaneLockKey,
    buildPrPartitionKey,
    buildRunSortKey
} from "../../packages/review-store/persistence-records";
import {
    p7DynamoDbConcepts,
    p7RequiredProofArtifacts,
    p7SingleTableDesign
} from "../../packages/review-store/p7-dynamodb-concepts";
import { InMemoryReviewStore } from "../../packages/review-store/in-memory-review-store";
import { p7RetentionWindows } from "../../packages/review-store/retention-policy";
import { p7LowCostRecoveryPlan, rehearseLocalRecoveryDrill } from "../../packages/review-store/recovery-drill";

const NOW = new Date("2026-05-21T12:00:00.000Z");

function daysAfter(days: number): Date {
    return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

function job(overrides: Partial<ReviewJob> = {}): ReviewJob {
    const lane = overrides.lane ?? "fast";

    return {
        jobId: `review:123:42:${lane}:abc123:${overrides.deliveryId ?? "delivery-1"}`,
        deliveryId: "delivery-1",
        lane,
        trigger: lane === "fast" ? "pull_request" : "manual_deep_scan",
        repositoryId: 123,
        repositoryFullName: "owner/repo",
        installationId: 456,
        prNumber: 42,
        headSha: "abc123",
        baseSha: "base123",
        enqueuedAt: NOW.toISOString(),
        attempt: 0,
        ...overrides
    };
}

function coverage(overrides: Partial<Coverage> = {}): Coverage {
    const lane = overrides.lane ?? "fast";

    return {
        lane,
        scanner: lane === "fast" ? "internal" : "osv-scanner",
        applicability: "applicable",
        status: "completed",
        scope_expected: lane === "fast" ? "changed_files" : "repo_context",
        scope_completed: lane === "fast" ? "changed_files" : "repo_context",
        duration_ms: 10,
        budget_ms: 1000,
        ...overrides
    };
}

function recordDelivery(store: InMemoryReviewStore, inputJob = job()) {
    return store.recordDeliveryReceived({
        deliveryId: inputJob.deliveryId,
        eventName: "pull_request",
        action: "opened",
        trigger: inputJob.trigger,
        repositoryId: inputJob.repositoryId,
        repositoryFullName: inputJob.repositoryFullName,
        installationId: inputJob.installationId,
        prNumber: inputJob.prNumber,
        lane: inputJob.lane,
        headSha: inputJob.headSha,
        baseSha: inputJob.baseSha,
        receivedAt: NOW.toISOString(),
        senderLogin: "octocat",
        requestId: "request-1"
    });
}

function populateStoreWithTwoRuns(): InMemoryReviewStore {
    const store = new InMemoryReviewStore();
    const fastJob = job();
    const deepJob = job({
        lane: "deep",
        deliveryId: "delivery-2",
        jobId: "review:123:42:deep:abc123:delivery-2"
    });

    recordDelivery(store, fastJob);
    store.transitionDelivery({
        deliveryId: fastJob.deliveryId,
        state: "ENQUEUED",
        at: NOW.toISOString(),
        reason: "queue_handoff_succeeded"
    });
    store.startRun({
        job: fastJob,
        checkName: getCheckRunName("fast"),
        budgetMode: "normal",
        startedAt: new Date(NOW.getTime() + 1000).toISOString()
    });
    store.recordAttempt({
        job: fastJob,
        attemptNumber: 1,
        status: "succeeded",
        startedAt: new Date(NOW.getTime() + 1000).toISOString(),
        completedAt: new Date(NOW.getTime() + 5000).toISOString(),
        queueReceiveCount: 1,
        workerRequestId: "worker-request-1"
    });
    store.finalizeRun({
        job: fastJob,
        status: "published",
        conclusion: "failure",
        checkRunExternalId: buildCheckRunExternalId({
            repositoryId: fastJob.repositoryId,
            prNumber: fastJob.prNumber,
            lane: fastJob.lane,
            headSha: fastJob.headSha
        }),
        completedAt: new Date(NOW.getTime() + 5000).toISOString(),
        summaryCounts: {
            blockingFindings: 1,
            advisoryFindings: 0,
            coverageGaps: 0,
            inlineAnnotations: 1,
            overflowFindings: 0
        },
        coverage: [coverage()],
        appliedLimits: [],
        denialReasons: [],
        budgetMode: "normal"
    });

    recordDelivery(store, deepJob);
    store.startRun({
        job: deepJob,
        checkName: getCheckRunName("deep"),
        budgetMode: "conserve",
        startedAt: new Date(NOW.getTime() + 6000).toISOString()
    });
    store.recordAttempt({
        job: deepJob,
        attemptNumber: 1,
        status: "denied",
        startedAt: new Date(NOW.getTime() + 6000).toISOString(),
        completedAt: new Date(NOW.getTime() + 6100).toISOString(),
        queueReceiveCount: 1,
        failureReason: "deep_quota_exhausted"
    });
    store.finalizeRun({
        job: deepJob,
        status: "denied",
        conclusion: "neutral",
        completedAt: new Date(NOW.getTime() + 6100).toISOString(),
        summaryCounts: {
            blockingFindings: 0,
            advisoryFindings: 1,
            coverageGaps: 1,
            inlineAnnotations: 0,
            overflowFindings: 1
        },
        coverage: [coverage({
            lane: "deep",
            status: "denied_by_limit",
            scope_completed: "not_run",
            reason: "deep quota exhausted"
        })],
        appliedLimits: ["deep_quota"],
        denialReasons: ["deep_quota_exhausted"],
        budgetMode: "conserve"
    });

    return store;
}

describe("P7 DynamoDB persistence concepts", () => {
    it("documents the single-table model, keys, TTL, conditional writes, and low-cost recovery path", () => {
        expect(p7DynamoDbConcepts.singleTableModel).toContain("One DynamoDB table");
        expect(p7DynamoDbConcepts.conditionalWrites).toContain("idempotency");
        expect(p7SingleTableDesign).toMatchObject({
            tableName: "PRPilotReviewState",
            keyAttributes: ["pk", "sk"],
            ttlAttribute: "ttl"
        });
        expect(p7SingleTableDesign.recordTypes).toEqual(["DELIVERY", "RUN", "ATTEMPT", "COUNTER", "LOCK"]);
        expect(p7LowCostRecoveryPlan.chosenPath).toContain("DynamoDB on-demand export");
        expect(p7RequiredProofArtifacts).toContain("pr_query_output");
    });

    it("locks the P7 key shapes for delivery, run, attempt, counter, and deep-lane lock records", () => {
        expect(buildPrPartitionKey({ repositoryId: 123, prNumber: 42 })).toBe("REPO#123#PR#42");
        expect(buildRunSortKey({
            repositoryId: 123,
            prNumber: 42,
            lane: "fast",
            headSha: "abc123"
        })).toBe("RUN#fast#abc123");
        expect(buildAttemptSortKey({
            repositoryId: 123,
            prNumber: 42,
            lane: "fast",
            headSha: "abc123",
            attemptNumber: 2
        })).toBe("RUN#fast#abc123#ATTEMPT#000002");
        expect(buildCounterPartitionKey({
            scope: "repo_day",
            repositoryId: 123,
            day: "2026-05-21"
        })).toBe("COUNTER#REPO#123#DAY#2026-05-21");
        expect(buildDeepLaneLockKey()).toEqual({
            pk: "LOCK#DEEP_LANE",
            sk: "LOCK#GLOBAL"
        });
        expect(p7RetentionWindows.run).toContain("30 days");
    });
});

describe("P7 delivery audit persistence", () => {
    it("records full delivery audit fields, duplicate deliveries, and state transitions", () => {
        const store = new InMemoryReviewStore();
        const created = recordDelivery(store);
        const duplicate = recordDelivery(store);
        const enqueued = store.transitionDelivery({
            deliveryId: "delivery-1",
            state: "ENQUEUED",
            at: new Date(NOW.getTime() + 1000).toISOString(),
            reason: "queue_handoff_succeeded"
        });
        const published = store.transitionDelivery({
            deliveryId: "delivery-1",
            state: "PUBLISHED",
            at: new Date(NOW.getTime() + 5000).toISOString(),
            reason: "check_run_created"
        });

        expect(created.status).toBe("created");
        expect(duplicate.status).toBe("duplicate");
        if (duplicate.status !== "duplicate") {
            throw new Error("Expected duplicate delivery audit record");
        }

        expect(duplicate.original.duplicateCount).toBe(1);
        expect(duplicate.duplicateRecord).toMatchObject({
            entityType: "DELIVERY",
            state: "DUPLICATE",
            duplicateOfDeliveryId: "delivery-1",
            senderLogin: "octocat"
        });
        expect(enqueued.enqueuedAt).toBe(new Date(NOW.getTime() + 1000).toISOString());
        expect(published.state).toBe("PUBLISHED");
        expect(published.transitionHistory.map((transition) => transition.state)).toEqual([
            "RECEIVED",
            "DUPLICATE",
            "ENQUEUED",
            "PUBLISHED"
        ]);
    });
});

describe("P7 runs, attempts, counters, and locks", () => {
    it("persists run timing, final conclusions, summary counts, coverage metadata, limits, denials, and budget mode", () => {
        const store = populateStoreWithTwoRuns();
        const records = store.queryPrRecords({ repositoryId: 123, prNumber: 42 });
        const runs = records.filter((record) => record.entityType === "RUN");
        const attempts = records.filter((record) => record.entityType === "ATTEMPT");
        const deepRun = runs.find((record) => record.entityType === "RUN" && record.lane === "deep");

        expect(runs).toHaveLength(2);
        expect(attempts).toHaveLength(2);
        expect(deepRun).toMatchObject({
            status: "denied",
            conclusion: "neutral",
            budgetMode: "conserve",
            appliedLimits: ["deep_quota"],
            denialReasons: ["deep_quota_exhausted"],
            coverageSummary: {
                total: 1,
                byStatus: {
                    denied_by_limit: 1
                }
            }
        });
    });

    it("updates daily quota counters atomically and denies increments that exceed the limit", () => {
        const store = new InMemoryReviewStore();
        const first = store.incrementCounter({
            scope: "repo_day",
            counterName: "runs_started",
            repositoryId: 123,
            lane: "fast",
            day: "2026-05-21",
            limit: 2,
            amount: 1,
            reason: "fast_run_started",
            now: NOW
        });
        const second = store.incrementCounter({
            scope: "repo_day",
            counterName: "runs_started",
            repositoryId: 123,
            lane: "fast",
            day: "2026-05-21",
            limit: 2,
            amount: 1,
            reason: "manual_rerun_started",
            now: NOW
        });
        const denied = store.incrementCounter({
            scope: "repo_day",
            counterName: "runs_started",
            repositoryId: 123,
            lane: "fast",
            day: "2026-05-21",
            limit: 2,
            amount: 1,
            reason: "quota_exhaustion_probe",
            now: NOW
        });

        expect(first.accepted).toBe(true);
        expect(second.accepted).toBe(true);
        expect(denied).toMatchObject({
            accepted: false,
            reason: "quota_exhausted"
        });
        expect(denied.item.count).toBe(2);
        expect(denied.item.increments).toHaveLength(2);
    });

    it("acquires, denies, releases, and expires the deep-lane lock conditionally", () => {
        const store = new InMemoryReviewStore();
        const deepJob = job({ lane: "deep", trigger: "manual_deep_scan" });
        const acquired = store.acquireDeepLaneLock({
            job: deepJob,
            runId: "run:123:42:deep:abc123",
            now: NOW,
            leaseMs: 60_000
        });
        const denied = store.acquireDeepLaneLock({
            job: job({
                lane: "deep",
                deliveryId: "delivery-2",
                jobId: "review:123:42:deep:abc123:delivery-2"
            }),
            runId: "run:123:42:deep:abc123",
            now: new Date(NOW.getTime() + 1000),
            leaseMs: 60_000
        });
        const released = store.releaseDeepLaneLock(deepJob.jobId, new Date(NOW.getTime() + 2000));
        const reacquired = store.acquireDeepLaneLock({
            job: deepJob,
            runId: "run:123:42:deep:abc123",
            now: new Date(NOW.getTime() + 3000),
            leaseMs: 60_000
        });
        const expiredStore = new InMemoryReviewStore();
        expiredStore.acquireDeepLaneLock({
            job: deepJob,
            runId: "run:123:42:deep:abc123",
            now: NOW,
            leaseMs: 1000
        });
        const acquiredAfterExpiry = expiredStore.acquireDeepLaneLock({
            job: job({
                lane: "deep",
                deliveryId: "delivery-3",
                jobId: "review:123:42:deep:abc123:delivery-3"
            }),
            runId: "run:123:42:deep:abc123",
            now: new Date(NOW.getTime() + 2000),
            leaseMs: 1000
        });

        expect(acquired.acquired).toBe(true);
        expect(denied).toMatchObject({
            acquired: false,
            reason: "lock_held"
        });
        expect(released.state).toBe("released");
        expect(reacquired.acquired).toBe(true);
        expect(acquiredAfterExpiry.acquired).toBe(true);
    });
});

describe("P7 TTL, recovery, and query proof", () => {
    it("purges expired records through TTL and preserves active records before expiry", () => {
        const store = populateStoreWithTwoRuns();

        expect(store.getAllRecords().every((record) => record.ttl > Math.floor(NOW.getTime() / 1000))).toBe(true);
        expect(store.purgeExpired(daysAfter(1))).toBe(0);
        expect(store.purgeExpired(daysAfter(31))).toBeGreaterThan(0);
        expect(store.getAllRecords()).toHaveLength(0);
    });

    it("rehearses a low-cost recovery drill and queries one PR with multiple runs plus delivery and attempt records", () => {
        const store = populateStoreWithTwoRuns();
        const backup = store.exportBackup(NOW);
        const drill = rehearseLocalRecoveryDrill({
            backup,
            repositoryId: 123,
            prNumber: 42
        });
        const queryOutput = InMemoryReviewStore.restoreFromBackup(backup)
            .queryPrRecords({ repositoryId: 123, prNumber: 42 });

        expect(drill).toEqual({
            strategy: "local_json_export",
            exportedItemCount: backup.itemCount,
            restoredItemCount: backup.itemCount,
            queriedPrRecordCount: queryOutput.length,
            ok: true
        });
        expect(queryOutput.filter((record) => record.entityType === "RUN")).toHaveLength(2);
        expect(queryOutput.some((record) => record.entityType === "DELIVERY")).toBe(true);
        expect(queryOutput.some((record) => record.entityType === "ATTEMPT")).toBe(true);
        expect(queryOutput.every((record) => typeof record.ttl === "number")).toBe(true);
    });
});
