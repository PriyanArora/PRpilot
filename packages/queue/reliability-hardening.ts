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

export type ReliabilityRunbookKey =
    | "scanner_timeout"
    | "scanner_failure"
    | "oversized_run"
    | "unsupported_repo"
    | "quota_exhaustion"
    | "partial_coverage"
    | "github_failed_delivery";

export type ReliabilityAlarm = {
    name: string;
    metric: string;
    threshold: string;
    action: string;
};

export type LicenseExecutionBoundary = {
    licenseFamily: "AGPL" | "GPL";
    defaultEnabled: false;
    approvalRequired: true;
    boundary: string;
};

export const budgetSheddingOrder = [
    "deny_optional_deep_lane",
    "reduce_presentation_volume",
    "report_required_path_gaps_as_action_required"
] as const;

export const reliabilityAlarmPlan: ReliabilityAlarm[] = [
    {
        name: "DlqHasMessagesAlarm",
        metric: "AWS/SQS ApproximateNumberOfMessagesVisible",
        threshold: ">= 1 message for 5 minutes",
        action: "Inspect the DLQ record and replay only after confirming the PR head SHA is current."
    },
    {
        name: "WebhookFunctionErrorsAlarm",
        metric: "AWS/Lambda Errors",
        threshold: ">= 1 webhook error for 5 minutes",
        action: "Check signature, selected-repository scope, Parameter Store access, and queue handoff."
    },
    {
        name: "WorkerFunctionErrorsAlarm",
        metric: "AWS/Lambda Errors",
        threshold: ">= 1 worker error for 5 minutes",
        action: "Check scanner failure coverage, queue retry count, and GitHub publishing logs."
    },
    {
        name: "WorkerFunctionThrottlesAlarm",
        metric: "AWS/Lambda Throttles",
        threshold: ">= 1 throttle for 5 minutes",
        action: "Confirm reserved concurrency is intentional and move runtime policy to conserve if backlog grows."
    },
    {
        name: "ReviewQueueAgeAlarm",
        metric: "AWS/SQS ApproximateAgeOfOldestMessage",
        threshold: ">= 300 seconds",
        action: "Prioritize fast-lane backlog, deny optional deep work, and inspect stuck worker attempts."
    },
    {
        name: "BudgetModeTransitionAlarm",
        metric: "Deployment-owner budget or quota signal",
        threshold: ">= 80% conserve, >= 100% emergency",
        action: "Use runtime policy to deny deep scans first, then reduce presentation volume."
    }
] as const;

export const reliabilityRunbookSteps: Record<ReliabilityRunbookKey, string> = {
    scanner_timeout: "Publish honest timeout coverage; fast lane becomes action_required and deep lane stays advisory.",
    scanner_failure: "Publish failed coverage, keep the raw scanner error out of annotations, and inspect worker logs.",
    oversized_run: "Stop expensive work and publish the oversized-run outcome with the configured changed-file cap.",
    unsupported_repo: "Publish unsupported-repo coverage and do not spend scanner runtime.",
    quota_exhaustion: "Deny optional work first, then report required-path gaps honestly if the fast lane cannot run.",
    partial_coverage: "Separate completed scope from missing scope and publish action_required only for required-path gaps.",
    github_failed_delivery: "Use GitHub failed-delivery redelivery after verifying webhook secret and endpoint health."
};

export const cautiousLicenseBoundaries: LicenseExecutionBoundary[] = [
    {
        licenseFamily: "AGPL",
        defaultEnabled: false,
        approvalRequired: true,
        boundary: "Do not link, import, vendor, or modify AGPL code in the PRPilot runtime; require owner approval and isolated process execution before any optional use."
    },
    {
        licenseFamily: "GPL",
        defaultEnabled: false,
        approvalRequired: true,
        boundary: "Do not link, import, vendor, or modify GPL code in the PRPilot runtime; require owner approval and isolated process execution before any optional use."
    }
] as const;

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

export function mapReliabilityOutcomeToRunbookStep(key: ReliabilityRunbookKey): string {
    return reliabilityRunbookSteps[key];
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
