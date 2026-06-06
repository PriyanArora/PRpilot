import { describe, expect, it } from "vitest";
import type { RuntimePolicy } from "../../packages/config/runtime-policy";
import {
    filterChangedFilesByRepositoryPolicy,
    parseRepositoryPolicyConfig,
    resolveRepositoryPolicy,
    validateRuntimePolicy
} from "../../packages/config/repository-policy";
import { evaluateLargeChange } from "../../packages/rules/internal-large-change";

function ownerPolicy(overrides: Partial<RuntimePolicy> = {}): RuntimePolicy {
    return {
        version: 1,
        updatedAt: "2026-06-06T00:00:00.000Z",
        budgetMode: "normal",
        selectedRepositoryIds: [123],
        fastLaneEnabled: true,
        manualDeepScanEnabled: true,
        maxAnnotationsPerRun: 20,
        maxRunsPerRepoPerDay: 10,
        maxRunsPerDayGlobal: 20,
        maxManualRerunsPerPrPerDay: 2,
        maxDeepScansPerRepoPerDay: 1,
        scannerTimeoutMsCap: 1000,
        autoDeepScanEnabled: true,
        autoDeepScanRepositoryIds: [123],
        ...overrides
    };
}

describe("repository policy parsing and validation", () => {
    it("parses the .prpilot.yml subset and validates enum values", () => {
        const parsed = parseRepositoryPolicyConfig(`
version: 1
review:
  include_paths: [src/**, package.json]
  ignore_paths: [src/generated/**]
  draft_behavior: advisory_only
scanners:
  eslint:
    mode: block
    timeout_ms: 500
deep:
  manual_enabled: true
`);

        expect(parsed.ok).toBe(true);
        if (!parsed.ok) {
            throw new Error(parsed.errors.join(", "));
        }
        expect(parsed.policy?.review?.include_paths).toEqual(["src/**", "package.json"]);
        expect(parsed.policy?.scanners?.eslint.mode).toBe("block");
    });

    it("returns clear errors for invalid repository config", () => {
        const parsed = parseRepositoryPolicyConfig(`
version: 1
review:
  draft_behavior: always
scanners:
  eslint:
    lane: required
`);

        expect(parsed.ok).toBe(false);
        if (parsed.ok) {
            throw new Error("Expected invalid repository policy");
        }
        expect(parsed.errors).toContain("review.draft_behavior must be skip_until_ready or advisory_only");
        expect(parsed.errors).toContain("scanners.eslint.lane must be fast or deep");
    });
});

describe("repository policy resolution", () => {
    it("validates the deployment-owner runtime policy before repository overrides", () => {
        const result = validateRuntimePolicy({
            ...ownerPolicy(),
            selectedRepositoryIds: []
        });

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error("Expected invalid owner policy");
        }
        expect(result.errors).toContain("Runtime policy selectedRepositoryIds must be a non-empty number array");
    });

    it("keeps default behavior when .prpilot.yml is missing", () => {
        const result = resolveRepositoryPolicy({
            ownerPolicy: ownerPolicy(),
            repositoryId: 123,
            repositoryPolicy: null
        });

        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error(result.errors.join(", "));
        }
        expect(result.effectivePolicy.draftBehavior).toBe("skip_until_ready");
        expect(result.effectivePolicy.scanners.eslint.mode).toBe("warn");
        expect(result.effectivePolicy.quotas.maxFastRunsPerRepoPerDay).toBe(10);
    });

    it("applies path precedence so include filters first and ignore wins", () => {
        const files = filterChangedFilesByRepositoryPolicy([
            { path: "src/app.ts", status: "modified", additions: 1, deletions: 0 },
            { path: "src/generated/client.ts", status: "modified", additions: 1, deletions: 0 },
            { path: "README.md", status: "modified", additions: 1, deletions: 0 }
        ], {
            includePaths: ["src/**"],
            ignorePaths: ["src/generated/**"]
        });

        expect(files.map((file) => file.path)).toEqual(["src/app.ts"]);
    });

    it("applies threshold configuration in rule evaluation", () => {
        const result = evaluateLargeChange([
            { path: "src/file.ts", status: "modified", additions: 15, deletions: 0 }
        ], { thresholdLines: 10 });

        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.message).toBe("Large file change: 15 changed lines");
    });

    it("applies scanner controls, warn-first rollout, and automatic deep opt-in", () => {
        const parsed = parseRepositoryPolicyConfig(`
version: 1
scanners:
  eslint:
    mode: block
    warn_first: true
    timeout_ms: 500
deep:
  auto_on_pull_request: true
quotas:
  manual_deep_scans_per_day: 1
  manual_fast_reruns_per_pr_per_day: 1
`);
        if (!parsed.ok) {
            throw new Error(parsed.errors.join(", "));
        }

        const result = resolveRepositoryPolicy({
            ownerPolicy: ownerPolicy(),
            repositoryId: 123,
            repositoryPolicy: parsed.policy
        });

        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error(result.errors.join(", "));
        }
        expect(result.effectivePolicy.scanners.eslint).toMatchObject({
            mode: "warn",
            timeoutMs: 500,
            rollout: "warn_first"
        });
        expect(result.effectivePolicy.deepAutoOnPullRequest).toBe(true);
        expect(result.effectivePolicy.quotas.manualFastRerunsPerPrPerDay).toBe(1);
    });

    it("rejects owner hard-cap overrides and disallowed lane promotions", () => {
        const parsed = parseRepositoryPolicyConfig(`
version: 1
scanners:
  osv-scanner:
    lane: fast
  actionlint:
    lane: deep
  eslint:
    timeout_ms: 5000
deep:
  auto_on_pull_request: true
quotas:
  max_fast_runs_per_repo_per_day: 99
`);
        if (!parsed.ok) {
            throw new Error(parsed.errors.join(", "));
        }

        const result = resolveRepositoryPolicy({
            ownerPolicy: ownerPolicy({
                autoDeepScanEnabled: false,
                autoDeepScanRepositoryIds: []
            }),
            repositoryId: 123,
            repositoryPolicy: parsed.policy
        });

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error("Expected policy resolution errors");
        }
        expect(result.errors).toContain("scanners.osv-scanner.lane cannot promote a deep scanner into the required fast lane");
        expect(result.errors).toContain("scanners.actionlint.lane cannot move a blocking fast scanner out of the required fast lane");
        expect(result.errors).toContain("scanners.eslint.timeout_ms cannot exceed owner timeout cap");
        expect(result.errors).toContain("deep.auto_on_pull_request requires owner auto-deep allowlist");
        expect(result.errors).toContain("quotas.max_fast_runs_per_repo_per_day cannot exceed owner cap");
    });
});
