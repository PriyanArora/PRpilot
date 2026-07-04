import { describe, expect, it } from "vitest";
import type { Coverage } from "../../packages/rules/coverage";
import type { Finding } from "../../packages/rules/finding";
import {
    buildStructuredReviewLog,
    calculateLatencyStats,
    collectLaneMetrics,
    collectPackBudgetMetrics,
    collectScannerMetrics,
    compareLatencySamples,
    serializeStructuredReviewLog,
    validateMetricCardinality
} from "../../packages/observability/free-tier-observability";

const coverage: Coverage[] = [
    {
        lane: "fast",
        scanner: "eslint",
        applicability: "applicable",
        status: "completed",
        scope_expected: "changed_files",
        scope_completed: "changed_files",
        duration_ms: 120,
        budget_ms: 1000
    },
    {
        lane: "deep",
        scanner: "osv-scanner",
        applicability: "applicable",
        status: "timed_out",
        scope_expected: "repo_context",
        scope_completed: "partial_scope",
        duration_ms: 5000,
        budget_ms: 3000
    }
];

const findings: Finding[] = [
    {
        lane: "fast",
        pack: "internal",
        scanner: "eslint",
        rule_id: "internal.large-change",
        severity: "medium",
        blockability: "warn",
        scope_basis: "changed_files",
        path: "src/app.ts",
        message: "Large change",
        fingerprint: "large-change"
    },
    {
        lane: "fast",
        pack: "internal",
        scanner: "eslint",
        rule_id: "internal.sensitive-file-change",
        severity: "high",
        blockability: "block",
        scope_basis: "changed_files",
        path: ".github/workflows/deploy.yml",
        message: "Sensitive path",
        fingerprint: "sensitive"
    }
];

describe("P14 structured logs", () => {
    it("includes required review identifiers in logs, not metrics", () => {
        const log = buildStructuredReviewLog({
            timestamp: "2026-05-20T12:00:00.000Z",
            level: "info",
            message: "review processed",
            deliveryId: "delivery-1",
            repositoryId: 123,
            repositoryFullName: "owner/repo",
            prNumber: 42,
            lane: "fast",
            headSha: "abc123",
            runStatus: "processed",
            budgetMode: "normal"
        });

        expect(log).toMatchObject({
            service: "prpilot",
            deliveryId: "delivery-1",
            repositoryFullName: "owner/repo",
            prNumber: 42,
            lane: "fast",
            headSha: "abc123",
            runStatus: "processed",
            budgetMode: "normal"
        });
        expect(JSON.parse(serializeStructuredReviewLog(log))).toMatchObject(log);
    });
});

describe("P14 latency and performance tracking", () => {
    it("records baseline and after-change p50 and p95 latency", () => {
        expect(calculateLatencyStats([1000, 2000, 3000, 4000, 5000])).toEqual({
            sampleCount: 5,
            p50Ms: 3000,
            p95Ms: 5000
        });

        expect(compareLatencySamples(
            [10_000, 12_000, 14_000, 16_000, 18_000],
            [8000, 9000, 10_000, 11_000, 12_000]
        )).toEqual({
            baseline: {
                sampleCount: 5,
                p50Ms: 14_000,
                p95Ms: 18_000
            },
            after: {
                sampleCount: 5,
                p50Ms: 10_000,
                p95Ms: 12_000
            },
            p50ImprovementMs: 4000,
            p95ImprovementMs: 6000,
            improved: true
        });
    });
});

describe("P14 low-cardinality metrics", () => {
    it("captures scanner runtime and finding volume without high-cardinality dimensions", () => {
        const metrics = collectScannerMetrics(coverage, findings);

        expect(metrics).toContainEqual({
            name: "scanner_runtime_ms",
            unit: "Milliseconds",
            value: 120,
            dimensions: {
                lane: "fast",
                scanner: "eslint",
                status: "completed"
            }
        });
        expect(metrics).toContainEqual({
            name: "scanner_finding_count",
            unit: "Count",
            value: 2,
            dimensions: {
                lane: "fast",
                scanner: "eslint"
            }
        });
        expect(validateMetricCardinality(metrics)).toEqual([]);
    });

    it("captures lane admissions, denials, coverage gaps, and pack budgets separately", () => {
        const laneMetrics = collectLaneMetrics([
            { lane: "fast", decision: "admitted" },
            { lane: "deep", decision: "denied", reason: "deep_scan_disabled" }
        ], coverage);
        const packMetrics = collectPackBudgetMetrics([
            { pack: "pack1", lane: "fast", durationMs: 120, budgetMs: 1000 },
            { pack: "deep", lane: "deep", durationMs: 5000, budgetMs: 10_000 }
        ]);

        expect(laneMetrics).toContainEqual({
            name: "lane_decision_count",
            unit: "Count",
            value: 1,
            dimensions: {
                lane: "deep",
                decision: "deep_scan_disabled"
            }
        });
        expect(laneMetrics).toContainEqual({
            name: "coverage_gap_count",
            unit: "Count",
            value: 1,
            dimensions: {
                lane: "deep"
            }
        });
        expect(packMetrics).toEqual([
            {
                name: "pack_budget_used_percent",
                unit: "Percent",
                value: 12,
                dimensions: {
                    pack: "pack1",
                    lane: "fast"
                }
            },
            {
                name: "pack_budget_used_percent",
                unit: "Percent",
                value: 50,
                dimensions: {
                    pack: "deep",
                    lane: "deep"
                }
            }
        ]);
        expect(validateMetricCardinality([...laneMetrics, ...packMetrics])).toEqual([]);
    });

    it("rejects high-cardinality metric dimensions", () => {
        expect(validateMetricCardinality([
            {
                name: "bad_metric",
                unit: "Count",
                value: 1,
                dimensions: {
                    lane: "fast",
                    scanner: "eslint",
                    status: "completed",
                    headSha: "abc123"
                }
            }
        ])).toEqual([
            "bad_metric:too_many_dimensions",
            "bad_metric:forbidden_dimension:headSha"
        ]);
    });
});
