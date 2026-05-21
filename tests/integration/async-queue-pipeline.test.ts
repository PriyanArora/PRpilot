import { describe, expect, it } from "vitest";
import type { Coverage } from "../../packages/rules/coverage";
import type { Finding } from "../../packages/rules/finding";
import type { NormalizedWebhookEvent } from "../../apps/webhook/handler";
import { enqueueReviewJobFromWebhook } from "../../apps/webhook/handler";
import { consumeOneReviewJob } from "../../apps/worker/handler";
import { p6QueueConcepts, p6QueueLifecycle, p6RequiredProofArtifacts } from "../../packages/queue/sqs-concepts";
import { buildReviewJob, type ReviewJob } from "../../packages/queue/review-job";
import {
    InMemoryReviewQueue,
    type DurableReviewQueue,
    type ReviewQueueFailureResult,
    type ReviewQueueSendResult
} from "../../packages/queue/review-queue";
import { decideLaneAdmission } from "../../packages/queue/lane-admission";
import { buildDlqReplayPlan, dlqInvestigationSteps } from "../../packages/queue/dlq-runbook";
import { decideJobFreshness } from "../../packages/queue/job-freshness";
import { decideRerunThrottle } from "../../packages/queue/rerun-throttle";
import { buildScannerFailureCoverage, normalizeScannerParallelism } from "../../packages/worker/scanner-timeout";
import { publishReviewJobFindings } from "../../packages/worker/review-publisher";
import { buildCheckRunPayload } from "../../packages/checks/check-run-payload-builder";
import { createSyncCheckRunStore } from "../../packages/checks/sync-check-publisher";

const NOW = new Date("2026-05-20T12:00:00.000Z");

function minutesAfter(minutes: number): Date {
    return new Date(NOW.getTime() + minutes * 60_000);
}

function event(overrides: Partial<NormalizedWebhookEvent> = {}): NormalizedWebhookEvent {
    return {
        deliveryId: "delivery-1",
        eventName: "pull_request",
        action: "opened",
        repositoryId: 123,
        repositoryFullName: "owner/repo",
        installationId: 456,
        receivedAt: NOW.toISOString(),
        pullRequest: {
            number: 42,
            headSha: "abc123",
            baseSha: "base123",
            headRef: "feature",
            baseRef: "main"
        },
        ...overrides
    };
}

function job(overrides: Partial<ReviewJob> = {}): ReviewJob {
    const lane = overrides.lane ?? "fast";

    return {
        jobId: `review:123:42:${lane}:abc123:delivery-1`,
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
        duration_ms: 1,
        budget_ms: 1000,
        ...overrides
    };
}

function finding(overrides: Partial<Finding> = {}): Finding {
    return {
        lane: overrides.lane ?? "fast",
        pack: "internal",
        scanner: "internal",
        rule_id: "internal.sensitive-file-change",
        severity: "high",
        blockability: "block",
        scope_basis: "changed_files",
        path: ".github/workflows/deploy.yml",
        start_line: 1,
        end_line: 1,
        message: "Blocking finding",
        fingerprint: "blocking-finding",
        ...overrides
    };
}

function currentHeadShaFor(messageJob: ReviewJob) {
    return Promise.resolve({
        ok: true as const,
        currentHeadSha: messageJob.headSha
    });
}

describe("P6 queue concepts", () => {
    it("documents the local SQS lifecycle before worker wiring", () => {
        expect(p6QueueConcepts.durableHandoff).toContain("acknowledge GitHub only after");
        expect(p6QueueLifecycle).toContain("worker_receives_visible_job");
        expect(p6RequiredProofArtifacts).toEqual([
            "enqueue_log",
            "worker_log",
            "dlq_record",
            "timeout_coverage",
            "rerun_throttle_decision",
            "deep_lane_denial",
            "superseded_job_decision"
        ]);
    });
});

