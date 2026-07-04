import type { BudgetMode, Lane } from "../config/runtime-policy";
import type { Coverage } from "../rules/coverage";
import type { Finding } from "../rules/finding";

export type ReviewRunStatus =
    | "accepted"
    | "processed"
    | "failed"
    | "action_required"
    | "denied"
    | "superseded";

export type StructuredReviewLogInput = {
    timestamp: string;
    level: "info" | "warn" | "error";
    message: string;
    deliveryId: string;
    repositoryId: number;
    repositoryFullName: string;
    prNumber: number;
    lane: Lane;
    headSha: string;
    runStatus: ReviewRunStatus;
    budgetMode: BudgetMode;
};

export type StructuredReviewLog = StructuredReviewLogInput & {
    service: "prpilot";
};

export type MetricDatum = {
    name: string;
    unit: "Count" | "Milliseconds" | "Percent";
    value: number;
    dimensions: Record<string, string>;
};

export type LatencyStats = {
    sampleCount: number;
    p50Ms: number;
    p95Ms: number;
};

export type LatencyComparison = {
    baseline: LatencyStats;
    after: LatencyStats;
    p50ImprovementMs: number;
    p95ImprovementMs: number;
    improved: boolean;
};

export type LaneDecisionSample = {
    lane: Lane;
    decision: "admitted" | "denied";
    reason?: string;
};

export type PackBudgetSample = {
    pack: "pack1" | "deep";
    lane: Lane;
    durationMs: number;
    budgetMs: number;
};

// Alarm thresholds, the observability plan, and the Logs Insights query live in
// docs/operations-runbook.md — operator prose, not runtime data. These stay
// because validateMetricCardinality enforces them.
export const MAX_DIMENSIONS_PER_METRIC = 3;

export const forbiddenMetricDimensions = [
    "deliveryId",
    "repositoryId",
    "repositoryFullName",
    "prNumber",
    "headSha"
] as const;

export function buildStructuredReviewLog(input: StructuredReviewLogInput): StructuredReviewLog {
    return {
        service: "prpilot",
        ...input
    };
}

export function serializeStructuredReviewLog(input: StructuredReviewLogInput): string {
    return JSON.stringify(buildStructuredReviewLog(input));
}

export function calculateLatencyStats(samplesMs: number[]): LatencyStats {
    if (samplesMs.length === 0) {
        return {
            sampleCount: 0,
            p50Ms: 0,
            p95Ms: 0
        };
    }

    const sorted = [...samplesMs].sort((left, right) => left - right);

    return {
        sampleCount: sorted.length,
        p50Ms: nearestRankPercentile(sorted, 50),
        p95Ms: nearestRankPercentile(sorted, 95)
    };
}

export function compareLatencySamples(baselineSamplesMs: number[], afterSamplesMs: number[]): LatencyComparison {
    const baseline = calculateLatencyStats(baselineSamplesMs);
    const after = calculateLatencyStats(afterSamplesMs);

    return {
        baseline,
        after,
        p50ImprovementMs: baseline.p50Ms - after.p50Ms,
        p95ImprovementMs: baseline.p95Ms - after.p95Ms,
        improved: after.p50Ms <= baseline.p50Ms && after.p95Ms <= baseline.p95Ms
    };
}

export function collectScannerMetrics(coverage: Coverage[], findings: Finding[]): MetricDatum[] {
    const metrics: MetricDatum[] = [];

    for (const item of coverage) {
        metrics.push({
            name: "scanner_runtime_ms",
            unit: "Milliseconds",
            value: item.duration_ms,
            dimensions: {
                lane: item.lane,
                scanner: item.scanner,
                status: item.status
            }
        });
    }

    const findingCounts = new Map<string, { lane: Lane; scanner: string; count: number }>();
    for (const finding of findings) {
        const key = `${finding.lane}:${finding.scanner}`;
        const existing = findingCounts.get(key);
        if (existing === undefined) {
            findingCounts.set(key, {
                lane: finding.lane,
                scanner: finding.scanner,
                count: 1
            });
        } else {
            existing.count += 1;
        }
    }

    for (const count of findingCounts.values()) {
        metrics.push({
            name: "scanner_finding_count",
            unit: "Count",
            value: count.count,
            dimensions: {
                lane: count.lane,
                scanner: count.scanner
            }
        });
    }

    return metrics;
}

export function collectLaneMetrics(decisions: LaneDecisionSample[], coverage: Coverage[]): MetricDatum[] {
    const metrics: MetricDatum[] = [];
    const decisionCounts = new Map<string, { lane: Lane; decision: string; count: number }>();

    for (const sample of decisions) {
        const key = `${sample.lane}:${sample.decision}:${sample.reason ?? "none"}`;
        const existing = decisionCounts.get(key);
        if (existing === undefined) {
            decisionCounts.set(key, {
                lane: sample.lane,
                decision: sample.reason ?? sample.decision,
                count: 1
            });
        } else {
            existing.count += 1;
        }
    }

    for (const count of decisionCounts.values()) {
        metrics.push({
            name: "lane_decision_count",
            unit: "Count",
            value: count.count,
            dimensions: {
                lane: count.lane,
                decision: count.decision
            }
        });
    }

    for (const lane of ["fast", "deep"] as const) {
        const gapCount = coverage.filter((item) => (
            item.lane === lane
            && item.applicability === "applicable"
            && item.status !== "completed"
        )).length;

        metrics.push({
            name: "coverage_gap_count",
            unit: "Count",
            value: gapCount,
            dimensions: {
                lane
            }
        });
    }

    return metrics;
}

export function collectPackBudgetMetrics(samples: PackBudgetSample[]): MetricDatum[] {
    return samples.map((sample) => ({
        name: "pack_budget_used_percent",
        unit: "Percent",
        value: sample.budgetMs === 0 ? 0 : Math.round((sample.durationMs / sample.budgetMs) * 100),
        dimensions: {
            pack: sample.pack,
            lane: sample.lane
        }
    }));
}

export function validateMetricCardinality(metrics: MetricDatum[]): string[] {
    const violations: string[] = [];

    for (const metric of metrics) {
        const dimensionNames = Object.keys(metric.dimensions);
        if (dimensionNames.length > MAX_DIMENSIONS_PER_METRIC) {
            violations.push(`${metric.name}:too_many_dimensions`);
        }

        for (const forbidden of forbiddenMetricDimensions) {
            if (forbidden in metric.dimensions) {
                violations.push(`${metric.name}:forbidden_dimension:${forbidden}`);
            }
        }
    }

    return violations;
}

function nearestRankPercentile(sortedSamplesMs: number[], percentile: number): number {
    const index = Math.max(0, Math.ceil((percentile / 100) * sortedSamplesMs.length) - 1);
    return sortedSamplesMs[index];
}
