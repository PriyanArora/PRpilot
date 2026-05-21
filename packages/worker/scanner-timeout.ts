import type { Lane } from "../config/runtime-policy";
import type { Coverage } from "../rules/coverage";

export const DEFAULT_SCANNER_PARALLELISM = 2;

export type ScannerFailureKind = "timeout" | "crash";

export type ScannerFailureCoverageInput = {
    lane: Lane;
    scanner: string;
    scopeExpected: string;
    failureKind: ScannerFailureKind;
    reason: string;
    durationMs: number;
    budgetMs: number;
};

export function normalizeScannerParallelism(requestedParallelism: number): number {
    if (!Number.isFinite(requestedParallelism)) {
        return 1;
    }

    return Math.max(1, Math.min(Math.floor(requestedParallelism), DEFAULT_SCANNER_PARALLELISM));
}

export function buildScannerFailureCoverage(input: ScannerFailureCoverageInput): Coverage {
    return {
        lane: input.lane,
        scanner: input.scanner,
        applicability: "applicable",
        status: input.failureKind === "timeout" ? "timed_out" : "failed",
        scope_expected: input.scopeExpected,
        scope_completed: "partial_scope",
        reason: input.reason,
        duration_ms: input.durationMs,
        budget_ms: input.budgetMs
    };
}