describe("P6 webhook queue handoff", () => {
    it("builds the queue-job contract and acknowledges only after durable send succeeds", async () => {
        const queue = new InMemoryReviewQueue();
        const result = await enqueueReviewJobFromWebhook({
            event: event(),
            lane: "fast",
            trigger: "pull_request",
            queue,
            now: NOW
        });

        expect(result.statusCode).toBe(202);
        if (result.statusCode !== 202) {
            throw new Error("Expected pull request event to create a review job");
        }

        expect(result.acknowledged).toBe(true);
        expect(result.job).toMatchObject({
            deliveryId: "delivery-1",
            lane: "fast",
            trigger: "pull_request",
            repositoryId: 123,
            repositoryFullName: "owner/repo",
            installationId: 456,
            prNumber: 42,
            headSha: "abc123",
            baseSha: "base123"
        });
        expect(queue.getBacklogSnapshot(NOW).visible.fast).toBe(1);
    });

    it("does not acknowledge a webhook when durable queue handoff fails", async () => {
        const failingQueue: DurableReviewQueue = {
            send: async (): Promise<ReviewQueueSendResult> => {
                throw new Error("SQS unavailable");
            },
            receive: async () => null,
            acknowledge: async () => undefined,
            fail: async (): Promise<ReviewQueueFailureResult> => ({
                movedToDlq: false,
                receiveCount: 0
            }),
            getBacklogSnapshot: () => ({
                visible: { fast: 0, deep: 0 },
                inFlight: { fast: 0, deep: 0 },
                dlq: 0
            }),
            inspectDlq: () => [],
            replayDlq: async (): Promise<ReviewQueueSendResult> => ({
                messageId: "unused",
                sentAt: NOW.toISOString()
            })
        };

        await expect(enqueueReviewJobFromWebhook({
            event: event(),
            lane: "fast",
            trigger: "pull_request",
            queue: failingQueue,
            now: NOW
        })).rejects.toThrow("Failed to hand off review job to durable queue");
    });
});

describe("P6 worker consumption and routing", () => {
    it("consumes one queued job and removes it after processing", async () => {
        const queue = new InMemoryReviewQueue();
        await queue.send(job(), NOW);

        const result = await consumeOneReviewJob({
            queue,
            processJob: async () => ({ summary: "processed" }),
            now: NOW,
            manualDeepScanEnabled: true,
            deepRunsStartedToday: 0,
            maxDeepRunsPerDay: 1,
            getCurrentHeadSha: currentHeadShaFor
        });

        expect(result.status).toBe("processed");
        expect(queue.getBacklogSnapshot(NOW).visible.fast).toBe(0);
    });

    it("routes visible fast-lane jobs before visible deep-lane jobs", async () => {
        const queue = new InMemoryReviewQueue();
        await queue.send(job({ lane: "deep", trigger: "manual_deep_scan", deliveryId: "delivery-deep" }), NOW);
        await queue.send(job({ lane: "fast", trigger: "pull_request", deliveryId: "delivery-fast" }), NOW);

        const message = await queue.receive(NOW);

        expect(message?.job.lane).toBe("fast");
    });
});

describe("P6 retries, DLQ inspection, and replay", () => {
    it("retries failed worker attempts and moves the message to the DLQ after the retry limit", async () => {
        const queue = new InMemoryReviewQueue({
            maxReceiveCount: 2,
            visibilityTimeoutMs: 1000,
            dlqName: "test-dlq"
        });
        await queue.send(job(), NOW);

        const first = await consumeOneReviewJob({
            queue,
            processJob: async () => {
                throw new Error("scanner crashed");
            },
            now: NOW,
            manualDeepScanEnabled: true,
            deepRunsStartedToday: 0,
            maxDeepRunsPerDay: 1,
            getCurrentHeadSha: currentHeadShaFor
        });
        const second = await consumeOneReviewJob({
            queue,
            processJob: async () => {
                throw new Error("scanner crashed");
            },
            now: new Date(NOW.getTime() + 1001),
            manualDeepScanEnabled: true,
            deepRunsStartedToday: 0,
            maxDeepRunsPerDay: 1,
            getCurrentHeadSha: currentHeadShaFor
        });

        expect(first.status).toBe("retrying");
        expect(second.status).toBe("sent_to_dlq");
        expect(queue.inspectDlq()).toHaveLength(1);
        expect(queue.inspectDlq()[0]).toMatchObject({
            reason: "scanner crashed",
            receiveCount: 2
        });
    });

    it("documents DLQ inspection and replays one inspected failed message", async () => {
        const queue = new InMemoryReviewQueue({
            maxReceiveCount: 1,
            visibilityTimeoutMs: 1000,
            dlqName: "test-dlq"
        });
        await queue.send(job(), NOW);

        await consumeOneReviewJob({
            queue,
            processJob: async () => {
                throw new Error("temporary failure");
            },
            now: NOW,
            manualDeepScanEnabled: true,
            deepRunsStartedToday: 0,
            maxDeepRunsPerDay: 1,
            getCurrentHeadSha: currentHeadShaFor
        });

        const [record] = queue.inspectDlq();
        const replayPlan = buildDlqReplayPlan(record);
        const replay = await queue.replayDlq(record.messageId, minutesAfter(1));

        expect(dlqInvestigationSteps[0]).toContain("Read the DLQ message");
        expect(replayPlan.replaySafetyCheck).toBe("confirm_current_head_sha_before_replay");
        expect(replay.messageId).toBe("review-message-2");
        expect(queue.inspectDlq()).toHaveLength(0);
        expect(queue.getBacklogSnapshot(minutesAfter(1)).visible.fast).toBe(1);
    });
});

