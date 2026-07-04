import type { ChangedFile } from "./changed-file";
import type { Coverage } from "./coverage";
import type { Finding } from "./finding";
import { evaluateLargeChange } from "./internal-large-change";
import { evaluateLockfileDrift } from "./internal-lockfile-drift";
import { evaluateSensitiveFileChange } from "./internal-sensitive-file-change";

export type InternalFastLaneReview = {
    findings: Finding[];
    coverage: Coverage[];
};

const INTERNAL_RULES: Array<(changedFiles: ChangedFile[]) => { findings: Finding[] }> = [
    evaluateLargeChange,
    evaluateSensitiveFileChange,
    evaluateLockfileDrift
];

// Runs every internal fast-lane rule over the changed files and merges the results
// into one findings list plus a single coverage record with a measured duration.
// Fails closed: if any rule throws, coverage reports "failed" so the check-run
// conclusion becomes action_required instead of a false pass.
export function runInternalFastLaneReview(
    changedFiles: ChangedFile[],
    budgetMs = 1_000
): InternalFastLaneReview {
    const startedAt = performance.now();
    const findings: Finding[] = [];
    let failureReason: string | undefined;

    for (const rule of INTERNAL_RULES) {
        try {
            findings.push(...rule(changedFiles).findings);
        } catch (error) {
            failureReason = error instanceof Error ? error.message : "internal rule threw";
        }
    }

    const durationMs = Math.round(performance.now() - startedAt);

    return {
        findings,
        coverage: [{
            lane: "fast",
            scanner: "internal",
            applicability: "applicable",
            status: failureReason === undefined ? "completed" : "failed",
            scope_expected: "changed_files",
            scope_completed: failureReason === undefined ? "changed_files" : "partial",
            ...(failureReason === undefined ? {} : { reason: failureReason }),
            duration_ms: durationMs,
            budget_ms: budgetMs
        }]
    };
}
