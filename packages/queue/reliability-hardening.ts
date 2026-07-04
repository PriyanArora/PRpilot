import type { BudgetMode, Lane } from "../config/runtime-policy";
import { decideLaneAdmission } from "./lane-admission";
import type { ReviewJob } from "./review-job";
import type { ReviewQueueRetryPolicy } from "./review-queue";
import { InMemoryReviewQueue } from "./review-queue";

export type RetryPolicyInput = {
    scannerTimeoutMsCap: number;
    maxReceiveCount?: number;
};

export type LowConcurrencySettings = {
    webhookReservedConcurrency: number;
    workerReservedConcurrency: number;
    sqsBatchSize: number;
};

export type LowConcurrencyValidation = {
    valid: boolean;
    violations: string[];
};

export type BudgetQuotaSnapshot = {
    globalRunUsageRatio: number;
    repositoryRunUsageRatio: number;
    dlqVisibleMessages: number;
    workerThrottleCount: number;
};

export type BudgetSheddingDecision = {
    allowWork: boolean;
    lane: Lane;
    mode: BudgetMode;
    presentation: "full" | "reduced" | "minimal";
    requiredPathCoverageBehavior: "normal" | "action_required_if_gap";
    reason: "normal_budget" | "deny_optional_deep" | "conserve_fast_lane" | "emergency_required_only";
};

export type SyntheticBurstInput = {
    fastJobs: number;
    deepJobs: number;
    manualDeepScanEnabled: boolean;
    deepRunsStartedToday: number;
    maxDeepRunsPerDay: number;
    now: Date;
};

export type SyntheticBurstResult = {
    processedOrder: Lane[];
    deniedDeepReasons: string[];
    remainingBacklog: ReturnType<InMemoryReviewQueue["getBacklogSnapshot"]>;
};

// Alarm plan, runbook steps, and license boundaries live in
// docs/operations-runbook.md — they are operator prose, not runtime data.

export function buildBoundedRetryPolicy(input: RetryPolicyInput): ReviewQueueRetryPolicy {
    const scannerTimeoutMs = Math.max(1, Math.floor(input.scannerTimeoutMsCap));
    const visibilityTimeoutMs = Math.min(900_000, Math.max(30_000, scannerTimeoutMs * 2));
    const maxReceiveCount = input.maxReceiveCount ?? 3;

    return {
        maxReceiveCount: Math.max(1, Math.min(Math.floor(maxReceiveCount), 5)),
        visibilityTimeoutMs,
        dlqName: "prpilot-prod-review-jobs-dlq"
    };
}

export function validateLowConcurrencySettings(input: LowConcurrencySettings): LowConcurrencyValidation {
    const violations: string[] = [];

    if (input.webhookReservedConcurrency > 2) {
        violations.push("webhook_reserved_concurrency_above_low_cost_target");
    }

    if (input.workerReservedConcurrency !== 1) {
        violations.push("worker_reserved_concurrency_must_stay_one_for_mvp");
    }

    if (input.sqsBatchSize !== 1) {
        violations.push("sqs_batch_size_must_stay_one_for_retry_visibility");
    }

    return {
        valid: violations.length === 0,
        violations
    };
}

export function decideBudgetModeFromQuota(input: BudgetQuotaSnapshot): BudgetMode {
    if (
        input.globalRunUsageRatio >= 1
        || input.repositoryRunUsageRatio >= 1
        || input.dlqVisibleMessages >= 5
        || input.workerThrottleCount >= 3
    ) {
        return "emergency";
    }

    if (
        input.globalRunUsageRatio >= 0.8
        || input.repositoryRunUsageRatio >= 0.8
        || input.dlqVisibleMessages > 0
        || input.workerThrottleCount > 0
    ) {
        return "conserve";
    }

    return "normal";
}

export function decideBudgetShedding(mode: BudgetMode, lane: Lane): BudgetSheddingDecision {
    if (mode === "normal") {
        return {
            allowWork: true,
            lane,
            mode,
            presentation: "full",
            requiredPathCoverageBehavior: "normal",
            reason: "normal_budget"
        };
    }

    if (lane === "deep") {
        return {
            allowWork: false,
            lane,
            mode,
            presentation: "minimal",
            requiredPathCoverageBehavior: "normal",
            reason: "deny_optional_deep"
        };
    }

    if (mode === "conserve") {
        return {
            allowWork: true,
            lane,
            mode,
            presentation: "reduced",
            requiredPathCoverageBehavior: "normal",
            reason: "conserve_fast_lane"
        };
    }

    return {
        allowWork: true,
        lane,
        mode,
        presentation: "minimal",
        requiredPathCoverageBehavior: "action_required_if_gap",
        reason: "emergency_required_only"
    };
}

export async function simulateSyntheticBurst(input: SyntheticBurstInput): Promise<SyntheticBurstResult> {
    const queue = new InMemoryReviewQueue();
    let deepRunsStartedToday = input.deepRunsStartedToday;

    for (let index = 0; index < input.deepJobs; index += 1) {
        await queue.send(buildSyntheticJob("deep", index, input.now), input.now);
    }

    for (let index = 0; index < input.fastJobs; index += 1) {
        await queue.send(buildSyntheticJob("fast", index, input.now), input.now);
    }

    const processedOrder: Lane[] = [];
    const deniedDeepReasons: string[] = [];

    while (true) {
        const message = await queue.receive(input.now);
        if (message === null) {
            break;
        }

        const snapshot = queue.getBacklogSnapshot(input.now);
        const decision = decideLaneAdmission({
            job: message.job,
            manualDeepScanEnabled: input.manualDeepScanEnabled,
            fastBacklogCount: snapshot.visible.fast,
            fastInFlightCount: Math.max(0, snapshot.inFlight.fast - (message.job.lane === "fast" ? 1 : 0)),
            deepInFlightCount: Math.max(0, snapshot.inFlight.deep - (message.job.lane === "deep" ? 1 : 0)),
            deepRunsStartedToday,
            maxDeepRunsPerDay: input.maxDeepRunsPerDay
        });

        if (decision.admitted) {
            processedOrder.push(message.job.lane);
            if (message.job.lane === "deep") {
                deepRunsStartedToday += 1;
            }
        } else if (message.job.lane === "deep") {
            deniedDeepReasons.push(decision.reason);
        }

        await queue.acknowledge(message.receiptHandle);
    }

    return {
        processedOrder,
        deniedDeepReasons,
        remainingBacklog: queue.getBacklogSnapshot(input.now)
    };
}

function buildSyntheticJob(lane: Lane, index: number, now: Date): ReviewJob {
    return {
        jobId: `synthetic:${lane}:${index}`,
        deliveryId: `synthetic-delivery-${lane}-${index}`,
        lane,
        trigger: lane === "fast" ? "pull_request" : "manual_deep_scan",
        repositoryId: 123,
        repositoryFullName: "owner/repo",
        installationId: 456,
        prNumber: 42,
        headSha: "abc123",
        baseSha: "base123",
        enqueuedAt: now.toISOString(),
        attempt: 0
    };
}