describe("P6 scanner budgets and worker limits", () => {
    it("turns scanner timeouts into honest fast-lane action_required and deep-lane neutral coverage", () => {
        const fastTimeout = buildScannerFailureCoverage({
            lane: "fast",
            scanner: "eslint",
            scopeExpected: "changed_files",
            failureKind: "timeout",
            reason: "eslint exceeded timeout",
            durationMs: 5000,
            budgetMs: 3000
        });
        const deepTimeout = buildScannerFailureCoverage({
            lane: "deep",
            scanner: "osv-scanner",
            scopeExpected: "repo_context",
            failureKind: "timeout",
            reason: "osv-scanner exceeded timeout",
            durationMs: 5000,
            budgetMs: 3000
        });

        expect(buildCheckRunPayload({
            lane: "fast",
            repositoryFullName: "owner/repo",
            prNumber: 42,
            headSha: "abc123",
            findings: [],
            coverage: [fastTimeout]
        }).conclusion).toBe("action_required");
        expect(buildCheckRunPayload({
            lane: "deep",
            repositoryFullName: "owner/repo",
            prNumber: 42,
            headSha: "abc123",
            findings: [],
            coverage: [deepTimeout]
        }).conclusion).toBe("neutral");
    });

    it("keeps scanner parallelism within the low-cost target", () => {
        expect(normalizeScannerParallelism(10)).toBe(2);
        expect(normalizeScannerParallelism(0)).toBe(1);
        expect(normalizeScannerParallelism(2)).toBe(2);
    });
});

describe("P6 deep-lane admission, quotas, and rerun throttles", () => {
    it("denies deep scans while disabled, while fast work is pending, while a deep lock is held, or after quota exhaustion", () => {
        const deepJob = job({ lane: "deep", trigger: "manual_deep_scan" });

        expect(decideLaneAdmission({
            job: deepJob,
            manualDeepScanEnabled: false,
            fastBacklogCount: 0,
            fastInFlightCount: 0,
            deepInFlightCount: 0,
            deepRunsStartedToday: 0,
            maxDeepRunsPerDay: 1
        })).toEqual({ admitted: false, reason: "deep_scan_disabled" });
        expect(decideLaneAdmission({
            job: deepJob,
            manualDeepScanEnabled: true,
            fastBacklogCount: 1,
            fastInFlightCount: 0,
            deepInFlightCount: 0,
            deepRunsStartedToday: 0,
            maxDeepRunsPerDay: 1
        })).toEqual({ admitted: false, reason: "fast_lane_priority" });
        expect(decideLaneAdmission({
            job: deepJob,
            manualDeepScanEnabled: true,
            fastBacklogCount: 0,
            fastInFlightCount: 0,
            deepInFlightCount: 1,
            deepRunsStartedToday: 0,
            maxDeepRunsPerDay: 1
        })).toEqual({ admitted: false, reason: "deep_lane_lock_held" });
        expect(decideLaneAdmission({
            job: deepJob,
            manualDeepScanEnabled: true,
            fastBacklogCount: 0,
            fastInFlightCount: 0,
            deepInFlightCount: 0,
            deepRunsStartedToday: 1,
            maxDeepRunsPerDay: 1
        })).toEqual({ admitted: false, reason: "deep_quota_exhausted" });
    });

    it("throttles manual reruns before work is spent", () => {
        const decision = decideRerunThrottle({
            job: job({ trigger: "check_suite_rerequested" }),
            now: NOW,
            cooldownMs: 60_000,
            lastStartedAt: new Date(NOW.getTime() - 30_000).toISOString()
        });

        expect(decision).toEqual({
            throttled: true,
            reason: "manual_rerun_cooldown",
            retryAfterMs: 30_000
        });
    });
});

