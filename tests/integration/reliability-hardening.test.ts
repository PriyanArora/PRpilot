import { describe, expect, it } from "vitest";
import {
    budgetSheddingOrder,
    buildBoundedRetryPolicy,
    cautiousLicenseBoundaries,
    decideBudgetModeFromQuota,
    decideBudgetShedding,
    mapReliabilityOutcomeToRunbookStep,
    reliabilityAlarmPlan,
    simulateSyntheticBurst,
    validateLowConcurrencySettings
} from "../../packages/queue/reliability-hardening";

const NOW = new Date("2026-05-20T12:00:00.000Z");

describe("P13 retry and concurrency hardening", () => {
    it("bounds retry policy around scanner timeout and DLQ cost limits", () => {
        expect(buildBoundedRetryPolicy({
            scannerTimeoutMsCap: 45_000,
            maxReceiveCount: 9
        })).toEqual({
            maxReceiveCount: 5,
            visibilityTimeoutMs: 90_000,
            dlqName: "prpilot-prod-review-jobs-dlq"
        });

        expect(buildBoundedRetryPolicy({
            scannerTimeoutMsCap: 5000
        }).visibilityTimeoutMs).toBe(30_000);
    });

    it("validates the low-concurrency worker contract used by the CDK stack", () => {
        expect(validateLowConcurrencySettings({
            webhookReservedConcurrency: 2,
            workerReservedConcurrency: 1,
            sqsBatchSize: 1
        })).toEqual({
            valid: true,
            violations: []
        });

        expect(validateLowConcurrencySettings({
            webhookReservedConcurrency: 4,
            workerReservedConcurrency: 2,
            sqsBatchSize: 10
        }).violations).toEqual([
            "webhook_reserved_concurrency_above_low_cost_target",
            "worker_reserved_concurrency_must_stay_one_for_mvp",
            "sqs_batch_size_must_stay_one_for_retry_visibility"
        ]);
    });
});

describe("P13 burst and budget-mode behavior", () => {
    it("keeps fast-lane jobs ahead of deep-lane jobs during a synthetic burst", async () => {
        const result = await simulateSyntheticBurst({
            fastJobs: 3,
            deepJobs: 2,
            manualDeepScanEnabled: true,
            deepRunsStartedToday: 0,
            maxDeepRunsPerDay: 5,
            now: NOW
        });

        expect(result.processedOrder).toEqual(["fast", "fast", "fast", "deep", "deep"]);
        expect(result.deniedDeepReasons).toEqual([]);
        expect(result.remainingBacklog.visible.fast).toBe(0);
        expect(result.remainingBacklog.visible.deep).toBe(0);
    });

    it("denies optional deep work when deep scans are disabled or quota is exhausted", async () => {
        const disabled = await simulateSyntheticBurst({
            fastJobs: 0,
            deepJobs: 1,
            manualDeepScanEnabled: false,
            deepRunsStartedToday: 0,
            maxDeepRunsPerDay: 1,
            now: NOW
        });
        const quotaExhausted = await simulateSyntheticBurst({
            fastJobs: 0,
            deepJobs: 1,
            manualDeepScanEnabled: true,
            deepRunsStartedToday: 1,
            maxDeepRunsPerDay: 1,
            now: NOW
        });

        expect(disabled.deniedDeepReasons).toEqual(["deep_scan_disabled"]);
        expect(quotaExhausted.deniedDeepReasons).toEqual(["deep_quota_exhausted"]);
    });

    it("transitions through normal, conserve, and emergency from quota and failure signals", () => {
        expect(decideBudgetModeFromQuota({
            globalRunUsageRatio: 0.2,
            repositoryRunUsageRatio: 0.2,
            dlqVisibleMessages: 0,
            workerThrottleCount: 0
        })).toBe("normal");
        expect(decideBudgetModeFromQuota({
            globalRunUsageRatio: 0.81,
            repositoryRunUsageRatio: 0.2,
            dlqVisibleMessages: 0,
            workerThrottleCount: 0
        })).toBe("conserve");
        expect(decideBudgetModeFromQuota({
            globalRunUsageRatio: 1,
            repositoryRunUsageRatio: 0.2,
            dlqVisibleMessages: 0,
            workerThrottleCount: 0
        })).toBe("emergency");
    });

    it("applies the lane-specific budget-shedding order", () => {
        expect(budgetSheddingOrder).toEqual([
            "deny_optional_deep_lane",
            "reduce_presentation_volume",
            "report_required_path_gaps_as_action_required"
        ]);
        expect(decideBudgetShedding("conserve", "deep")).toMatchObject({
            allowWork: false,
            reason: "deny_optional_deep"
        });
        expect(decideBudgetShedding("conserve", "fast")).toMatchObject({
            allowWork: true,
            presentation: "reduced"
        });
        expect(decideBudgetShedding("emergency", "fast")).toMatchObject({
            allowWork: true,
            presentation: "minimal",
            requiredPathCoverageBehavior: "action_required_if_gap"
        });
    });
});

describe("P13 alarms, runbooks, and license boundaries", () => {
    it("defines the minimal reliability alarm set and operational actions", () => {
        expect(reliabilityAlarmPlan.map((alarm) => alarm.name)).toEqual([
            "DlqHasMessagesAlarm",
            "WebhookFunctionErrorsAlarm",
            "WorkerFunctionErrorsAlarm",
            "WorkerFunctionThrottlesAlarm",
            "ReviewQueueAgeAlarm",
            "BudgetModeTransitionAlarm"
        ]);
        expect(reliabilityAlarmPlan[0].action).toContain("Inspect the DLQ record");
    });

    it("maps reliability outcomes to explicit runbook steps", () => {
        expect(mapReliabilityOutcomeToRunbookStep("scanner_timeout")).toContain("action_required");
        expect(mapReliabilityOutcomeToRunbookStep("scanner_failure")).toContain("worker logs");
        expect(mapReliabilityOutcomeToRunbookStep("oversized_run")).toContain("oversized-run");
        expect(mapReliabilityOutcomeToRunbookStep("unsupported_repo")).toContain("unsupported-repo");
        expect(mapReliabilityOutcomeToRunbookStep("quota_exhaustion")).toContain("Deny optional work");
        expect(mapReliabilityOutcomeToRunbookStep("partial_coverage")).toContain("required-path gaps");
        expect(mapReliabilityOutcomeToRunbookStep("github_failed_delivery")).toContain("redelivery");
    });

    it("keeps AGPL and GPL tools disabled by default behind explicit approval boundaries", () => {
        expect(cautiousLicenseBoundaries).toHaveLength(2);
        expect(cautiousLicenseBoundaries).toEqual([
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
        ]);
    });
});
