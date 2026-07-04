import { describe, expect, it } from "vitest";
import type { RuntimePolicy } from "../../packages/config/runtime-policy";
import {
    buildRuntimePolicyRollbackPlan,
    createWarnFirstRolloutPlan,
    isBudgetModeSafeForPromotion,
    measureRollbackTiming,
    scannerPackRolloutOrder,
    validateCostControls,
    validateDeepScanDefaults,
    validateScannerPackPromotion,
    validateSelectedRepositoryScope
} from "../../packages/deployment/deployment-validation";

const runtimePolicy: RuntimePolicy = {
    version: 1,
    updatedAt: "2026-05-20T12:00:00.000Z",
    budgetMode: "normal",
    selectedRepositoryIds: [123],
    fastLaneEnabled: true,
    manualDeepScanEnabled: false,
    maxAnnotationsPerRun: 50,
    maxRunsPerRepoPerDay: 20,
    maxRunsPerDayGlobal: 100,
    autoDeepScanEnabled: false
};

describe("P15 live config validation", () => {
    // The validator lives in the executable deploy:validate-config script (ESM),
    // so a CommonJS test file has to import it dynamically.
    async function loadValidateLiveConfig() {
        const { validateLiveConfig } = await import("../../scripts/validate-live-config.mjs");
        return validateLiveConfig;
    }

    it("accepts Parameter Store names and deployed output values without secrets", async () => {
        const validateLiveConfig = await loadValidateLiveConfig();
        expect(validateLiveConfig({
            AWS_REGION: "us-east-1",
            GITHUB_APP_ID: "12345",
            GITHUB_WEBHOOK_SECRET_PARAM: "/prpilot/prod/github/webhook-secret",
            GITHUB_PRIVATE_KEY_PARAM: "/prpilot/prod/github/private-key",
            PRPILOT_RUNTIME_POLICY_PARAM: "/prpilot/prod/runtime-policy",
            DYNAMODB_TABLE_NAME: "prpilot-prod-review-state",
            SQS_QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/111122223333/prpilot-prod-review-jobs"
        })).toEqual({
            ok: true,
            errors: [],
            warnings: []
        });
    });

    it("rejects missing config and secret-looking values", async () => {
        const validateLiveConfig = await loadValidateLiveConfig();
        expect(validateLiveConfig({
            AWS_REGION: "not-a-region",
            GITHUB_APP_ID: "",
            GITHUB_WEBHOOK_SECRET_PARAM: "plain-secret",
            GITHUB_PRIVATE_KEY_PARAM: "-----BEGIN PRIVATE KEY-----",
            PRPILOT_RUNTIME_POLICY_PARAM: "/prpilot/prod/runtime-policy",
            DYNAMODB_TABLE_NAME: "prpilot-prod-review-state",
            SQS_QUEUE_URL: "not-sqs"
        }).errors).toEqual([
            "GITHUB_APP_ID is required",
            "GITHUB_WEBHOOK_SECRET_PARAM must be an SSM Parameter Store name, not a secret value",
            "GITHUB_PRIVATE_KEY_PARAM must be an SSM Parameter Store name, not a secret value",
            "GITHUB_PRIVATE_KEY_PARAM appears to contain a private key value",
            "AWS_REGION must look like an AWS region, for example us-east-1",
            "SQS_QUEUE_URL must look like an SQS queue URL"
        ]);
    });
});