describe("P6 freshness checks and stale-job handling", () => {
    it("drops stale fast and deep jobs when the current PR head SHA changed", () => {
        expect(decideJobFreshness(job({ lane: "fast" }), {
            ok: true,
            currentHeadSha: "new-sha"
        })).toEqual({
            fresh: false,
            action: "drop_stale_fast",
            reason: "superseded_by:new-sha"
        });
        expect(decideJobFreshness(job({ lane: "deep" }), {
            ok: true,
            currentHeadSha: "new-sha"
        })).toEqual({
            fresh: false,
            action: "drop_stale_deep",
            reason: "superseded_by:new-sha"
        });
    });

    it("checks current head SHA before processing and converts failed fast freshness checks to action_required", async () => {
        const freshQueue = new InMemoryReviewQueue();
        await freshQueue.send(job(), NOW);
        let checkedCurrentHeadSha = false;

        const freshResult = await consumeOneReviewJob({
            queue: freshQueue,
            processJob: async () => ({ summary: "processed" }),
            now: NOW,
            manualDeepScanEnabled: true,
            deepRunsStartedToday: 0,
            maxDeepRunsPerDay: 1,
            getCurrentHeadSha: async (messageJob) => {
                checkedCurrentHeadSha = true;
                return {
                    ok: true,
                    currentHeadSha: messageJob.headSha
                };
            }
        });

        const failedFreshnessQueue = new InMemoryReviewQueue();
        await failedFreshnessQueue.send(job(), NOW);
        const failedFreshnessResult = await consumeOneReviewJob({
            queue: failedFreshnessQueue,
            processJob: async () => ({ summary: "should not process" }),
            now: NOW,
            manualDeepScanEnabled: true,
            deepRunsStartedToday: 0,
            maxDeepRunsPerDay: 1,
            getCurrentHeadSha: async () => ({
                ok: false,
                error: "GitHub API unavailable"
            })
        });

        expect(checkedCurrentHeadSha).toBe(true);
        expect(freshResult.status).toBe("processed");
        expect(failedFreshnessResult.status).toBe("action_required");
    });
});

describe("P6 unified publishing path", () => {
    it("publishes worker findings through the P5 diff-aware annotation path", () => {
        const store = createSyncCheckRunStore();
        const result = publishReviewJobFindings({
            job: job(),
            findings: [finding()],
            coverage: [coverage()],
            checkRunStore: store,
            annotationCap: 20,
            policyAllowsDeepScan: true
        });

        expect(result.checkRun.conclusion).toBe("failure");
        expect(result.checkRun.annotations).toHaveLength(1);
        expect(result.checkRun.annotations[0]).toMatchObject({
            path: ".github/workflows/deploy.yml",
            start_line: 1,
            annotation_level: "failure"
        });
    });

    it("builds review jobs with deterministic identity fields", () => {
        expect(buildReviewJob({
            deliveryId: "delivery-2",
            lane: "fast",
            trigger: "pull_request",
            repositoryId: 123,
            repositoryFullName: "owner/repo",
            installationId: 456,
            prNumber: 42,
            headSha: "abc123",
            baseSha: "base123",
            enqueuedAt: NOW.toISOString()
        }).jobId).toBe("review:123:42:fast:abc123:delivery-2");
    });
});