describe("P15 selected scope, deep defaults, and cost controls", () => {
    it("validates selected repository scope against installed repositories", () => {
        expect(validateSelectedRepositoryScope({
            runtimePolicy,
            installedRepositoryIds: [123, 456]
        }).ok).toBe(true);
        expect(validateSelectedRepositoryScope({
            runtimePolicy,
            installedRepositoryIds: [456]
        }).errors).toEqual([
            "selected repository 123 is not installed for this GitHub App"
        ]);
    });

    it("keeps auto deep scans disabled by default and warns when manual deep scans are enabled", () => {
        expect(validateDeepScanDefaults({ runtimePolicy })).toEqual({
            ok: true,
            errors: [],
            warnings: []
        });
        expect(validateDeepScanDefaults({
            runtimePolicy: {
                ...runtimePolicy,
                manualDeepScanEnabled: true,
                autoDeepScanEnabled: true
            }
        })).toEqual({
            ok: false,
            errors: ["auto deep scan must stay disabled for the self-hosted MVP"],
            warnings: ["manual deep scan is enabled; prove quota and budget controls before live use"]
        });
    });

    it("enforces cost ceilings and emergency budget behavior", () => {
        expect(validateCostControls({ runtimePolicy }).ok).toBe(true);
        expect(validateCostControls({
            runtimePolicy: {
                ...runtimePolicy,
                budgetMode: "emergency",
                manualDeepScanEnabled: true,
                maxAnnotationsPerRun: 75,
                maxRunsPerRepoPerDay: 20,
                maxRunsPerDayGlobal: 10
            }
        }).errors).toEqual([
            "maxAnnotationsPerRun cannot exceed the GitHub annotation cap of 50",
            "maxRunsPerDayGlobal must be greater than or equal to maxRunsPerRepoPerDay",
            "manual deep scans must be disabled in emergency mode"
        ]);
    });
});

describe("P15 staged rollout and rollback", () => {
    it("creates a warn-first rollout plan with an explicit rollback trigger", () => {
        expect(createWarnFirstRolloutPlan({
            targetRepositoryId: 123,
            targetRepositoryFullName: "owner/repo",
            scannerPack: "pack2",
            rollbackTrigger: "fast-lane action_required rate exceeds 5%"
        })).toEqual({
            targetRepositoryId: 123,
            targetRepositoryFullName: "owner/repo",
            scannerPack: "pack2",
            mode: "warn",
            rollbackTrigger: "fast-lane action_required rate exceeds 5%"
        });
    });

    it("requires pack rollout order, warn mode, stability evidence, and budget evidence before promotion", () => {
        expect(scannerPackRolloutOrder).toEqual(["pack1", "pack2", "pack3"]);
        expect(validateScannerPackPromotion({
            pack: "pack2",
            states: [
                { pack: "pack1", state: "enforced" },
                { pack: "pack2", state: "warn" },
                { pack: "pack3", state: "disabled" }
            ],
            representativeRuns: 10,
            observationDays: 0,
            stabilityEvidence: true,
            budgetEvidence: true
        }).ok).toBe(true);
        expect(validateScannerPackPromotion({
            pack: "pack3",
            states: [
                { pack: "pack1", state: "enforced" },
                { pack: "pack2", state: "warn" },
                { pack: "pack3", state: "enforced" }
            ],
            representativeRuns: 3,
            observationDays: 2,
            stabilityEvidence: false,
            budgetEvidence: false
        }).errors).toEqual([
            "pack2 must be enforced before promoting pack3",
            "pack3 must run in warn mode before promotion",
            "promotion requires at least 10 representative runs or 7 observation days",
            "promotion requires stability evidence",
            "promotion requires budget evidence"
        ]);
    });

    it("prefers runtime-policy rollback and measures rollback timing", () => {
        expect(buildRuntimePolicyRollbackPlan("error budget exceeded")).toEqual({
            trigger: "error budget exceeded",
            firstAction: "set_runtime_policy_to_previous_safe_version",
            fallbackAction: "redeploy_previous_stack_or_disable_scanner_pack",
            expectedControlPlane: "Parameter Store runtime policy"
        });
        expect(measureRollbackTiming(
            new Date("2026-05-20T12:00:00.000Z"),
            new Date("2026-05-20T12:03:00.000Z")
        )).toEqual({
            startedAt: "2026-05-20T12:00:00.000Z",
            completedAt: "2026-05-20T12:03:00.000Z",
            durationMs: 180_000,
            meetsFiveMinuteTarget: true
        });
        expect(isBudgetModeSafeForPromotion("normal")).toBe(true);
        expect(isBudgetModeSafeForPromotion("conserve")).toBe(false);
    });
});
